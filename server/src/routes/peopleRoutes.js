const express = require("express");
const {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  listFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} = require("../controllers/peopleController");
const { auth, allowRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.get("/students", auth, asyncHandler(listStudents));
router.post("/students", auth, allowRoles("admin"), asyncHandler(createStudent));
router.put("/students/:id", auth, allowRoles("admin"), asyncHandler(updateStudent));
router.delete("/students/:id", auth, allowRoles("admin"), asyncHandler(deleteStudent));

router.get("/faculty", auth, asyncHandler(listFaculty));
router.post("/faculty", auth, allowRoles("admin"), asyncHandler(createFaculty));
router.put("/faculty/:id", auth, allowRoles("admin"), asyncHandler(updateFaculty));
router.delete("/faculty/:id", auth, allowRoles("admin"), asyncHandler(deleteFaculty));

module.exports = router;

