const Subject = require("../models/Subject");
const { createError } = require("../utils/error");

async function listSubjects(req, res) {
  const query = {};
  const Department = require("../models/Department");

  if (req.user.role !== "admin") {
    const department = req.user.departmentCode;
    if (department) {
      const departmentDoc = await Department.findOne({ code: department });
      if (departmentDoc) query.department = departmentDoc._id;
    }
  }

  if (req.query.department) {
    const requestedDepartment = await Department.findOne({ code: String(req.query.department).toUpperCase() });
    if (requestedDepartment) query.department = requestedDepartment._id;
  }

  if (req.query.year) query.year = Number(req.query.year);
  if (req.query.semester) query.semester = Number(req.query.semester);
  if (req.query.section) query.section = String(req.query.section).toUpperCase();

  const items = await Subject.find(query)
    .populate("department faculty")
    .sort({ year: 1, semester: 1, section: 1, name: 1 });
  res.json({ success: true, items });
}

async function createSubject(req, res) {
  const item = await Subject.create({
    ...req.body,
    section: String(req.body.section).toUpperCase(),
  });
  const populated = await Subject.findById(item._id).populate("department faculty");
  res.status(201).json({ success: true, item: populated });
}

async function updateSubject(req, res) {
  const item = await Subject.findByIdAndUpdate(
    req.params.id,
    { ...req.body, ...(req.body.section ? { section: String(req.body.section).toUpperCase() } : {}) },
    { new: true }
  ).populate("department faculty");

  if (!item) throw createError(404, "Subject not found.");
  res.json({ success: true, item });
}

async function deleteSubject(req, res) {
  const item = await Subject.findByIdAndDelete(req.params.id);
  if (!item) throw createError(404, "Subject not found.");
  res.json({ success: true, message: "Subject deleted." });
}

module.exports = {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
};
