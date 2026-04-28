const express = require("express");
const {
  getAttendanceContext,
  getAttendanceRecords,
  getDashboard,
  getProfile,
  getReports,
  getStudentsForAttendance,
  sendLowAttendanceAlerts,
  upsertAttendance,
  exportCsv,
  exportExcel,
  exportPdf,
} = require("../controllers/attendanceController");
const { auth, allowRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.get("/dashboard", auth, asyncHandler(getDashboard));
router.get("/profile", auth, asyncHandler(getProfile));
router.get("/context", auth, asyncHandler(getAttendanceContext));
router.get("/students", auth, allowRoles("admin", "hod", "faculty"), asyncHandler(getStudentsForAttendance));
router.post("/mark", auth, allowRoles("admin", "faculty"), asyncHandler(upsertAttendance));
router.get("/records", auth, asyncHandler(getAttendanceRecords));
router.get("/reports", auth, asyncHandler(getReports));
router.get("/reports/csv", auth, asyncHandler(exportCsv));
router.get("/reports/excel", auth, asyncHandler(exportExcel));
router.get("/reports/pdf", auth, asyncHandler(exportPdf));
router.post("/alerts/low-attendance", auth, allowRoles("admin", "hod"), asyncHandler(sendLowAttendanceAlerts));

module.exports = router;

