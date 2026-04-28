const jwt = require("jsonwebtoken");

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      name: user.name,
      username: user.username,
      department: user.departmentCode || null,
    },
    process.env.JWT_SECRET || "change-this-in-production",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

module.exports = { signToken };

