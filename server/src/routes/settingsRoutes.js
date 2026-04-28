const express = require("express");
const { getSettings, updateProfile, updateSettings, upload } = require("../controllers/settingsController");
const { auth, allowRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.get("/", auth, asyncHandler(getSettings));
router.put("/", auth, allowRoles("admin"), asyncHandler(updateSettings));
router.put("/profile", auth, upload.single("avatar"), asyncHandler(updateProfile));

module.exports = router;

