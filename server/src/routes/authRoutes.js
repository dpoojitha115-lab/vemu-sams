const express = require("express");
const { login, forgotPassword, resetPassword, me } = require("../controllers/authController");
const { auth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.post("/login", asyncHandler(login));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password/:token", asyncHandler(resetPassword));
router.get("/me", auth, asyncHandler(me));

module.exports = router;

