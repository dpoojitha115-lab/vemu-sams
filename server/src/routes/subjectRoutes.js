const express = require("express");
const { createSubject, deleteSubject, listSubjects, updateSubject } = require("../controllers/subjectController");
const { auth, allowRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/error");

const router = express.Router();

router.get("/", auth, asyncHandler(listSubjects));
router.post("/", auth, allowRoles("admin"), asyncHandler(createSubject));
router.put("/:id", auth, allowRoles("admin"), asyncHandler(updateSubject));
router.delete("/:id", auth, allowRoles("admin"), asyncHandler(deleteSubject));

module.exports = router;

