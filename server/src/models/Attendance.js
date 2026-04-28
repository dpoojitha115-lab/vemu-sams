const mongoose = require("mongoose");

const attendanceEntrySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["present", "absent", "late"], default: "present" },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    year: { type: Number, required: true },
    section: { type: String, required: true, uppercase: true },
    entries: [attendanceEntrySchema],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

attendanceSchema.index({ date: 1, subject: 1, year: 1, section: 1 }, { unique: true });
attendanceSchema.index({ department: 1, year: 1, section: 1, date: -1 });
attendanceSchema.index({ faculty: 1, date: -1 });
attendanceSchema.index({ "entries.student": 1, date: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
