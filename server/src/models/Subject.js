const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    year: { type: Number, required: true, min: 1, max: 4 },
    semester: { type: Number, required: true, min: 1, max: 8 },
    section: { type: String, required: true, uppercase: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", default: null },
  },
  { timestamps: true }
);

subjectSchema.index({ department: 1, year: 1, semester: 1, section: 1, faculty: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
