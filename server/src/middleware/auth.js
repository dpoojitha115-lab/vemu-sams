const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createError, asyncHandler } = require("../utils/error");

const auth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    throw createError(401, "Authentication required.");
  }

  const token = header.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "change-this-in-production");
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    throw createError(401, "Session expired or user not found.");
  }

  req.user = user;
  next();
});

const allowRoles = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(createError(403, "You do not have access to this resource."));
  }
  return next();
};

module.exports = {
  auth,
  allowRoles,
};

