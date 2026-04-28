const Department = require("../models/Department");
const { createError } = require("../utils/error");

async function listDepartments(_req, res) {
  const items = await Department.find().populate("hod", "name email").sort({ name: 1 });
  res.json({ success: true, items });
}

async function createDepartment(req, res) {
  const item = await Department.create(req.body);
  res.status(201).json({ success: true, item });
}

async function updateDepartment(req, res) {
  const item = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) throw createError(404, "Department not found.");
  res.json({ success: true, item });
}

async function deleteDepartment(req, res) {
  const item = await Department.findByIdAndDelete(req.params.id);
  if (!item) throw createError(404, "Department not found.");
  res.json({ success: true, message: "Department deleted." });
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};

