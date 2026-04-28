const express = require("express");
const {
  getTimetable,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listCorrections,
  createCorrection,
  reviewCorrection,
} = require("../controllers/academicController");
const { auth, allowRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.get("/timetable", auth, asyncHandler(getTimetable));
router.get("/holidays", auth, asyncHandler(listHolidays));
router.post("/holidays", auth, allowRoles("admin"), asyncHandler(createHoliday));
router.put("/holidays/:id", auth, allowRoles("admin"), asyncHandler(updateHoliday));
router.delete("/holidays/:id", auth, allowRoles("admin"), asyncHandler(deleteHoliday));

router.get("/corrections", auth, asyncHandler(listCorrections));
router.post("/corrections", auth, allowRoles("student"), asyncHandler(createCorrection));
router.patch("/corrections/:id", auth, allowRoles("admin", "hod", "faculty"), asyncHandler(reviewCorrection));

module.exports = router;
