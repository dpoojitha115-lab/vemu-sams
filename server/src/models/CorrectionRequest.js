const mongoose = require("mongoose");

const correctionRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance", required: true },
    requestedStatus: { type: String, enum: ["present", "absent", "late"], required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CorrectionRequest", correctionRequestSchema);

