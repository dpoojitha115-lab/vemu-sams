const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    collegeName: { type: String, default: "VEMU Institute of Technology" },
    collegeMotto: { type: String, default: "Quality education for bright future." },
    collegeAddress: { type: String, default: "P.Kothakota, Near Pakala, Chittoor, Andhra Pradesh" },
    threshold: { type: Number, default: 75 },
    supportEmail: { type: String, default: "sams@vemu.edu.in" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);

