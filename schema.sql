-- ============================================================
-- Excellence College Attendance Management System
-- Database Schema (SQLite)
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT    NOT NULL UNIQUE,    -- e.g. ADMIN001, HOD001, TCH001, STU001
  password     TEXT    NOT NULL,           -- bcrypt hash
  role         TEXT    NOT NULL CHECK(role IN ('admin','hod','teacher','student')),
  name         TEXT    NOT NULL,
  email        TEXT    UNIQUE,
  phone        TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login   TEXT
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT    NOT NULL UNIQUE,    -- e.g. CSE, ECE
  name         TEXT    NOT NULL,
  hod_id       INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roll_number  TEXT    NOT NULL UNIQUE,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  semester     INTEGER NOT NULL CHECK(semester BETWEEN 1 AND 8),
  section      TEXT    NOT NULL DEFAULT 'A',
  batch        TEXT,                       -- e.g. "2022-2026"
  dob          TEXT,
  address      TEXT,
  parent_phone TEXT,
  parent_email TEXT
);

-- ============================================================
-- FACULTY / TEACHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id   TEXT    NOT NULL UNIQUE,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  designation   TEXT,
  qualification TEXT
);

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  semester      INTEGER NOT NULL,
  credits       INTEGER NOT NULL DEFAULT 3,
  subject_type  TEXT    NOT NULL DEFAULT 'Theory' CHECK(subject_type IN ('Theory','Lab','Tutorial'))
);

-- Subject-Faculty mapping
CREATE TABLE IF NOT EXISTS subject_faculty (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  section    TEXT    NOT NULL DEFAULT 'A',
  UNIQUE(subject_id, faculty_id, section)
);

-- Subject-Student enrollment
CREATE TABLE IF NOT EXISTS enrollments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, subject_id)
);

-- ============================================================
-- TIMETABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS timetable (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  faculty_id INTEGER NOT NULL REFERENCES faculty(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  section    TEXT    NOT NULL DEFAULT 'A',
  semester   INTEGER NOT NULL,
  day_of_week TEXT   NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  hour_number INTEGER NOT NULL CHECK(hour_number BETWEEN 1 AND 8),
  start_time TEXT    NOT NULL,
  end_time   TEXT    NOT NULL
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id   INTEGER NOT NULL REFERENCES subjects(id),
  faculty_id   INTEGER NOT NULL REFERENCES faculty(id),
  date         TEXT    NOT NULL,           -- YYYY-MM-DD
  hour_number  INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'Absent' CHECK(status IN ('Present','Absent','OD','Leave')),
  marked_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  marked_by    INTEGER NOT NULL REFERENCES users(id),
  remarks      TEXT,
  UNIQUE(student_id, subject_id, date, hour_number)
);

-- Attendance session (when teacher opens marking)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id   INTEGER NOT NULL REFERENCES subjects(id),
  faculty_id   INTEGER NOT NULL REFERENCES faculty(id),
  date         TEXT    NOT NULL,
  hour_number  INTEGER NOT NULL,
  opened_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  closed_at    TEXT,
  status       TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  UNIQUE(subject_id, faculty_id, date, hour_number)
);

-- ============================================================
-- LEAVE MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL REFERENCES users(id),
  applicant_type TEXT NOT NULL CHECK(applicant_type IN ('student','teacher')),
  leave_type   TEXT NOT NULL CHECK(leave_type IN ('Medical','Personal','OD','Emergency','Other')),
  from_date    TEXT NOT NULL,
  to_date      TEXT NOT NULL,
  reason       TEXT NOT NULL,
  document_path TEXT,
  subjects_affected TEXT,                  -- JSON array of subject IDs
  status       TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
  applied_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by  INTEGER REFERENCES users(id),
  reviewed_at  TEXT,
  review_remarks TEXT
);

-- ============================================================
-- NOTIFICATIONS / WARNINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  type         TEXT    NOT NULL DEFAULT 'info' CHECK(type IN ('info','warning','danger','success')),
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Attendance warning log
CREATE TABLE IF NOT EXISTS attendance_warnings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  subject_id   INTEGER REFERENCES subjects(id),        -- NULL = overall warning
  percentage   REAL    NOT NULL,
  sent_via     TEXT    NOT NULL DEFAULT 'system',      -- system, whatsapp, email
  sent_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  sent_by      INTEGER REFERENCES users(id)
);

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings(key,value) VALUES
  ('attendance_threshold','75'),
  ('warning_threshold','70'),
  ('critical_threshold','60'),
  ('college_name','Excellence College of Engineering & Technology'),
  ('academic_year','2024-2025'),
  ('current_semester','5');

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Users
INSERT OR IGNORE INTO users(user_id,password,role,name,email,phone) VALUES
  ('ADMIN001','$2b$10$hashedpassword1','admin','Dr. S. Rajendran','admin@excellence.edu','9876543210'),
  ('HOD001','$2b$10$hashedpassword2','hod','Dr. M. Krishnamurthy','hod.cse@excellence.edu','9876543211'),
  ('TCH001','$2b$10$hashedpassword3','teacher','Dr. Kavitha Rajan','kavitha@excellence.edu','9876543212'),
  ('TCH002','$2b$10$hashedpassword4','teacher','Prof. Suresh Kumar','suresh@excellence.edu','9876543213'),
  ('STU001','$2b$10$hashedpassword5','student','Arjun R.','arjun@excellence.edu','9876543214'),
  ('STU002','$2b$10$hashedpassword6','student','Priya S.','priya@excellence.edu','9876543215');

-- Department
INSERT OR IGNORE INTO departments(code,name) VALUES
  ('CSE','Computer Science & Engineering'),
  ('ECE','Electronics & Communication'),
  ('MECH','Mechanical Engineering'),
  ('CIVIL','Civil Engineering');

-- Subjects (CSE Sem 5)
INSERT OR IGNORE INTO subjects(code,name,department_id,semester,credits,subject_type) VALUES
  ('CS301','Data Structures & Algorithms',1,5,4,'Theory'),
  ('CS302','Database Management Systems',1,5,4,'Theory'),
  ('CS303','Computer Networks',1,5,3,'Theory'),
  ('CS304','Operating Systems',1,5,3,'Theory'),
  ('MA301','Mathematics III',1,5,3,'Theory'),
  ('CS305','DBMS Lab',1,5,2,'Lab'),
  ('CS306','Networks Lab',1,5,2,'Lab');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance(subject_id);
CREATE INDEX IF NOT EXISTS idx_leave_applicant    ON leave_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_notif_user         ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_student ON enrollments(student_id);

-- ============================================================
-- VIEWS
-- ============================================================

-- Student attendance summary per subject
CREATE VIEW IF NOT EXISTS v_student_subject_attendance AS
SELECT
  s.id AS student_id,
  u.name AS student_name,
  s.roll_number,
  sub.id AS subject_id,
  sub.code AS subject_code,
  sub.name AS subject_name,
  sub.subject_type,
  COUNT(a.id) AS total_classes,
  SUM(CASE WHEN a.status IN ('Present','OD','Leave') THEN 1 ELSE 0 END) AS attended,
  ROUND(
    100.0 * SUM(CASE WHEN a.status IN ('Present','OD','Leave') THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id),0),
    2
  ) AS percentage
FROM students s
JOIN users u ON s.user_id = u.id
JOIN enrollments e ON e.student_id = s.id
JOIN subjects sub ON e.subject_id = sub.id
LEFT JOIN attendance a ON a.student_id = s.id AND a.subject_id = sub.id
GROUP BY s.id, sub.id;

-- Department attendance overview
CREATE VIEW IF NOT EXISTS v_department_attendance AS
SELECT
  d.code AS dept_code,
  d.name AS dept_name,
  COUNT(DISTINCT s.id) AS total_students,
  ROUND(AVG(
    100.0 * (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status IN ('Present','OD','Leave'))
    / NULLIF((SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id), 0)
  ), 2) AS avg_attendance
FROM departments d
JOIN students s ON s.department_id = d.id
GROUP BY d.id;
