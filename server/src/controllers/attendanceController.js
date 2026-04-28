const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Attendance = require("../models/Attendance");
const Department = require("../models/Department");
const Faculty = require("../models/Faculty");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const { getDashboardData, getProfileBundle, getReportData, seedLowAttendanceAlerts, clearDashboardCache } = require("../services/reportService");
const { createError } = require("../utils/error");

async function getDashboard(req, res) {
  const data = await getDashboardData(req.user);
  res.json({ success: true, data });
}

async function getProfile(req, res) {
  const data = await getProfileBundle(req.user);
  res.json({ success: true, data });
}

async function getAttendanceContext(req, res) {
  const faculty = await Faculty.findOne({ user: req.user._id });
  if (!faculty && req.user.role === "faculty") throw createError(404, "Faculty profile not found.");

  const subjectQuery = {};
  const departmentQuery = {};

  if (req.user.role === "hod" || req.user.role === "student" || req.user.role === "faculty") {
    const ownDepartment = await Department.findOne({ code: req.user.departmentCode });
    if (ownDepartment) {
      subjectQuery.department = ownDepartment._id;
      departmentQuery._id = ownDepartment._id;
    }
  }

  const [subjects, departments] = await Promise.all([
    Subject.find(subjectQuery).populate("department faculty").sort({ year: 1, semester: 1, section: 1, code: 1 }),
    Department.find(departmentQuery).sort({ name: 1 }),
  ]);

  res.json({ success: true, data: { subjects, departments } });
}

async function getStudentsForAttendance(req, res) {
  const { subjectId, year, section } = req.query;
  const subject = await Subject.findById(subjectId).populate("department");
  if (!subject) throw createError(404, "Subject not found.");

  const normalizedYear = Number(year || subject.year);
  const normalizedSection = String(section || subject.section).toUpperCase();

  if (normalizedYear !== Number(subject.year) || normalizedSection !== subject.section) {
    throw createError(400, "Selected year/section does not match the chosen subject.");
  }

  const students = await Student.find({
    department: subject.department._id,
    year: normalizedYear,
    section: normalizedSection,
  })
    .populate("department user")
    .sort({ rollNumber: 1 })
    .lean();

  const previousRecords = await Attendance.find({ subject: subject._id }).lean();
  const summaryMap = new Map();
  previousRecords.forEach((record) => {
    record.entries.forEach((entry) => {
      const key = String(entry.student);
      const current = summaryMap.get(key) || { attended: 0, total: 0 };
      current.total += 1;
      if (entry.status !== "absent") current.attended += 1;
      summaryMap.set(key, current);
    });
  });

  const items = students.map((student) => {
    const summary = summaryMap.get(String(student._id)) || { attended: 0, total: 0 };
    return {
      ...student,
      attendancePercentage: summary.total ? Number(((summary.attended / summary.total) * 100).toFixed(1)) : 0,
    };
  });

  res.json({ success: true, items });
}

async function upsertAttendance(req, res) {
  const { date, subjectId, year, section, entries, notes } = req.body;
  const subject = await Subject.findById(subjectId);
  if (!subject) throw createError(404, "Subject not found.");

  if (Number(year) !== Number(subject.year) || String(section).toUpperCase() !== subject.section) {
    throw createError(400, "Attendance can only be saved for the subject's mapped year and section.");
  }

  const faculty = await Faculty.findOne({ user: req.user._id });
  if (req.user.role === "faculty" && (!faculty || String(subject.faculty) !== String(faculty._id))) {
    throw createError(403, "You can only mark attendance for your mapped subjects.");
  }

  const record = await Attendance.findOneAndUpdate(
    {
      date,
      subject: subject._id,
      year: Number(year),
      section: String(section).toUpperCase(),
    },
    {
      date,
      subject: subject._id,
      department: subject.department,
      faculty: faculty?._id || subject.faculty,
      year: Number(year),
      section: String(section).toUpperCase(),
      entries,
      notes: notes || "",
    },
    { upsert: true, new: true }
  );

  clearDashboardCache();
  await seedLowAttendanceAlerts();
  res.json({ success: true, item: record });
}

async function getAttendanceRecords(req, res) {
  const { year, section, subjectId } = req.query;
  const filters = {};
  if (year) filters.year = Number(year);
  if (section) filters.section = String(section).toUpperCase();
  if (subjectId) filters.subject = subjectId;

  let query = Attendance.find(filters)
    .populate("department subject faculty entries.student")
    .sort({ date: -1, createdAt: -1 });

  if (req.user.role === "faculty") {
    const faculty = await Faculty.findOne({ user: req.user._id });
    query = Attendance.find({ ...filters, faculty: faculty._id })
      .populate("department subject faculty entries.student")
      .sort({ date: -1, createdAt: -1 });
  } else if (req.user.role === "hod") {
    const department = await Department.findOne({ code: req.user.departmentCode });
    query = Attendance.find({ ...filters, department: department?._id })
      .populate("department subject faculty entries.student")
      .sort({ date: -1, createdAt: -1 });
  } else if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id });
    query = Attendance.find(filters)
      .populate("department subject faculty entries.student")
      .sort({ date: -1, createdAt: -1 });
    const items = (await query).filter((item) =>
      item.entries.some((entry) => String(entry.student._id) === String(student?._id))
    );
    return res.json({ success: true, items });
  }

  const items = await query;
  res.json({ success: true, items });
}

async function getReports(req, res) {
  const data = await getReportData(req.user, req.query);
  res.json({ success: true, data });
}

async function exportCsv(req, res) {
  const data = await getReportData(req.user, req.query);
  const headers = ["Student", "Roll Number", "Department", "Year", "Section", "Email", "Attendance %", "Total Classes", "Present", "Late", "Absent"];
  const rows = data.rows.map((row) =>
    [
      row.student,
      row.rollNumber,
      row.department,
      row.year,
      row.section,
      row.email,
      row.attendancePercentage,
      row.totalClasses,
      row.presentClasses,
      row.lateClasses,
      row.absentClasses,
    ].join(",")
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="attendance-report.csv"');
  res.send([headers.join(","), ...rows].join("\n"));
}

async function exportExcel(req, res) {
  const data = await getReportData(req.user, req.query);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Attendance Report");
  worksheet.columns = [
    { header: "Student", key: "student", width: 24 },
    { header: "Roll Number", key: "rollNumber", width: 18 },
    { header: "Department", key: "department", width: 16 },
    { header: "Year", key: "year", width: 10 },
    { header: "Section", key: "section", width: 10 },
    { header: "Email", key: "email", width: 28 },
    { header: "Attendance %", key: "attendancePercentage", width: 16 },
    { header: "Total Classes", key: "totalClasses", width: 16 },
    { header: "Present", key: "presentClasses", width: 12 },
    { header: "Late", key: "lateClasses", width: 12 },
    { header: "Absent", key: "absentClasses", width: 12 },
  ];
  worksheet.addRows(data.rows);
  worksheet.getRow(1).font = { bold: true };

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="attendance-report.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
}

async function exportPdf(req, res) {
  const data = await getReportData(req.user, req.query);
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="attendance-report.pdf"');
  doc.pipe(res);

  doc.fontSize(18).fillColor("#0f4c81").text("VEMU SAMS Attendance Report");
  doc.moveDown();
  data.rows.forEach((row, index) => {
    doc
      .fontSize(11)
      .fillColor("#111827")
      .text(
        `${index + 1}. ${row.student} (${row.rollNumber}) - ${row.department} | Year ${row.year}${row.section} | ${row.attendancePercentage}%`
      );
  });

  doc.end();
}

async function sendLowAttendanceAlerts(_req, res) {
  const alerts = await seedLowAttendanceAlerts();
  res.json({
    success: true,
    message: "Email alerts simulated for low-attendance students.",
    alerts,
  });
}

module.exports = {
  getDashboard,
  getProfile,
  getAttendanceContext,
  getStudentsForAttendance,
  upsertAttendance,
  getAttendanceRecords,
  getReports,
  exportCsv,
  exportExcel,
  exportPdf,
  sendLowAttendanceAlerts,
};
