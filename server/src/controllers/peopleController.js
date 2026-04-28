const bcrypt = require("bcryptjs");
const Department = require("../models/Department");
const Faculty = require("../models/Faculty");
const Student = require("../models/Student");
const User = require("../models/User");
const { createError } = require("../utils/error");

async function listStudents(req, res) {
  const { department, year, section, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (req.user.role === "hod" || req.user.role === "faculty") {
    const ownDepartment = await Department.findOne({ code: req.user.departmentCode });
    if (ownDepartment) query.department = ownDepartment._id;
  }

  if (department) {
    const departmentDoc = await Department.findOne({ code: String(department).toUpperCase() });
    if (departmentDoc) query.department = departmentDoc._id;
  }
  if (year) query.year = Number(year);
  if (section) query.section = String(section).toUpperCase();

  const numericPage = Math.max(Number(page) || 1, 1);
  const numericLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  if (search) {
    const regex = new RegExp(String(search).trim(), "i");
    query.$or = [{ name: regex }, { rollNumber: regex }, { email: regex }];
  }

  const [items, total] = await Promise.all([
    Student.find(query)
      .populate("department user")
      .sort({ year: 1, section: 1, rollNumber: 1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .lean(),
    Student.countDocuments(query),
  ]);

  res.json({
    success: true,
    items,
    pagination: {
      total,
      page: numericPage,
      limit: numericLimit,
      totalPages: Math.max(Math.ceil(total / numericLimit), 1),
    },
  });
}

async function createStudent(req, res) {
  const department = await Department.findById(req.body.department);
  if (!department) throw createError(404, "Department not found.");

  const password = req.body.password || "Student@123";
  const user = await User.create({
    username: req.body.username.toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role: "student",
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    departmentCode: department.code,
    title: `Year ${req.body.year} - Section ${req.body.section}`,
  });

  const item = await Student.create({
    user: user._id,
    name: req.body.name,
    rollNumber: req.body.rollNumber,
    department: department._id,
    year: Number(req.body.year),
    section: String(req.body.section).toUpperCase(),
    email: req.body.email,
    phone: req.body.phone,
    guardianName: req.body.guardianName,
    guardianPhone: req.body.guardianPhone,
  });

  const populated = await Student.findById(item._id).populate("department user");
  res.status(201).json({ success: true, item: populated });
}

async function updateStudent(req, res) {
  const student = await Student.findById(req.params.id);
  if (!student) throw createError(404, "Student not found.");

  if (req.body.department) {
    const department = await Department.findById(req.body.department);
    if (!department) throw createError(404, "Department not found.");
    student.department = department._id;
    const user = await User.findById(student.user);
    if (user) user.departmentCode = department.code;
    if (user) await user.save();
  }

  Object.assign(student, {
    name: req.body.name ?? student.name,
    rollNumber: req.body.rollNumber ?? student.rollNumber,
    year: req.body.year ? Number(req.body.year) : student.year,
    section: req.body.section ? String(req.body.section).toUpperCase() : student.section,
    email: req.body.email ?? student.email,
    phone: req.body.phone ?? student.phone,
    guardianName: req.body.guardianName ?? student.guardianName,
    guardianPhone: req.body.guardianPhone ?? student.guardianPhone,
  });
  await student.save();

  const user = await User.findById(student.user);
  if (user) {
    user.name = student.name;
    user.email = student.email;
    user.phone = student.phone;
    user.title = `Year ${student.year} - Section ${student.section}`;
    await user.save();
  }

  const item = await Student.findById(student._id).populate("department user");
  res.json({ success: true, item });
}

async function deleteStudent(req, res) {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) throw createError(404, "Student not found.");
  await User.findByIdAndDelete(student.user);
  res.json({ success: true, message: "Student deleted." });
}

async function listFaculty(req, res) {
  const query = {};
  if (req.user.role === "hod") {
    const ownDepartment = await Department.findOne({ code: req.user.departmentCode });
    if (ownDepartment) query.department = ownDepartment._id;
  }
  if (req.query.department) {
    const departmentDoc = await Department.findOne({ code: String(req.query.department).toUpperCase() });
    if (departmentDoc) query.department = departmentDoc._id;
  }

  const items = await Faculty.find(query).populate("department user").sort({ createdAt: -1 });
  res.json({ success: true, items });
}

async function createFaculty(req, res) {
  const department = await Department.findById(req.body.department);
  if (!department) throw createError(404, "Department not found.");

  const password = req.body.password || "Faculty@123";
  const user = await User.create({
    username: req.body.username.toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role: req.body.role || "faculty",
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    departmentCode: department.code,
    title: req.body.designation || "Assistant Professor",
  });

  const item = await Faculty.create({
    user: user._id,
    name: req.body.name,
    employeeId: req.body.employeeId,
    department: department._id,
    subjectExpertise: req.body.subjectExpertise || [],
    designation: req.body.designation || "Assistant Professor",
  });

  if (user.role === "hod") {
    department.hod = user._id;
    await department.save();
  }

  const populated = await Faculty.findById(item._id).populate("department user");
  res.status(201).json({ success: true, item: populated });
}

async function updateFaculty(req, res) {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw createError(404, "Faculty not found.");

  if (req.body.department) {
    const department = await Department.findById(req.body.department);
    if (!department) throw createError(404, "Department not found.");
    faculty.department = department._id;
    const user = await User.findById(faculty.user);
    if (user) {
      user.departmentCode = department.code;
      await user.save();
    }
  }

  Object.assign(faculty, {
    name: req.body.name ?? faculty.name,
    employeeId: req.body.employeeId ?? faculty.employeeId,
    subjectExpertise: req.body.subjectExpertise ?? faculty.subjectExpertise,
    designation: req.body.designation ?? faculty.designation,
  });
  await faculty.save();

  const user = await User.findById(faculty.user);
  if (user) {
    user.name = faculty.name;
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone ?? user.phone;
    user.title = faculty.designation;
    user.role = req.body.role ?? user.role;
    await user.save();

    if (user.role === "hod" && faculty.department) {
      const department = await Department.findById(faculty.department);
      if (department) {
        department.hod = user._id;
        await department.save();
      }
    }
  }

  const item = await Faculty.findById(faculty._id).populate("department user");
  res.json({ success: true, item });
}

async function deleteFaculty(req, res) {
  const faculty = await Faculty.findByIdAndDelete(req.params.id);
  if (!faculty) throw createError(404, "Faculty not found.");
  await User.findByIdAndDelete(faculty.user);
  res.json({ success: true, message: "Faculty deleted." });
}

module.exports = {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  listFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
};
