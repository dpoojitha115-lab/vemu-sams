const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sams_secret_2026';
const SALT_ROUNDS = 10;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'attendance.db');
const SCHEMA_PATH = path.join(ROOT, 'schema.sql');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(ROOT));

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
`);

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

function ok(res, data) {
  res.json({ success: true, data });
}

function err(res, message, status = 400) {
  res.status(status).json({ success: false, error: message });
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, user_id: user.user_id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return err(res, 'Unauthorized', 401);
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    err(res, 'Invalid token', 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return err(res, 'Forbidden', 403);
    }
    next();
  };
}

function getUserDepartmentCode(userId) {
  const hodDept = db.prepare(
    'SELECT code FROM departments WHERE hod_id = ?'
  ).get(userId);
  if (hodDept?.code) return hodDept.code;

  const facultyDept = db.prepare(
    `SELECT d.code
     FROM faculty f
     JOIN departments d ON d.id = f.department_id
     WHERE f.user_id = ?`
  ).get(userId);
  if (facultyDept?.code) return facultyDept.code;

  const studentDept = db.prepare(
    `SELECT d.code
     FROM students s
     JOIN departments d ON d.id = s.department_id
     WHERE s.user_id = ?`
  ).get(userId);
  return studentDept?.code || null;
}

function getAttendanceThreshold() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'attendance_threshold'").get();
  return Number(row?.value || 75);
}

function resolveUserByLogin(loginId) {
  const normalized = String(loginId || '').trim().toUpperCase();
  if (!normalized) return null;
  const direct = db.prepare('SELECT * FROM users WHERE UPPER(user_id) = ? AND is_active = 1').get(normalized);
  if (direct) return direct;

  const studentLink = db.prepare(
    `SELECT s.user_id
     FROM students s
     JOIN users u ON u.id = s.user_id
     WHERE UPPER(s.roll_number) = ? AND u.is_active = 1`
  ).get(normalized);
  if (!studentLink?.user_id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(studentLink.user_id) || null;
}

function ensureSeedData() {
  const demoPasswords = [
    ['ADMIN001', 'admin123'],
    ['HOD001', 'hod123'],
    ['TCH001', 'teach123'],
    ['TCH002', 'teach123'],
    ['STU001', 'stu123'],
    ['STU002', 'stu123']
  ];

  const updatePassword = db.prepare('UPDATE users SET password = ? WHERE user_id = ?');
  for (const [userId, plain] of demoPasswords) {
    updatePassword.run(bcrypt.hashSync(plain, SALT_ROUNDS), userId);
  }

  const users = Object.fromEntries(
    db.prepare('SELECT id, user_id FROM users').all().map((row) => [row.user_id, row.id])
  );

  db.prepare('UPDATE departments SET hod_id = ? WHERE code = ?').run(users.HOD001, 'CSE');

  const insertFaculty = db.prepare(`
    INSERT OR IGNORE INTO faculty(user_id, employee_id, department_id, designation, qualification)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertFaculty.run(users.TCH001, 'TCH001', 1, 'Assistant Professor', 'PhD');
  insertFaculty.run(users.TCH002, 'TCH002', 2, 'Associate Professor', 'M.Tech');

  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students(user_id, roll_number, department_id, semester, section, batch, parent_phone, parent_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStudent.run(users.STU001, '21CS001', 1, 5, 'A', '2022-2026', '9876500001', 'parent1@example.com');
  insertStudent.run(users.STU002, '21CS002', 1, 5, 'A', '2022-2026', '9876500002', 'parent2@example.com');

  const facultyIds = Object.fromEntries(
    db.prepare('SELECT id, employee_id FROM faculty').all().map((row) => [row.employee_id, row.id])
  );
  const subjectIds = Object.fromEntries(
    db.prepare('SELECT id, code FROM subjects').all().map((row) => [row.code, row.id])
  );
  const studentIds = Object.fromEntries(
    db.prepare('SELECT id, roll_number FROM students').all().map((row) => [row.roll_number, row.id])
  );

  const mapFaculty = db.prepare(`
    INSERT OR IGNORE INTO subject_faculty(subject_id, faculty_id, section)
    VALUES (?, ?, ?)
  `);
  mapFaculty.run(subjectIds.CS301, facultyIds.TCH001, 'A');
  mapFaculty.run(subjectIds.CS302, facultyIds.TCH001, 'A');
  mapFaculty.run(subjectIds.CS303, facultyIds.TCH001, 'A');
  mapFaculty.run(subjectIds.CS304, facultyIds.TCH002, 'A');
  mapFaculty.run(subjectIds.CS305, facultyIds.TCH001, 'A');

  const enroll = db.prepare(`
    INSERT OR IGNORE INTO enrollments(student_id, subject_id)
    VALUES (?, ?)
  `);
  for (const rollNumber of ['21CS001', '21CS002']) {
    for (const subjectCode of ['CS301', 'CS302', 'CS303', 'CS304', 'CS305']) {
      enroll.run(studentIds[rollNumber], subjectIds[subjectCode]);
    }
  }

  const insertTimetable = db.prepare(`
    INSERT OR IGNORE INTO timetable(
      subject_id, faculty_id, department_id, section, semester, day_of_week, hour_number, start_time, end_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTimetable.run(subjectIds.CS301, facultyIds.TCH001, 1, 'A', 5, 'Monday', 1, '09:00', '10:00');
  insertTimetable.run(subjectIds.CS302, facultyIds.TCH001, 1, 'A', 5, 'Tuesday', 2, '10:00', '11:00');
  insertTimetable.run(subjectIds.CS303, facultyIds.TCH001, 1, 'A', 5, 'Wednesday', 3, '11:00', '12:00');
  insertTimetable.run(subjectIds.CS304, facultyIds.TCH002, 1, 'A', 5, 'Thursday', 4, '12:00', '13:00');
  insertTimetable.run(subjectIds.CS305, facultyIds.TCH001, 1, 'A', 5, 'Friday', 5, '14:00', '16:00');

  const attendanceCount = db.prepare('SELECT COUNT(*) AS count FROM attendance').get().count;
  if (!attendanceCount) {
    const insertAttendance = db.prepare(`
      INSERT OR IGNORE INTO attendance(
        student_id, subject_id, faculty_id, date, hour_number, status, marked_by, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date();
    const statusMatrix = {
      '21CS001': ['Present', 'Present', 'Present', 'OD', 'Present', 'Present', 'Leave', 'Present', 'Present', 'Present'],
      '21CS002': ['Absent', 'Present', 'Absent', 'Present', 'Present', 'Absent', 'Present', 'Present', 'Absent', 'Present']
    };
    const subjectCodes = ['CS301', 'CS302', 'CS303', 'CS304', 'CS305'];
    for (let dayOffset = 0; dayOffset < 10; dayOffset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - dayOffset - 1);
      const iso = date.toISOString().slice(0, 10);
      for (const subjectCode of subjectCodes) {
        const facultyId = subjectCode === 'CS304' ? facultyIds.TCH002 : facultyIds.TCH001;
        for (const rollNumber of ['21CS001', '21CS002']) {
          const status = statusMatrix[rollNumber][dayOffset];
          insertAttendance.run(
            studentIds[rollNumber],
            subjectIds[subjectCode],
            facultyId,
            iso,
            ((dayOffset % 5) + 1),
            status,
            subjectCode === 'CS304' ? users.TCH002 : users.TCH001,
            null
          );
        }
      }
    }
  }

  const leaveCount = db.prepare('SELECT COUNT(*) AS count FROM leave_applications').get().count;
  if (!leaveCount) {
    db.prepare(`
      INSERT INTO leave_applications(applicant_id, applicant_type, leave_type, from_date, to_date, reason, status)
      VALUES (?, 'student', 'Medical', date('now', '+1 day'), date('now', '+2 day'), 'Fever and rest advised', 'Pending')
    `).run(users.STU001);
    db.prepare(`
      INSERT INTO leave_applications(applicant_id, applicant_type, leave_type, from_date, to_date, reason, status)
      VALUES (?, 'teacher', 'OD', date('now', '+3 day'), date('now', '+3 day'), 'Industry visit coordination', 'Pending')
    `).run(users.TCH001);
  }
}

ensureSeedData();

function buildDepartmentSummary(deptCode) {
  const baseWhere = deptCode ? 'WHERE d.code = ?' : '';
  const params = deptCode ? [deptCode] : [];

  const departments = db.prepare(
    `SELECT d.code, d.name,
            COUNT(DISTINCT s.id) AS total_students,
            ROUND(AVG(COALESCE(v.percentage, 0)), 2) AS avg_attendance
     FROM departments d
     LEFT JOIN students s ON s.department_id = d.id
     LEFT JOIN v_student_subject_attendance v ON v.student_id = s.id
     ${baseWhere}
     GROUP BY d.id
     ORDER BY d.code`
  ).all(...params);

  const semesters = db.prepare(
    `SELECT s.semester,
            ROUND(AVG(COALESCE(v.percentage, 0)), 2) AS avg_attendance,
            COUNT(DISTINCT s.id) AS students
     FROM students s
     JOIN departments d ON d.id = s.department_id
     LEFT JOIN v_student_subject_attendance v ON v.student_id = s.id
     ${baseWhere}
     GROUP BY s.semester
     ORDER BY s.semester`
  ).all(...params);

  return { departments, semesters };
}

app.post('/api/auth/login', async (req, res) => {
  const { user_id: userId, password, department_code: departmentCode } = req.body;
  if (!userId || !password) {
    return err(res, 'User ID and password are required.');
  }

  const user = resolveUserByLogin(userId);
  if (!user) {
    return err(res, 'Invalid credentials', 401);
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return err(res, 'Invalid credentials', 401);
  }

  if (user.role === 'hod') {
    const actualDept = getUserDepartmentCode(user.id);
    if (!departmentCode) {
      return err(res, 'Please select your department for HOD login.', 400);
    }
    if (String(departmentCode).toUpperCase() !== String(actualDept || '').toUpperCase()) {
      return err(res, `This HOD account belongs to ${actualDept || 'another'} department.`, 403);
    }
  }

  db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
  ok(res, {
    token: signToken(user),
    user: {
      id: user.id,
      user_id: user.user_id,
      role: user.role,
      name: user.name,
      email: user.email
    }
  });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { user_id: userId, email } = req.body;
  if (!userId) {
    return err(res, 'User ID is required.');
  }

  const user = resolveUserByLogin(userId);
  if (!user) {
    return err(res, 'User not found.', 404);
  }
  if (email && user.email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
    return err(res, 'Email does not match our records.', 400);
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const previewUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

  db.prepare('UPDATE password_resets SET used_at = datetime(\'now\') WHERE user_id = ? AND used_at IS NULL').run(user.id);
  db.prepare(
    'INSERT INTO password_resets(user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, token, expiresAt);
  db.prepare(
    `INSERT INTO notifications(user_id, title, message, type)
     VALUES (?, ?, ?, ?)`
  ).run(user.id, 'Password Reset', 'A password reset request was created for your account.', 'info');

  ok(res, {
    message: `Reset link prepared for ${user.email || user.user_id}.`,
    delivery_mode: 'preview',
    reset_link: previewUrl
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    return err(res, 'Valid token and password are required.');
  }

  const reset = db.prepare(
    `SELECT * FROM password_resets
     WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`
  ).get(token);
  if (!reset) {
    return err(res, 'Reset link is invalid or expired.', 400);
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, reset.user_id);
  db.prepare('UPDATE password_resets SET used_at = datetime(\'now\') WHERE id = ?').run(reset.id);

  ok(res, { message: 'Password updated successfully.' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare(
    'SELECT id, user_id, role, name, email, phone FROM users WHERE id = ?'
  ).get(req.user.id);
  ok(res, user);
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  ok(res, { message: 'Logged out.' });
});

app.get('/api/public/departments', (req, res) => {
  const departments = db.prepare(
    'SELECT code, name FROM departments ORDER BY code'
  ).all();
  ok(res, departments);
});

app.get('/api/dashboard/stats', authenticate, authorize('admin'), (req, res) => {
  ok(res, {
    total_students: db.prepare('SELECT COUNT(*) AS count FROM students').get().count,
    total_faculty: db.prepare('SELECT COUNT(*) AS count FROM faculty').get().count,
    total_subjects: db.prepare('SELECT COUNT(*) AS count FROM subjects').get().count,
    total_departments: db.prepare('SELECT COUNT(*) AS count FROM departments').get().count,
    pending_leaves: db.prepare("SELECT COUNT(*) AS count FROM leave_applications WHERE status = 'Pending'").get().count
  });
});

app.get('/api/departments', authenticate, (req, res) => {
  const departments = db.prepare(
    `SELECT d.id, d.code, d.name, d.hod_id, u.name AS hod_name
     FROM departments d
     LEFT JOIN users u ON u.id = d.hod_id
     ORDER BY d.code`
  ).all();
  ok(res, departments);
});

app.get('/api/subjects', authenticate, (req, res) => {
  const dept = req.query.dept;
  const semester = req.query.semester;
  let sql = `
    SELECT s.*, d.code AS dept_code, d.name AS dept_name
    FROM subjects s
    JOIN departments d ON d.id = s.department_id
    WHERE 1 = 1
  `;
  const params = [];
  if (dept) {
    sql += ' AND d.code = ?';
    params.push(dept);
  }
  if (semester) {
    sql += ' AND s.semester = ?';
    params.push(Number(semester));
  }
  sql += ' ORDER BY s.code';
  ok(res, db.prepare(sql).all(...params));
});

app.get('/api/students', authenticate, authorize('admin', 'hod', 'teacher'), (req, res) => {
  const { dept, semester, section, search } = req.query;
  let sql = `
    SELECT s.id, s.roll_number, s.semester, s.section, s.batch,
           u.name, u.email, u.phone, u.user_id,
           d.code AS dept_code, d.name AS dept_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    WHERE 1 = 1
  `;
  const params = [];
  if (dept) {
    sql += ' AND d.code = ?';
    params.push(dept);
  }
  if (semester) {
    sql += ' AND s.semester = ?';
    params.push(Number(semester));
  }
  if (section) {
    sql += ' AND s.section = ?';
    params.push(section);
  }
  if (search) {
    sql += ' AND (u.name LIKE ? OR s.roll_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY s.roll_number';
  ok(res, db.prepare(sql).all(...params));
});

app.post('/api/students', authenticate, authorize('admin'), async (req, res) => {
  const {
    name,
    email,
    phone,
    roll_number: rollNumber,
    department_id: departmentId,
    semester,
    section,
    batch,
    plain_password: plainPassword
  } = req.body;

  if (!name || !rollNumber || !departmentId) {
    return err(res, 'Name, roll number, and department are required.');
  }

  const password = await bcrypt.hash(plainPassword || 'student123', SALT_ROUNDS);
  const userId = rollNumber.toUpperCase();

  try {
    const userResult = db.prepare(
      'INSERT INTO users(user_id, password, role, name, email, phone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, password, 'student', name, email || null, phone || null);

    db.prepare(
      `INSERT INTO students(user_id, roll_number, department_id, semester, section, batch)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userResult.lastInsertRowid, rollNumber, Number(departmentId), Number(semester || 1), section || 'A', batch || '');

    ok(res, { message: 'Student created successfully.', user_id: userId });
  } catch (error) {
    err(res, error.message);
  }
});

app.get('/api/faculty', authenticate, authorize('admin', 'hod'), (req, res) => {
  const dept = req.query.dept;
  let sql = `
    SELECT f.id, f.employee_id, f.designation, f.qualification,
           u.name, u.email, u.phone, u.user_id,
           d.code AS dept_code, d.name AS dept_name
    FROM faculty f
    JOIN users u ON u.id = f.user_id
    JOIN departments d ON d.id = f.department_id
    WHERE 1 = 1
  `;
  const params = [];
  if (dept) {
    sql += ' AND d.code = ?';
    params.push(dept);
  }
  sql += ' ORDER BY u.name';
  ok(res, db.prepare(sql).all(...params));
});

app.post('/api/faculty', authenticate, authorize('admin'), async (req, res) => {
  const {
    name,
    email,
    phone,
    employee_id: employeeId,
    department_id: departmentId,
    designation,
    qualification,
    role,
    plain_password: plainPassword
  } = req.body;

  if (!name || !employeeId || !departmentId) {
    return err(res, 'Name, employee ID, and department are required.');
  }

  const userRole = role === 'hod' ? 'hod' : 'teacher';
  const password = await bcrypt.hash(plainPassword || 'teach123', SALT_ROUNDS);

  try {
    const userResult = db.prepare(
      'INSERT INTO users(user_id, password, role, name, email, phone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(employeeId, password, userRole, name, email || null, phone || null);

    db.prepare(
      `INSERT INTO faculty(user_id, employee_id, department_id, designation, qualification)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userResult.lastInsertRowid, employeeId, Number(departmentId), designation || '', qualification || '');

    if (userRole === 'hod') {
      db.prepare('UPDATE departments SET hod_id = ? WHERE id = ?').run(userResult.lastInsertRowid, Number(departmentId));
    }

    ok(res, { message: 'Faculty member created successfully.', user_id: employeeId });
  } catch (error) {
    err(res, error.message);
  }
});

app.get('/api/attendance/summary/me', authenticate, authorize('student'), (req, res) => {
  const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
  if (!student) {
    return err(res, 'Student not found.', 404);
  }
  const subjects = db.prepare(
    'SELECT * FROM v_student_subject_attendance WHERE student_id = ? ORDER BY subject_code'
  ).all(student.id);
  const overall = subjects.length
    ? Math.round(subjects.reduce((sum, row) => sum + (row.percentage || 0), 0) / subjects.length)
    : 0;
  ok(res, { overall, subjects });
});

app.get('/api/attendance/me', authenticate, authorize('student'), (req, res) => {
  const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
  if (!student) {
    return err(res, 'Student not found.', 404);
  }
  const records = db.prepare(
    `SELECT a.date, a.hour_number, a.status, a.remarks,
            sub.code AS subject_code, sub.name AS subject_name,
            u.name AS faculty_name
     FROM attendance a
     JOIN subjects sub ON sub.id = a.subject_id
     JOIN faculty f ON f.id = a.faculty_id
     JOIN users u ON u.id = f.user_id
     WHERE a.student_id = ?
     ORDER BY a.date DESC, a.hour_number DESC
     LIMIT 40`
  ).all(student.id);
  ok(res, records);
});

app.get('/api/attendance/summary/:studentId', authenticate, authorize('admin', 'hod', 'teacher'), (req, res) => {
  ok(res, db.prepare(
    'SELECT * FROM v_student_subject_attendance WHERE student_id = ? ORDER BY subject_code'
  ).all(req.params.studentId));
});

app.get('/api/attendance/department', authenticate, authorize('admin', 'hod'), (req, res) => {
  ok(res, buildDepartmentSummary(req.query.dept || null));
});

app.get('/api/attendance/low', authenticate, authorize('admin', 'hod', 'teacher'), (req, res) => {
  const threshold = Number(req.query.threshold || getAttendanceThreshold());
  const dept = req.query.dept;
  let sql = `
    SELECT v.student_id, v.student_name, v.roll_number,
           ROUND(AVG(v.percentage), 2) AS avg_pct,
           d.code AS dept_code, d.name AS dept_name,
           s.semester, s.section
    FROM v_student_subject_attendance v
    JOIN students s ON s.id = v.student_id
    JOIN departments d ON d.id = s.department_id
    WHERE 1 = 1
  `;
  const params = [];
  if (dept) {
    sql += ' AND d.code = ?';
    params.push(dept);
  }
  sql += `
    GROUP BY v.student_id
    HAVING avg_pct < ?
    ORDER BY avg_pct ASC, v.roll_number ASC
  `;
  params.push(threshold);
  ok(res, db.prepare(sql).all(...params));
});

app.get('/api/attendance/session', authenticate, authorize('teacher'), (req, res) => {
  const { subject_id: subjectId, date, hour } = req.query;
  if (!subjectId || !date) {
    return err(res, 'Subject and date are required.');
  }
  const students = db.prepare(
    `SELECT s.id, s.roll_number, u.name,
            COALESCE(a.status, 'Absent') AS status, a.remarks
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN attendance a
       ON a.student_id = s.id
      AND a.subject_id = ?
      AND a.date = ?
      AND a.hour_number = ?
     WHERE e.subject_id = ?
     ORDER BY s.roll_number`
  ).all(Number(subjectId), date, Number(hour || 1), Number(subjectId));

  const subject = db.prepare('SELECT id, code, name, semester FROM subjects WHERE id = ?').get(Number(subjectId));
  ok(res, { subject, students });
});

app.post('/api/attendance/mark', authenticate, authorize('teacher'), (req, res) => {
  const { subject_id: subjectId, date, hour_number: hourNumber, records } = req.body;
  if (!subjectId || !date || !Array.isArray(records) || !records.length) {
    return err(res, 'Valid attendance data is required.');
  }

  const faculty = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(req.user.id);
  if (!faculty) {
    return err(res, 'Faculty profile not found.', 404);
  }

  const upsert = db.prepare(`
    INSERT INTO attendance(student_id, subject_id, faculty_id, date, hour_number, status, marked_by, remarks)
    VALUES (@student_id, @subject_id, @faculty_id, @date, @hour_number, @status, @marked_by, @remarks)
    ON CONFLICT(student_id, subject_id, date, hour_number)
    DO UPDATE SET
      status = excluded.status,
      remarks = excluded.remarks,
      marked_at = datetime('now'),
      marked_by = excluded.marked_by
  `);

  const saveMany = db.transaction((items) => {
    for (const item of items) {
      upsert.run({
        student_id: Number(item.student_id),
        subject_id: Number(subjectId),
        faculty_id: faculty.id,
        date,
        hour_number: Number(hourNumber || 1),
        status: item.status || 'Absent',
        marked_by: req.user.id,
        remarks: item.remarks || null
      });
    }
  });

  saveMany(records);
  db.prepare(
    `INSERT OR IGNORE INTO attendance_sessions(subject_id, faculty_id, date, hour_number, status)
     VALUES (?, ?, ?, ?, 'closed')`
  ).run(Number(subjectId), faculty.id, date, Number(hourNumber || 1));

  ok(res, { message: `Attendance saved for ${records.length} students.` });
});

app.get('/api/leaves', authenticate, (req, res) => {
  const { status, dept } = req.query;
  let sql = `
    SELECT l.*, u.name AS applicant_name, u.user_id AS applicant_uid, u.role AS applicant_role
    FROM leave_applications l
    JOIN users u ON u.id = l.applicant_id
    WHERE 1 = 1
  `;
  const params = [];
  if (req.user.role === 'student' || req.user.role === 'teacher') {
    sql += ' AND l.applicant_id = ?';
    params.push(req.user.id);
  }
  if (status) {
    sql += ' AND l.status = ?';
    params.push(status);
  }
  if (dept) {
    sql += ` AND (
      EXISTS (
        SELECT 1
        FROM students s
        JOIN departments d ON d.id = s.department_id
        WHERE s.user_id = l.applicant_id AND d.code = ?
      )
      OR EXISTS (
        SELECT 1
        FROM faculty f
        JOIN departments d ON d.id = f.department_id
        WHERE f.user_id = l.applicant_id AND d.code = ?
      )
    )`;
    params.push(dept, dept);
  }
  sql += ' ORDER BY l.applied_at DESC';
  ok(res, db.prepare(sql).all(...params));
});

app.post('/api/leaves', authenticate, upload.single('document'), (req, res) => {
  const { leave_type: leaveType, from_date: fromDate, to_date: toDate, reason, subjects_affected: subjectsAffected } = req.body;
  if (!leaveType || !fromDate || !toDate || !reason) {
    return err(res, 'Leave type, date range, and reason are required.');
  }
  db.prepare(
    `INSERT INTO leave_applications(
      applicant_id, applicant_type, leave_type, from_date, to_date, reason, document_path, subjects_affected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.id,
    req.user.role === 'student' ? 'student' : 'teacher',
    normaliseLeaveType(leaveType),
    fromDate,
    toDate,
    reason,
    req.file ? req.file.path : null,
    subjectsAffected || null
  );
  ok(res, { message: 'Leave application submitted successfully.' });
});

function normaliseLeaveType(type) {
  const value = String(type).toLowerCase();
  if (value.includes('medical')) return 'Medical';
  if (value.includes('personal')) return 'Personal';
  if (value.includes('od')) return 'OD';
  if (value.includes('emergency')) return 'Emergency';
  return 'Other';
}

app.patch('/api/leaves/:id', authenticate, authorize('admin', 'hod', 'teacher'), (req, res) => {
  const { status, review_remarks: reviewRemarks } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) {
    return err(res, 'Status must be Approved or Rejected.');
  }
  const leave = db.prepare('SELECT * FROM leave_applications WHERE id = ?').get(req.params.id);
  if (!leave) {
    return err(res, 'Leave not found.', 404);
  }
  db.prepare(
    `UPDATE leave_applications
     SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_remarks = ?
     WHERE id = ?`
  ).run(status, req.user.id, reviewRemarks || null, req.params.id);

  db.prepare(
    'INSERT INTO notifications(user_id, title, message, type) VALUES (?, ?, ?, ?)'
  ).run(
    leave.applicant_id,
    `Leave ${status}`,
    `Your leave request from ${leave.from_date} to ${leave.to_date} was ${status.toLowerCase()}.`,
    status === 'Approved' ? 'success' : 'danger'
  );

  ok(res, { message: `Leave ${status.toLowerCase()} successfully.` });
});

app.patch('/api/leaves/:id/cancel', authenticate, (req, res) => {
  const leave = db.prepare(
    'SELECT * FROM leave_applications WHERE id = ? AND applicant_id = ?'
  ).get(req.params.id, req.user.id);
  if (!leave) {
    return err(res, 'Leave not found.', 404);
  }
  if (leave.status !== 'Pending') {
    return err(res, 'Only pending leaves can be cancelled.');
  }
  db.prepare("UPDATE leave_applications SET status = 'Cancelled' WHERE id = ?").run(req.params.id);
  ok(res, { message: 'Leave cancelled successfully.' });
});

app.get('/api/notifications', authenticate, (req, res) => {
  ok(res, db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id));
});

app.post('/api/warnings/send', authenticate, authorize('admin', 'hod', 'teacher'), (req, res) => {
  const { student_ids: studentIds, via, subject_id: subjectId } = req.body;
  if (!Array.isArray(studentIds) || !studentIds.length) {
    return err(res, 'At least one student must be selected.');
  }

  const insertWarning = db.prepare(
    'INSERT INTO attendance_warnings(student_id, subject_id, percentage, sent_via, sent_by) VALUES (?, ?, ?, ?, ?)'
  );

  const sendWarnings = db.transaction((ids) => {
    for (const studentId of ids) {
      const pctRow = subjectId
        ? db.prepare(
          'SELECT percentage FROM v_student_subject_attendance WHERE student_id = ? AND subject_id = ?'
        ).get(studentId, subjectId)
        : db.prepare(
          'SELECT ROUND(AVG(percentage), 2) AS percentage FROM v_student_subject_attendance WHERE student_id = ?'
        ).get(studentId);
      insertWarning.run(studentId, subjectId || null, pctRow?.percentage || 0, via || 'system', req.user.id);

      const student = db.prepare('SELECT user_id FROM students WHERE id = ?').get(studentId);
      if (student) {
        db.prepare(
          'INSERT INTO notifications(user_id, title, message, type) VALUES (?, ?, ?, ?)'
        ).run(
          student.user_id,
          'Attendance Warning',
          'Your attendance is below the required percentage. Please improve it to avoid academic issues.',
          'warning'
        );
      }
    }
  });

  sendWarnings(studentIds);
  ok(res, { message: `Warnings sent to ${studentIds.length} students.` });
});

app.get('/api/settings', authenticate, authorize('admin'), (req, res) => {
  const settings = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value])
  );
  ok(res, settings);
});

app.patch('/api/settings', authenticate, authorize('admin'), (req, res) => {
  const upsert = db.prepare(`
    INSERT INTO settings(key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  const save = db.transaction((payload) => {
    for (const [key, value] of Object.entries(payload)) {
      upsert.run(key, String(value));
    }
  });
  save(req.body || {});
  ok(res, { message: 'Settings updated successfully.' });
});

app.get('/api/timetable', authenticate, (req, res) => {
  const { dept, semester, section } = req.query;
  let sql = `
    SELECT t.*, sub.code AS subject_code, sub.name AS subject_name,
           u.name AS faculty_name, d.code AS dept_code
    FROM timetable t
    JOIN subjects sub ON sub.id = t.subject_id
    JOIN faculty f ON f.id = t.faculty_id
    JOIN users u ON u.id = f.user_id
    JOIN departments d ON d.id = t.department_id
    WHERE 1 = 1
  `;
  const params = [];
  if (dept) {
    sql += ' AND d.code = ?';
    params.push(dept);
  }
  if (semester) {
    sql += ' AND t.semester = ?';
    params.push(Number(semester));
  }
  if (section) {
    sql += ' AND t.section = ?';
    params.push(section);
  }
  sql += ' ORDER BY t.day_of_week, t.hour_number';
  ok(res, db.prepare(sql).all(...params));
});

app.get('/api/admin/overview', authenticate, authorize('admin'), (req, res) => {
  const stats = {
    total_students: db.prepare('SELECT COUNT(*) AS count FROM students').get().count,
    total_faculty: db.prepare('SELECT COUNT(*) AS count FROM faculty').get().count,
    avg_attendance: db.prepare('SELECT ROUND(AVG(percentage), 2) AS avg FROM v_student_subject_attendance').get().avg || 0,
    low_count: db.prepare(
      `SELECT COUNT(*) AS count FROM (
        SELECT student_id
        FROM v_student_subject_attendance
        GROUP BY student_id
        HAVING AVG(percentage) < ?
      )`
    ).get(getAttendanceThreshold()).count,
    total_departments: db.prepare('SELECT COUNT(*) AS count FROM departments').get().count,
    pending_leaves: db.prepare("SELECT COUNT(*) AS count FROM leave_applications WHERE status = 'Pending'").get().count
  };

  ok(res, {
    stats,
    ...buildDepartmentSummary(null),
    students: db.prepare(
      `SELECT s.id, s.roll_number, s.semester, s.section, u.name, d.code AS dept_code
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN departments d ON d.id = s.department_id
       ORDER BY s.roll_number`
    ).all(),
    lowStudents: db.prepare(
      `SELECT student_id, student_name, roll_number, ROUND(AVG(percentage), 2) AS avg_pct
       FROM v_student_subject_attendance
       GROUP BY student_id
       HAVING avg_pct < ?
       ORDER BY avg_pct ASC
       LIMIT 5`
    ).all(getAttendanceThreshold())
  });
});

app.get('/api/hod/overview', authenticate, authorize('admin', 'hod'), (req, res) => {
  const requestedDept = req.query.dept || getUserDepartmentCode(req.user.id) || 'CSE';
  const currentDept = db.prepare('SELECT * FROM departments WHERE code = ?').get(requestedDept);
  if (!currentDept) {
    return err(res, 'Department not found.', 404);
  }

  const stats = {
    total_students: db.prepare(
      'SELECT COUNT(*) AS count FROM students WHERE department_id = ?'
    ).get(currentDept.id).count,
    total_faculty: db.prepare(
      'SELECT COUNT(*) AS count FROM faculty WHERE department_id = ?'
    ).get(currentDept.id).count,
    avg_attendance: db.prepare(
      `SELECT ROUND(AVG(v.percentage), 2) AS avg
       FROM v_student_subject_attendance v
       JOIN students s ON s.id = v.student_id
       WHERE s.department_id = ?`
    ).get(currentDept.id).avg || 0,
    low_count: db.prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT v.student_id
         FROM v_student_subject_attendance v
         JOIN students s ON s.id = v.student_id
         WHERE s.department_id = ?
         GROUP BY v.student_id
         HAVING AVG(v.percentage) < ?
       )`
    ).get(currentDept.id, getAttendanceThreshold()).count,
    pending_leaves: db.prepare(
      `SELECT COUNT(*) AS count
       FROM leave_applications l
       WHERE l.status = 'Pending'
         AND (
           EXISTS (SELECT 1 FROM students s WHERE s.user_id = l.applicant_id AND s.department_id = ?)
           OR EXISTS (SELECT 1 FROM faculty f WHERE f.user_id = l.applicant_id AND f.department_id = ?)
         )`
    ).get(currentDept.id, currentDept.id).count
  };

  const semesters = db.prepare(
    `SELECT s.semester, ROUND(AVG(v.percentage), 2) AS avg_attendance, COUNT(DISTINCT s.id) AS students
     FROM students s
     LEFT JOIN v_student_subject_attendance v ON v.student_id = s.id
     WHERE s.department_id = ?
     GROUP BY s.semester
     ORDER BY s.semester`
  ).all(currentDept.id);

  const facultyStatus = db.prepare(
    `SELECT u.user_id, u.name,
            COUNT(DISTINCT sf.subject_id) AS subjects,
            COUNT(DISTINCT a.date || '-' || a.hour_number || '-' || a.subject_id) AS classes_marked,
            MAX(a.marked_at) AS last_marked
     FROM faculty f
     JOIN users u ON u.id = f.user_id
     LEFT JOIN subject_faculty sf ON sf.faculty_id = f.id
     LEFT JOIN attendance a ON a.faculty_id = f.id AND a.date = date('now')
     WHERE f.department_id = ?
     GROUP BY f.id
     ORDER BY u.name`
  ).all(currentDept.id);

  const students = db.prepare(
    `SELECT s.id, s.roll_number, s.semester, s.section, u.name,
            ROUND(AVG(v.percentage), 2) AS avg_pct
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN v_student_subject_attendance v ON v.student_id = s.id
     WHERE s.department_id = ?
     GROUP BY s.id
     ORDER BY s.roll_number`
  ).all(currentDept.id);

  const lowStudents = db.prepare(
    `SELECT s.id, s.roll_number, s.semester, s.section, u.name,
            ROUND(AVG(v.percentage), 2) AS avg_pct
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN v_student_subject_attendance v ON v.student_id = s.id
     WHERE s.department_id = ?
     GROUP BY s.id
     HAVING avg_pct < ?
     ORDER BY avg_pct ASC`
  ).all(currentDept.id, getAttendanceThreshold());

  const leaves = db.prepare(
    `SELECT l.id, l.leave_type, l.from_date, l.to_date, l.reason, l.status,
            u.name AS applicant_name, u.role AS applicant_role
     FROM leave_applications l
     JOIN users u ON u.id = l.applicant_id
     WHERE (
       EXISTS (SELECT 1 FROM students s WHERE s.user_id = l.applicant_id AND s.department_id = ?)
       OR EXISTS (SELECT 1 FROM faculty f WHERE f.user_id = l.applicant_id AND f.department_id = ?)
     )
     ORDER BY l.applied_at DESC
     LIMIT 20`
  ).all(currentDept.id, currentDept.id);

  ok(res, {
    department: currentDept,
    stats,
    semesters,
    facultyStatus,
    students,
    lowStudents,
    leaves
  });
});

app.get('/api/teacher/overview', authenticate, authorize('teacher'), (req, res) => {
  const faculty = db.prepare(
    `SELECT f.id, f.department_id, u.name
     FROM faculty f
     JOIN users u ON u.id = f.user_id
     WHERE f.user_id = ?`
  ).get(req.user.id);
  if (!faculty) {
    return err(res, 'Faculty profile not found.', 404);
  }

  const subjects = db.prepare(
    `SELECT sub.id, sub.code, sub.name, sub.semester, sf.section,
            COUNT(DISTINCT e.student_id) AS student_count,
            ROUND(AVG(v.percentage), 2) AS avg_pct
     FROM subject_faculty sf
     JOIN subjects sub ON sub.id = sf.subject_id
     LEFT JOIN enrollments e ON e.subject_id = sub.id
     LEFT JOIN v_student_subject_attendance v ON v.subject_id = sub.id
     WHERE sf.faculty_id = ?
     GROUP BY sub.id, sf.section
     ORDER BY sub.code`
  ).all(faculty.id);

  const lowStudents = db.prepare(
    `SELECT s.id, s.roll_number, u.name, sub.code AS subject_code, ROUND(v.percentage, 2) AS percentage
     FROM subject_faculty sf
     JOIN subjects sub ON sub.id = sf.subject_id
     JOIN enrollments e ON e.subject_id = sub.id
     JOIN students s ON s.id = e.student_id
     JOIN users u ON u.id = s.user_id
     JOIN v_student_subject_attendance v ON v.student_id = s.id AND v.subject_id = sub.id
     WHERE sf.faculty_id = ? AND v.percentage < ?
     ORDER BY v.percentage ASC`
  ).all(faculty.id, getAttendanceThreshold());

  ok(res, { faculty, subjects, lowStudents });
});

app.get('/api/student/overview', authenticate, authorize('student'), (req, res) => {
  const student = db.prepare(
    `SELECT s.id, s.roll_number, s.semester, s.section, d.code AS dept_code,
            u.name, u.email
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     WHERE s.user_id = ?`
  ).get(req.user.id);
  if (!student) {
    return err(res, 'Student profile not found.', 404);
  }

  const summary = db.prepare(
    'SELECT * FROM v_student_subject_attendance WHERE student_id = ? ORDER BY subject_code'
  ).all(student.id);
  const records = db.prepare(
    `SELECT a.date, a.hour_number, a.status, sub.code AS subject_code, sub.name AS subject_name
     FROM attendance a
     JOIN subjects sub ON sub.id = a.subject_id
     WHERE a.student_id = ?
     ORDER BY a.date DESC, a.hour_number DESC
     LIMIT 12`
  ).all(student.id);
  const leaves = db.prepare(
    `SELECT id, leave_type, from_date, to_date, status, reason
     FROM leave_applications
     WHERE applicant_id = ?
     ORDER BY applied_at DESC
     LIMIT 10`
  ).all(req.user.id);
  const overall = summary.length
    ? Math.round(summary.reduce((sum, row) => sum + (row.percentage || 0), 0) / summary.length)
    : 0;

  ok(res, {
    student,
    overall,
    summary,
    records,
    leaves,
    threshold: getAttendanceThreshold()
  });
});

app.get('/', (_, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(ROOT, 'admin-dashboard.html')));
app.get('/hod', (_, res) => res.sendFile(path.join(ROOT, 'hod-dashboard.html')));
app.get('/teacher', (_, res) => res.sendFile(path.join(ROOT, 'teacher-dashboard.html')));
app.get('/student', (_, res) => res.sendFile(path.join(ROOT, 'student-dashboard.html')));
app.get('/reset-password', (_, res) => res.redirect('/reset-password.html'));

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});
app.get('/api/seed-now', async (req, res) => {
  const { seedDatabase } = require('./seed');
  await seedDatabase();
  res.json({ message: 'Seeded!' });
});

app.listen(PORT,'0.0.0.0', () => {
  console.log(`SAMS API running on port ${PORT}`);
  //console.log(`SAMS server running at http://localhost:${PORT}`);//
  console.log('Demo logins: ADMIN001/admin123, HOD001/hod123, TCH001/teach123, STU001/stu123');
});

module.exports = app;
