const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ["admin", "hod", "faculty", "student"] },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    departmentCode: { type: String, default: "" },
    avatar: { type: String, default: "" },
    title: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    resetToken: { type: String, default: "" },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, departmentCode: 1, isActive: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model("User", userSchema);
