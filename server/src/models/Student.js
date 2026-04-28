const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true },
    rollNumber: { type: String, required: true, unique: true, uppercase: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    year: { type: Number, required: true, min: 1, max: 4 },
    section: { type: String, required: true, uppercase: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    guardianName: { type: String, default: "" },
    guardianPhone: { type: String, default: "" },
  },
  { timestamps: true }
);

studentSchema.index({ department: 1, year: 1, section: 1 });
studentSchema.index({ user: 1 });
studentSchema.index({ rollNumber: 1 });

module.exports = mongoose.model("Student", studentSchema);
