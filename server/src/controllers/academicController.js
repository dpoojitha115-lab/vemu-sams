const Attendance = require("../models/Attendance");
const CorrectionRequest = require("../models/CorrectionRequest");
const Department = require("../models/Department");
const Faculty = require("../models/Faculty");
const Holiday = require("../models/Holiday");
const Student = require("../models/Student");
const Timetable = require("../models/Timetable");
const { createError } = require("../utils/error");
const { seedLowAttendanceAlerts, clearDashboardCache } = require("../services/reportService");

async function getTimetable(req, res) {
  const query = {};

  if (req.user.role === "faculty") {
    const faculty = await Faculty.findOne({ user: req.user._id });
    if (faculty) query.faculty = faculty._id;
  } else if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id });
    const department = await Department.findOne({ code: req.user.departmentCode });
    if (student && department) {
      query.department = department._id;
      query.year = student.year;
      query.section = student.section;
    }
  } else if (req.user.role === "hod") {
    const department = await Department.findOne({ code: req.user.departmentCode });
    if (department) query.department = department._id;
  } else if (req.query.department) {
    const department = await Department.findOne({ code: String(req.query.department).toUpperCase() });
    if (department) query.department = department._id;
  }

  const items = await Timetable.find(query)
    .populate("department faculty subject")
    .sort({ day: 1, startTime: 1 });

  res.json({ success: true, items });
}

async function listHolidays(_req, res) {
  const items = await Holiday.find().sort({ date: 1 });
  res.json({ success: true, items });
}

async function createHoliday(req, res) {
  const item = await Holiday.create(req.body);
  res.status(201).json({ success: true, item });
}

async function updateHoliday(req, res) {
  const item = await Holiday.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) throw createError(404, "Holiday not found.");
  res.json({ success: true, item });
}

async function deleteHoliday(req, res) {
  const item = await Holiday.findByIdAndDelete(req.params.id);
  if (!item) throw createError(404, "Holiday not found.");
  res.json({ success: true, message: "Holiday deleted." });
}

async function listCorrections(req, res) {
  const query = {};

  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id });
    if (student) query.student = student._id;
  } else if (req.user.role === "hod") {
    const department = await Department.findOne({ code: req.user.departmentCode });
    const students = await Student.find({ department: department?._id }).select("_id");
    query.student = { $in: students.map((item) => item._id) };
  } else if (req.user.role === "faculty") {
    const faculty = await Faculty.findOne({ user: req.user._id });
    const attendances = await Attendance.find({ faculty: faculty?._id }).select("_id");
    query.attendance = { $in: attendances.map((item) => item._id) };
  }

  const items = await CorrectionRequest.find(query)
    .populate("student attendance reviewedBy")
    .sort({ createdAt: -1 });

  res.json({ success: true, items });
}

async function createCorrection(req, res) {
  const student = await Student.findOne({ user: req.user._id });
  if (!student) throw createError(404, "Student profile not found.");

  const attendance = await Attendance.findById(req.body.attendance);
  if (!attendance) throw createError(404, "Attendance record not found.");

  const item = await CorrectionRequest.create({
    student: student._id,
    attendance: attendance._id,
    requestedStatus: req.body.requestedStatus,
    reason: req.body.reason,
  });

  res.status(201).json({ success: true, item });
}

async function reviewCorrection(req, res) {
  const item = await CorrectionRequest.findById(req.params.id).populate("student attendance");
  if (!item) throw createError(404, "Correction request not found.");

  item.status = req.body.status;
  item.reviewedBy = req.user._id;
  await item.save();

  if (req.body.status === "approved") {
    const attendance = await Attendance.findById(item.attendance._id);
    const entry = attendance.entries.find(
      (studentEntry) => String(studentEntry.student) === String(item.student._id)
    );
    if (entry) {
      entry.status = item.requestedStatus;
      await attendance.save();
    }
  }

  clearDashboardCache();
  await seedLowAttendanceAlerts();

  res.json({ success: true, item });
}

module.exports = {
  getTimetable,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listCorrections,
  createCorrection,
  reviewCorrection,
};
