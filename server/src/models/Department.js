const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String, default: "" },
    hod: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    totalIntake: { type: Number, default: 60 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);

