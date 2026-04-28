const express = require("express");
const { createDepartment, deleteDepartment, listDepartments, updateDepartment } = require("../controllers/departmentController");
const { auth, allowRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.get("/", auth, asyncHandler(listDepartments));
router.post("/", auth, allowRoles("admin"), asyncHandler(createDepartment));
router.put("/:id", auth, allowRoles("admin"), asyncHandler(updateDepartment));
router.delete("/:id", auth, allowRoles("admin"), asyncHandler(deleteDepartment));

module.exports = router;

