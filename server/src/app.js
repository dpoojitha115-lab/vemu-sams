const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const academicRoutes = require("./routes/academicRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const configuredOrigins = [process.env.CLIENT_URL, process.env.CLIENT_URLS]
  .filter(Boolean)
  .flatMap((value) => String(value).split(","))
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set(["http://localhost:5173", ...configuredOrigins]));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "SAMS API is healthy.", origins: allowedOrigins });
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/settings", settingsRoutes);

app.use(errorHandler);

module.exports = app;
