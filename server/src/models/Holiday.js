const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    type: { type: String, default: "college" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Holiday", holidaySchema);

