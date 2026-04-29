const Department = require("../models/Department");
const Attendance = require("../models/Attendance");
const Faculty = require("../models/Faculty");
const Notification = require("../models/Notification");
const Setting = require("../models/Setting");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const { ATTENDANCE_STATUS, ROLES } = require("../utils/constants");

const dashboardCache = new Map();
const referenceCache = { createdAt: 0, value: null };
const DASHBOARD_CACHE_TTL = 1000 * 60 * 2;
const REFERENCE_CACHE_TTL = 1000 * 60 * 5;

function attendedValue(status) {
  return status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.LATE ? 1 : 0;
}

function toPercent(attended, total) {
  if (!total) return 0;
  return Number(((attended / total) * 100).toFixed(1));
}

function getEntityId(value) {
  if (!value) return "";
  return String(value._id || value);
}

async function getReferenceData() {
  if (referenceCache.value && Date.now() - referenceCache.createdAt < REFERENCE_CACHE_TTL) {
    return referenceCache.value;
  }

  const [departments, setting] = await Promise.all([
    Department.find().populate("hod", "name email").lean(),
    Setting.findOne().lean(),
  ]);

  const value = { departments, setting };
  referenceCache.createdAt = Date.now();
  referenceCache.value = value;
  return value;
}

function ensureSubjectBucket(target, record) {
  const subjectName = record.subject?.name || record.subjectName || "Unknown Subject";
  const subjectCode = record.subject?.code || record.subjectCode || "N/A";
  if (!target.bySubject[subjectName]) {
    target.bySubject[subjectName] = {
      subjectCode,
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
    (record.entries || []).forEach((entry) => {
      const studentId = getEntityId(entry.student);
      if (!studentId) return;

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

      ensureSubjectBucket(current, record);
      const subjectKey = record.subject?.name || record.subjectName || "Unknown Subject";
      const subjectBucket = current.bySubject[subjectKey];
      subjectBucket.total += 1;
      subjectBucket.attended += attendedValue(status);
      if (status === ATTENDANCE_STATUS.PRESENT) subjectBucket.present += 1;
      if (status === ATTENDANCE_STATUS.LATE) subjectBucket.late += 1;
      if (status === ATTENDANCE_STATUS.ABSENT) subjectBucket.absent += 1;

      const monthKey = String(record.date).slice(0, 7);
      ensureMonthBucket(current, monthKey);
      const monthBucket = current.byMonth[monthKey];
      monthBucket.total += 1;
      monthBucket.attended += attendedValue(status);
      if (status === ATTENDANCE_STATUS.PRESENT) monthBucket.present += 1;
      if (status === ATTENDANCE_STATUS.LATE) monthBucket.late += 1;
      if (status === ATTENDANCE_STATUS.ABSENT) monthBucket.absent += 1;

      current.history.push({
        date: record.date,
        subject: record.subject?.name || record.subjectName || "Unknown Subject",
        subjectCode: record.subject?.code || record.subjectCode || "N/A",
        status,
      });

      current.calendar.push({
        date: record.date,
        status,
        subjectCode: record.subject?.code || record.subjectCode || "N/A",
      });

      summary.set(studentId, current);
    });
  });

  return summary;
}

function buildAttendanceMatch(scope = {}) {
  const match = {};

  if (scope.departmentId) match.department = scope.departmentId;
  if (scope.year) match.year = Number(scope.year);
  if (scope.section) match.section = String(scope.section).toUpperCase();
  if (scope.subjectId) match.subject = scope.subjectId;
  if (scope.facultyId) match.faculty = scope.facultyId;

  return match;
}

function applyScope(records, scope = {}) {
  return records.filter((record) => {
    if (scope.departmentId && getEntityId(record.department) !== String(scope.departmentId)) return false;
    if (scope.year && Number(record.year) !== Number(scope.year)) return false;
    if (scope.section && record.section !== String(scope.section).toUpperCase()) return false;
    if (scope.subjectId && getEntityId(record.subject) !== String(scope.subjectId)) return false;
    if (scope.facultyId && getEntityId(record.faculty) !== String(scope.facultyId)) return false;
    return true;
  });
}

function buildDepartmentChart(departments, aggregateRows) {
  const rowMap = new Map(aggregateRows.map((row) => [String(row._id), row]));

  return departments.map((department) => {
    const row = rowMap.get(String(department._id));
    return {
      name: department.code,
      label: department.name,
      attendance: toPercent(row?.attended || 0, row?.total || 0),
    };
  });
}

function buildTrendFromDaily(dailyRows, mode) {
  const bucket = {};

  dailyRows.forEach((row) => {
    let key = row._id;

    if (mode === "month") key = String(row._id).slice(0, 7);
    if (mode === "week") {
      const current = new Date(row._id);
      const start = new Date(current);
      start.setDate(current.getDate() - current.getDay());
      key = start.toISOString().slice(0, 10);
    }

    if (!bucket[key]) {
      bucket[key] = { label: key, total: 0, attended: 0 };
    }

    bucket[key].total += row.total;
    bucket[key].attended += row.attended;
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
    const facultyId = String(facultyMember._id);
    const scoped = records.filter((record) => getEntityId(record.faculty) === facultyId);
    const totals = scoped.reduce(
      (acc, record) => {
        (record.entries || []).forEach((entry) => {
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
      department: facultyMember.department?.code || facultyMember.departmentCode || "",
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

  const [{ departments, setting }, facultyProfile, studentProfile] = await Promise.all([
    getReferenceData(),
    user.role === ROLES.FACULTY ? Faculty.findOne({ user: user._id }).lean() : Promise.resolve(null),
    user.role === ROLES.STUDENT
      ? Student.findOne({ user: user._id }).populate("department user").lean()
      : Promise.resolve(null),
  ]);

  const threshold = setting?.threshold || 75;
  const scopedDepartment =
    user.role === ROLES.HOD || user.role === ROLES.FACULTY || user.role === ROLES.STUDENT
      ? departments.find((item) => item.code === user.departmentCode)
      : null;

  if (user.role === ROLES.STUDENT && studentProfile) {
    const studentRows = await Attendance.aggregate([
      {
        $match: {
          department: studentProfile.department._id,
          year: studentProfile.year,
          section: studentProfile.section,
          "entries.student": studentProfile._id,
        },
      },
      { $unwind: "$entries" },
      { $match: { "entries.student": studentProfile._id } },
      {
        $lookup: {
          from: "subjects",
          localField: "subject",
          foreignField: "_id",
          as: "subjectDoc",
        },
      },
      { $unwind: "$subjectDoc" },
      {
        $project: {
          date: 1,
          status: "$entries.status",
          subjectName: "$subjectDoc.name",
          subjectCode: "$subjectDoc.code",
        },
      },
    ]);

    const report = {
      total: 0,
      attended: 0,
      present: 0,
      late: 0,
      absent: 0,
      bySubject: {},
      byMonth: {},
      history: [],
      calendar: [],
    };

    studentRows.forEach((row) => {
      report.total += 1;
      report.attended += attendedValue(row.status);
      if (row.status === ATTENDANCE_STATUS.PRESENT) report.present += 1;
      if (row.status === ATTENDANCE_STATUS.LATE) report.late += 1;
      if (row.status === ATTENDANCE_STATUS.ABSENT) report.absent += 1;

      if (!report.bySubject[row.subjectName]) {
        report.bySubject[row.subjectName] = {
          subjectCode: row.subjectCode,
          total: 0,
          attended: 0,
          present: 0,
          late: 0,
          absent: 0,
        };
      }

      const subjectBucket = report.bySubject[row.subjectName];
      subjectBucket.total += 1;
      subjectBucket.attended += attendedValue(row.status);
      if (row.status === ATTENDANCE_STATUS.PRESENT) subjectBucket.present += 1;
      if (row.status === ATTENDANCE_STATUS.LATE) subjectBucket.late += 1;
      if (row.status === ATTENDANCE_STATUS.ABSENT) subjectBucket.absent += 1;

      const monthKey = String(row.date).slice(0, 7);
      if (!report.byMonth[monthKey]) {
        report.byMonth[monthKey] = { total: 0, attended: 0 };
      }
      report.byMonth[monthKey].total += 1;
      report.byMonth[monthKey].attended += attendedValue(row.status);

      report.history.push({
        date: row.date,
        subject: row.subjectName,
        subjectCode: row.subjectCode,
        status: row.status,
      });

      report.calendar.push({
        date: row.date,
        status: row.status,
        subjectCode: row.subjectCode,
      });
    });

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
        monthlyTrends: Object.entries(report.byMonth)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, item]) => ({
            month,
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

  const studentMatch = scopedDepartment ? { department: scopedDepartment._id } : {};
  const facultyMatch = scopedDepartment ? { department: scopedDepartment._id } : {};
  const subjectMatch = scopedDepartment ? { department: scopedDepartment._id } : {};
  const attendanceScope = scopedDepartment ? { departmentId: scopedDepartment._id } : {};

  if (facultyProfile) {
    subjectMatch.faculty = facultyProfile._id;
    attendanceScope.facultyId = facultyProfile._id;
  }

  const scopedDepartments = scopedDepartment ? [scopedDepartment] : departments;
  const attendanceMatch = buildAttendanceMatch(attendanceScope);

  const [studentCount, facultyList, subjectCount, departmentAttendanceRows, dailyRows, lowAttendanceRows, facultyRows] = await Promise.all([
    Student.countDocuments(studentMatch),
    Faculty.find(facultyMatch).populate("department").lean(),
    Subject.countDocuments(subjectMatch),
    Attendance.aggregate([
      { $match: attendanceMatch },
      { $unwind: "$entries" },
      {
        $group: {
          _id: "$department",
          total: { $sum: 1 },
          attended: {
            $sum: {
              $cond: [{ $in: ["$entries.status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0],
            },
          },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: attendanceMatch },
      { $unwind: "$entries" },
      {
        $group: {
          _id: "$date",
          total: { $sum: 1 },
          attended: {
            $sum: {
              $cond: [{ $in: ["$entries.status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: attendanceMatch },
      { $unwind: "$entries" },
      {
        $group: {
          _id: "$entries.student",
          total: { $sum: 1 },
          attended: {
            $sum: {
              $cond: [{ $in: ["$entries.status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0],
            },
          },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: attendanceMatch },
      { $unwind: "$entries" },
      {
        $group: {
          _id: "$faculty",
          total: { $sum: 1 },
          attended: {
            $sum: {
              $cond: [{ $in: ["$entries.status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0],
            },
          },
          classesHandled: { $addToSet: "$_id" },
        },
      },
    ]),
  ]);

  const facultySummaryMap = new Map(
    facultyRows.map((row) => [
      String(row._id),
      {
        attendanceAverage: toPercent(row.attended, row.total),
        classesHandled: row.classesHandled.length,
      },
    ])
  );

  const lowStudentSummaries = lowAttendanceRows
    .map((row) => ({
      studentId: String(row._id),
      percentage: toPercent(row.attended, row.total),
      total: row.total,
    }))
    .filter((row) => row.total && row.percentage < threshold)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 30);

  const lowStudentDetails = lowStudentSummaries.length
    ? await Student.find({ _id: { $in: lowStudentSummaries.map((row) => row.studentId) } })
        .select("name rollNumber year section email")
        .lean()
    : [];

  const lowStudentMap = new Map(lowStudentDetails.map((student) => [String(student._id), student]));
  const lowAttendanceStudents = lowStudentSummaries
    .map((row) => {
      const student = lowStudentMap.get(row.studentId);
      if (!student) return null;
      return {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        year: student.year,
        section: student.section,
        percentage: row.percentage,
        email: student.email,
      };
    })
    .filter(Boolean);

  const result = {
    cards: [
      { title: "Total Students", value: studentCount, helper: "Across active cohorts" },
      { title: "Total Faculty", value: facultyList.length, helper: "Teaching members" },
      { title: "Departments", value: scopedDepartments.length, helper: "Managed departments" },
      { title: "Subjects", value: subjectCount, helper: "Mapped academic subjects" },
    ],
    charts: {
      departmentAttendance: buildDepartmentChart(scopedDepartments, departmentAttendanceRows),
      monthlyTrends: buildTrendFromDaily(dailyRows, "month"),
      weeklyTrends: buildTrendFromDaily(dailyRows, "week"),
      dailyTrends: buildTrendFromDaily(dailyRows, "day").slice(-14),
    },
    lowAttendanceStudents,
    threshold,
    facultySummary: facultyList.map((facultyMember) => {
      const aggregate = facultySummaryMap.get(String(facultyMember._id)) || {
        attendanceAverage: 0,
        classesHandled: 0,
      };
      return {
        id: facultyMember._id,
        name: facultyMember.name,
        designation: facultyMember.designation,
        department: facultyMember.department?.code || "",
        classesHandled: aggregate.classesHandled,
        attendanceAverage: aggregate.attendanceAverage,
      };
    }),
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
  const [{ departments }, facultyProfile] = await Promise.all([
    getReferenceData(),
    user.role === ROLES.FACULTY ? Faculty.findOne({ user: user._id }).lean() : Promise.resolve(null),
  ]);

  const scope = { ...filters };
  if (scope.department) {
    const selectedDepartment = departments.find((item) => item.code === String(scope.department).toUpperCase());
    if (selectedDepartment) scope.departmentId = selectedDepartment._id;
  }

  if (user.role === ROLES.HOD || user.role === ROLES.FACULTY || user.role === ROLES.STUDENT) {
    const department = departments.find((item) => item.code === user.departmentCode);
    if (department) scope.departmentId = department._id;
  }

  if (facultyProfile) {
    scope.facultyId = facultyProfile._id;
  }

  const studentQuery = {};
  if (scope.departmentId) studentQuery.department = scope.departmentId;
  if (scope.year) studentQuery.year = Number(scope.year);
  if (scope.section) studentQuery.section = String(scope.section).toUpperCase();

  if (user.role === ROLES.STUDENT) {
    studentQuery.user = user._id;
  }

  const attendanceMatch = buildAttendanceMatch(scope);
  const facultyQuery = scope.departmentId ? { department: scope.departmentId } : {};

  const [students, records, facultyList] = await Promise.all([
    Student.find(studentQuery).populate("department user").lean(),
    Attendance.find(attendanceMatch)
      .select("date department subject faculty year section entries")
      .populate("department", "code name")
      .populate("subject", "name code")
      .populate("faculty", "name designation department")
      .lean(),
    Faculty.find(facultyQuery).populate("department").lean(),
  ]);

  const scopedRecords = applyScope(records, scope);
  const scopedSummaryMap = buildStudentAttendanceMap(scopedRecords);

  return {
    rows: buildAttendanceReportRows(students, scopedSummaryMap),
    scopedRecords,
    facultySummary: buildFacultySummary(facultyList, scopedRecords),
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
  const [students, records, setting] = await Promise.all([
    Student.find().populate("user").lean(),
    Attendance.find().select("date subject entries").populate("subject", "name code").lean(),
    Setting.findOne().lean(),
  ]);
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
