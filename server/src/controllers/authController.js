const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { createError } = require("../utils/error");
const { signToken } = require("../utils/tokens");

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

async function login(req, res) {
  const { username, password, role } = req.body;
  const user = await User.findOne({ username: String(username || "").toLowerCase() });

  if (!user) throw createError(401, "Invalid credentials.");
  if (role && user.role !== role) throw createError(401, "Selected role does not match this account.");

  const isMatch = await bcrypt.compare(password || "", user.password);
  if (!isMatch) throw createError(401, "Invalid credentials.");

  const token = signToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      departmentCode: user.departmentCode,
      avatar: user.avatar,
      title: user.title,
    },
  });
}

async function forgotPassword(req, res) {
  const { username } = req.body;
  const user = await User.findOne({ username: String(username || "").toLowerCase() });
  if (!user) throw createError(404, "User not found.");

  const token = crypto.randomBytes(20).toString("hex");
  user.resetToken = token;
  user.resetTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 20);
  await user.save();

  res.json({
    success: true,
    message: `Reset link generated for ${user.email}.`,
    resetLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${token}`,
  });
}

async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  if (!passwordRule.test(password || "")) {
    throw createError(400, "Password must be at least 8 characters with upper, lower, and special characters.");
  }

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) throw createError(400, "Reset token is invalid or expired.");

  user.password = await bcrypt.hash(password, 10);
  user.resetToken = "";
  user.resetTokenExpiresAt = null;
  await user.save();

  res.json({ success: true, message: "Password updated successfully." });
}

async function me(req, res) {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      email: req.user.email,
      phone: req.user.phone,
      departmentCode: req.user.departmentCode,
      avatar: req.user.avatar,
      title: req.user.title,
    },
  });
}

module.exports = {
  login,
  forgotPassword,
  resetPassword,
  me,
};

