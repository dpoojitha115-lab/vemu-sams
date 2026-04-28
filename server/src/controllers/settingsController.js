const multer = require("multer");
const Setting = require("../models/Setting");
const User = require("../models/User");
const { createError } = require("../utils/error");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

async function getSettings(_req, res) {
  const item = await Setting.findOne();
  res.json({ success: true, item });
}

async function updateSettings(req, res) {
  const item = await Setting.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  res.json({ success: true, item });
}

async function updateProfile(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) throw createError(404, "User not found.");

  user.name = req.body.name ?? user.name;
  user.email = req.body.email ?? user.email;
  user.phone = req.body.phone ?? user.phone;
  if (req.file) {
    const mimeType = req.file.mimetype || "image/png";
    user.avatar = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;
  }
  await user.save();

  res.json({ success: true, item: user });
}

module.exports = {
  upload,
  getSettings,
  updateSettings,
  updateProfile,
};
