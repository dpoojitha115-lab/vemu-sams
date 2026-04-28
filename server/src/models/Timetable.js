const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    year: { type: Number, required: true },
    section: { type: String, required: true, uppercase: true },
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Timetable", timetableSchema);
