const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true },
    employeeId: { type: String, required: true, unique: true, uppercase: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    subjectExpertise: [{ type: String }],
    designation: { type: String, default: "Assistant Professor" },
  },
  { timestamps: true }
);

facultySchema.index({ department: 1 });
facultySchema.index({ user: 1 });

module.exports = mongoose.model("Faculty", facultySchema);
