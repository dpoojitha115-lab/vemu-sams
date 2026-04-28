const Department = require("../models/Department");
const Attendance = require("../models/Attendance");
const Faculty = require("../models/Faculty");
const Notification = require("../models/Notification");
const Setting = require("../models/Setting");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const User = require("../models/User");
const { ATTENDANCE_STATUS, ROLES } = require("../utils/constants");

const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL = 1000 * 30;

function attendedValue(status) {
  return status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.LATE ? 1 : 0;
}

function toPercent(attended, total) {
  if (!total) return 0;
  return Number(((attended / total) * 100).toFixed(1));
}

async function getBaseCollections() {
  const [students, faculty, departments, subjects, records, setting] = await Promise.all([
    Student.find().populate("department user").lean(),
    Faculty.find().populate("department user").lean(),
    Department.find().populate("hod", "name email").lean(),
    Subject.find().populate("department faculty").lean(),
    Attendance.find().populate("subject department faculty entries.student").lean(),
    Setting.findOne().lean(),
  ]);

  return {
    students,
    faculty,
    departments,
    subjects,
    records,
    setting,
  };
}

function ensureSubjectBucket(target, subject) {
  if (!target.bySubject[subject.name]) {
    target.bySubject[subject.name] = {
      subjectCode: subject.code,
      total: 0,
      attended: 0,
      present: 0,
      late: 0,
      absent: 0,
    };
  }
}

function ensureMonthBucket(target, monthKey) {
  if (!target.byMonth[monthKey]) {
    target.byMonth[monthKey] = {
      month: monthKey,
      total: 0,
      attended: 0,
      present: 0,
      late: 0,
      absent: 0,
    };
  }
}

function buildStudentAttendanceMap(records) {
  const summary = new Map();

  records.forEach((record) => {
    record.entries.forEach((entry) => {
      const studentId = String(entry.student._id);
      const status = entry.status;
      const current = summary.get(studentId) || {
        total: 0,
        attended: 0,
        present: 0,
        late: 0,
        absent: 0,
        bySubject: {},
        history: [],
        byMonth: {},
        calendar: [],
      };

      current.total += 1;
      current.attended += attendedValue(status);
      if (status === ATTENDANCE_STATUS.PRESENT) current.present += 1;
      if (status === ATTENDANCE_STATUS.LATE) current.late += 1;
      if (status === ATTENDANCE_STATUS.ABSENT) current.absent += 1;

      ensureSubjectBucket(current, record.subject);
      const subjectBucket = current.bySubject[record.subject.name];
      subjectBucket.total += 1;
      subjectBucket.attended += attendedValue(status);
      if (status === ATTENDANCE_STATUS.PRESENT) subjectBucket.present += 1;
      if (status === ATTENDANCE_STATUS.LATE) subjectBucket.late += 1;
      if (status === ATTENDANCE_STATUS.ABSENT) subjectBucket.absent += 1;

      const monthKey = record.date.slice(0, 7);
      ensureMonthBucket(current, monthKey);
      const monthBucket = current.byMonth[monthKey];
      monthBucket.total += 1;
      monthBucket.attended += attendedValue(status);
      if (status === ATTENDANCE_STATUS.PRESENT) monthBucket.present += 1;
      if (status === ATTENDANCE_STATUS.LATE) monthBucket.late += 1;
      if (status === ATTENDANCE_STATUS.ABSENT) monthBucket.absent += 1;

      current.history.push({
        date: record.date,
        subject: record.subject.name,
        subjectCode: record.subject.code,
        status,
      });

      current.calendar.push({
        date: record.date,
        status,
        subjectCode: record.subject.code,
      });

      summary.set(studentId, current);
    });
  });

  return summary;
}

function applyScope(records, scope = {}) {
  return records.filter((record) => {
    if (scope.departmentId && String(record.department._id) !== String(scope.departmentId)) return false;
    if (scope.year && Number(record.year) !== Number(scope.year)) return false;
    if (scope.section && record.section !== String(scope.section).toUpperCase()) return false;
    if (scope.subjectId && String(record.subject._id) !== String(scope.subjectId)) return false;
    if (scope.facultyId && String(record.faculty._id) !== String(scope.facultyId)) return false;
    return true;
  });
}

function buildDepartmentChart(departments, students, summaryMap) {
  return departments.map((department) => {
    const departmentStudents = students.filter(
      (student) => String(student.department._id) === String(department._id)
    );

    const totals = departmentStudents.reduce(
      (acc, student) => {
        const report = summaryMap.get(String(student._id)) || { attended: 0, total: 0 };
        acc.attended += report.attended;
        acc.total += report.total;
        return acc;
      },
      { attended: 0, total: 0 }
    );

    return {
      name: department.code,
      label: department.name,
      attendance: toPercent(totals.attended, totals.total),
    };
  });
}

function buildTrend(records, mode) {
  const bucket = {};
  records.forEach((record) => {
    let key = record.date;
    if (mode === "month") key = record.date.slice(0, 7);
    if (mode === "week") {
      const current = new Date(record.date);
      const start = new Date(current);
      start.setDate(current.getDate() - current.getDay());
      key = start.toISOString().slice(0, 10);
    }

    if (!bucket[key]) {
      bucket[key] = { label: key, total: 0, attended: 0 };
    }
    record.entries.forEach((entry) => {
      bucket[key].total += 1;
      bucket[key].attended += attendedValue(entry.status);
    });
  });

  return Object.values(bucket)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => ({
      [mode === "month" ? "month" : mode === "week" ? "week" : "day"]: item.label,
      attendance: toPercent(item.attended, item.total),
    }));
}

function buildFacultySummary(facultyList, records) {
  return facultyList.map((facultyMember) => {
    const scoped = records.filter((record) => String(record.faculty._id) === String(facultyMember._id));
    const totals = scoped.reduce(
      (acc, record) => {
        record.entries.forEach((entry) => {
          acc.total += 1;
          acc.attended += attendedValue(entry.status);
        });
        return acc;
      },
      { total: 0, attended: 0 }
    );

    return {
      id: facultyMember._id,
      name: facultyMember.name,
      designation: facultyMember.designation,
      department: facultyMember.department.code,
      classesHandled: scoped.length,
      attendanceAverage: toPercent(totals.attended, totals.total),
    };
  });
}

async function createLowAttendanceNotifications(students, summaryMap, threshold) {
  const alerts = [];

  students.forEach((student) => {
    const report = summaryMap.get(String(student._id)) || { total: 0, attended: 0 };
    const percentage = toPercent(report.attended, report.total);
    if (report.total && percentage < threshold) {
      alerts.push({
        user: student.user._id,
        title: "Low attendance warning",
        message: `Your attendance is ${percentage}%. Please meet your class advisor.`,
        type: "warning",
      });
    }
  });

  await Notification.deleteMany({ type: "warning" });
  if (alerts.length) {
    await Notification.insertMany(alerts);
  }

  return alerts.map((alert) => ({
    recipient: students.find((student) => String(student.user._id) === String(alert.user))?.name || "Student",
    message: alert.message,
  }));
}

async function getDashboardData(user) {
  const cacheKey = `${user.role}:${user.departmentCode || "all"}:${String(user._id)}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < DASHBOARD_CACHE_TTL) {
    return cached.value;
  }

  const { students, faculty, departments, subjects, records, setting } = await getBaseCollections();
  const studentSummaryMap = buildStudentAttendanceMap(records);
  const threshold = setting?.threshold || 75;

  let scopedStudents = students;
  let scopedFaculty = faculty;
  let scopedDepartments = departments;
  let scopedSubjects = subjects;
  let scopedRecords = records;

  if (user.role === ROLES.HOD || user.role === ROLES.FACULTY || user.role === ROLES.STUDENT) {
    const department = departments.find((item) => item.code === user.departmentCode);
    if (department) {
      scopedStudents = students.filter((student) => String(student.department._id) === String(department._id));
      scopedFaculty = faculty.filter((item) => String(item.department._id) === String(department._id));
      scopedSubjects = subjects.filter((item) => String(item.department._id) === String(department._id));
      scopedRecords = records.filter((item) => String(item.department._id) === String(department._id));
      scopedDepartments = [department];
    }
  }

  if (user.role === ROLES.FACULTY) {
    const facultyProfile = faculty.find((item) => String(item.user._id) === String(user._id));
    if (facultyProfile) {
      scopedSubjects = scopedSubjects.filter(
        (subject) => subject.faculty && String(subject.faculty._id) === String(facultyProfile._id)
      );
      scopedRecords = scopedRecords.filter((record) => String(record.faculty._id) === String(facultyProfile._id));
    }
  }

  if (user.role === ROLES.STUDENT) {
    const studentProfile = students.find((item) => String(item.user._id) === String(user._id));
    if (studentProfile) {
      const report = studentSummaryMap.get(String(studentProfile._id)) || {
        total: 0,
        attended: 0,
        present: 0,
        late: 0,
        absent: 0,
        bySubject: {},
        history: [],
        byMonth: {},
        calendar: [],
      };

      const result = {
        cards: [
          { title: "Overall Attendance", value: `${toPercent(report.attended, report.total)}%`, helper: "Live attendance percentage" },
          { title: "Subjects", value: Object.keys(report.bySubject).length, helper: "Active enrolled subjects" },
          { title: "Attendance Threshold", value: `${threshold}%`, helper: "Minimum required attendance" },
        ],
        charts: {
          donut: [
            { name: "Present", value: report.present },
            { name: "Late", value: report.late },
            { name: "Absent", value: report.absent },
          ],
          subjectBreakdown: Object.entries(report.bySubject).map(([name, item]) => ({
            subject: name,
            code: item.subjectCode,
            attendance: toPercent(item.attended, item.total),
            present: item.present,
            late: item.late,
            absent: item.absent,
          })),
          monthlyTrends: Object.values(report.byMonth)
            .sort((a, b) => a.month.localeCompare(b.month))
            .map((item) => ({
              month: item.month,
              attendance: toPercent(item.attended, item.total),
            })),
        },
        profile: studentProfile,
        history: report.history.sort((a, b) => b.date.localeCompare(a.date)),
        calendar: report.calendar.sort((a, b) => b.date.localeCompare(a.date)),
        threshold,
        lowAttendanceWarning: toPercent(report.attended, report.total) < threshold,
      };
      dashboardCache.set(cacheKey, { createdAt: Date.now(), value: result });
      return result;
    }
  }

  const scopedSummaryMap = buildStudentAttendanceMap(scopedRecords);
  const lowAttendanceStudents = scopedStudents
    .map((student) => {
      const report = scopedSummaryMap.get(String(student._id)) || { total: 0, attended: 0 };
      return {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        year: student.year,
        section: student.section,
        percentage: toPercent(report.attended, report.total),
        email: student.email,
      };
    })
    .filter((student) => student.percentage < threshold)
    .sort((a, b) => a.percentage - b.percentage);

  const result = {
    cards: [
      { title: "Total Students", value: scopedStudents.length, helper: "Across active cohorts" },
      { title: "Total Faculty", value: scopedFaculty.length, helper: "Teaching members" },
      { title: "Departments", value: scopedDepartments.length, helper: "Managed departments" },
      { title: "Subjects", value: scopedSubjects.length, helper: "Mapped academic subjects" },
    ],
    charts: {
      departmentAttendance: buildDepartmentChart(scopedDepartments, scopedStudents, scopedSummaryMap),
      monthlyTrends: buildTrend(scopedRecords, "month"),
      weeklyTrends: buildTrend(scopedRecords, "week"),
      dailyTrends: buildTrend(scopedRecords, "day").slice(-14),
    },
    lowAttendanceStudents,
    threshold,
    facultySummary: buildFacultySummary(scopedFaculty, scopedRecords),
  };
  dashboardCache.set(cacheKey, { createdAt: Date.now(), value: result });
  return result;
}

function buildAttendanceReportRows(students, summaryMap) {
  return students.map((student) => {
    const report = summaryMap.get(String(student._id)) || {
      total: 0,
      attended: 0,
      present: 0,
      late: 0,
      absent: 0,
    };
    return {
      student: student.name,
      rollNumber: student.rollNumber,
      department: student.department.code,
      year: student.year,
      section: student.section,
      email: student.email,
      attendancePercentage: toPercent(report.attended, report.total),
      totalClasses: report.total,
      presentClasses: report.present,
      lateClasses: report.late,
      absentClasses: report.absent,
    };
  });
}

async function getReportData(user, filters = {}) {
  const { students, faculty, departments, records } = await getBaseCollections();

  let scope = { ...filters };
  if (scope.department) {
    const selectedDepartment = departments.find((item) => item.code === String(scope.department).toUpperCase());
    if (selectedDepartment) scope.departmentId = selectedDepartment._id;
  }
  if (user.role === ROLES.HOD || user.role === ROLES.FACULTY || user.role === ROLES.STUDENT) {
    const department = departments.find((item) => item.code === user.departmentCode);
    if (department) scope.departmentId = department._id;
  }

  if (user.role === ROLES.FACULTY) {
    const facultyProfile = faculty.find((item) => String(item.user._id) === String(user._id));
    if (facultyProfile) scope.facultyId = facultyProfile._id;
  }

  const scopedRecords = applyScope(records, scope);
  const scopedSummaryMap = buildStudentAttendanceMap(scopedRecords);
  let scopedStudents = students.filter((student) => {
    if (scope.departmentId && String(student.department._id) !== String(scope.departmentId)) return false;
    if (scope.year && Number(student.year) !== Number(scope.year)) return false;
    if (scope.section && student.section !== String(scope.section).toUpperCase()) return false;
    return true;
  });

  if (user.role === ROLES.STUDENT) {
    scopedStudents = scopedStudents.filter((student) => String(student.user._id) === String(user._id));
  }

  return {
    rows: buildAttendanceReportRows(scopedStudents, scopedSummaryMap),
    scopedRecords,
    facultySummary: buildFacultySummary(
      faculty.filter((item) => !scope.departmentId || String(item.department._id) === String(scope.departmentId)),
      scopedRecords
    ),
  };
}

async function getProfileBundle(user) {
  const [student, faculty, notifications, setting] = await Promise.all([
    Student.findOne({ user: user._id }).populate("department").lean(),
    Faculty.findOne({ user: user._id }).populate("department").lean(),
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
    Setting.findOne().lean(),
  ]);

  return {
    user,
    student,
    faculty,
    notifications,
    college: setting,
  };
}

async function seedLowAttendanceAlerts() {
  const students = await Student.find().populate("user").lean();
  const records = await Attendance.find().populate("subject department faculty entries.student").lean();
  const setting = await Setting.findOne().lean();
  const summaryMap = buildStudentAttendanceMap(records);
  const threshold = setting?.threshold || 75;

  return createLowAttendanceNotifications(students, summaryMap, threshold);
}

function clearDashboardCache() {
  dashboardCache.clear();
}

module.exports = {
  getDashboardData,
  getReportData,
  getProfileBundle,
  seedLowAttendanceAlerts,
  toPercent,
  buildStudentAttendanceMap,
  clearDashboardCache,
};
