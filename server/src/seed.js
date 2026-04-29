require("dotenv").config();
const { connectDB } = require("./config/db");
const Attendance = require("./models/Attendance");
const Department = require("./models/Department");
const Faculty = require("./models/Faculty");
const Holiday = require("./models/Holiday");
const Notification = require("./models/Notification");
const Setting = require("./models/Setting");
const Student = require("./models/Student");
const Subject = require("./models/Subject");
const Timetable = require("./models/Timetable");
const User = require("./models/User");
const { departments, getUserSeeds, setting, subjectCatalog } = require("./data/seedData");

function getSectionForStudent(index) {
  if (index <= 15) return "A";
  if (index <= 30) return "B";
  return "C";
}

function getRollNumber(departmentCode, year, studentIndex) {
  return `${String(20 + year).padStart(2, "0")}${departmentCode}${String(studentIndex).padStart(3, "0")}`.replace(
    /[^A-Z0-9]/g,
    ""
  );
}

async function runSeed() {
  await connectDB();
  await Promise.all([
    Attendance.deleteMany({}),
    Holiday.deleteMany({}),
    Notification.deleteMany({}),
    Subject.deleteMany({}),
    Student.deleteMany({}),
    Faculty.deleteMany({}),
    Department.deleteMany({}),
    User.deleteMany({}),
    Setting.deleteMany({}),
    Timetable.deleteMany({}),
  ]);

  const departmentDocs = await Department.insertMany(departments);
  const users = await User.insertMany(await getUserSeeds());

  const departmentByCode = Object.fromEntries(departmentDocs.map((department) => [department.code, department]));
  const userByUsername = Object.fromEntries(users.map((user) => [user.username, user]));

  const facultyRows = [];
  const studentRows = [];
  const subjectRows = [];

  for (const department of departments) {
    const code = department.code;
    const codeLower = code.toLowerCase();
    const departmentDoc = departmentByCode[code];

    const hodUser = userByUsername[`hod.${codeLower}`];
    departmentDoc.hod = hodUser._id;
    await departmentDoc.save();

    facultyRows.push({
      user: hodUser._id,
      name: hodUser.name,
      employeeId: `HOD-${code}`,
      department: departmentDoc._id,
      subjectExpertise: [`${code} Leadership`, `${code} Advanced Systems`],
      designation: "Professor & HOD",
    });

    for (let facultyIndex = 1; facultyIndex <= 10; facultyIndex += 1) {
      const user = userByUsername[`faculty.${codeLower}.${String(facultyIndex).padStart(2, "0")}`];
      facultyRows.push({
        user: user._id,
        name: user.name,
        employeeId: `FAC-${code}-${String(facultyIndex).padStart(2, "0")}`,
        department: departmentDoc._id,
        subjectExpertise: [`${code} Systems ${facultyIndex}`, `${code} Lab ${facultyIndex}`],
        designation: facultyIndex <= 3 ? "Associate Professor" : "Assistant Professor",
      });
    }

    for (let year = 1; year <= 4; year += 1) {
      for (let studentIndex = 1; studentIndex <= 45; studentIndex += 1) {
        const username = `student.${codeLower}.${year}.${String(studentIndex).padStart(3, "0")}`;
        const user = userByUsername[username];
        studentRows.push({
          user: user._id,
          name: user.name,
          rollNumber: getRollNumber(code, year, studentIndex),
          department: departmentDoc._id,
          year,
          section: getSectionForStudent(studentIndex),
          email: user.email,
          phone: user.phone,
          guardianName: `${code} Parent ${String(studentIndex).padStart(3, "0")}`,
          guardianPhone: `9000${String(year).padStart(1, "0")}${String(studentIndex).padStart(5, "0")}`,
        });
      }
    }
  }

  const facultyDocs = await Faculty.insertMany(facultyRows);
  const studentDocs = await Student.insertMany(studentRows);

  const facultyByDepartment = {};
  facultyDocs.forEach((faculty) => {
    const parts = faculty.employeeId.split("-");
    const deptCode = parts[1];
    facultyByDepartment[deptCode] ||= [];
    facultyByDepartment[deptCode].push(faculty);
  });

  for (const department of departments) {
    const code = department.code;
    const departmentDoc = departmentByCode[code];
    const teachers = facultyByDepartment[code];

    for (let year = 1; year <= 4; year += 1) {
      for (const section of ["A", "B", "C"]) {
        (subjectCatalog[code]?.[year] || []).forEach((label, subjectIndex) => {
          subjectRows.push({
            name: label,
            code: `${code}${year}${section}${String(subjectIndex + 1).padStart(2, "0")}`,
            department: departmentDoc._id,
            year,
            semester: year * 2 - 1,
            section,
            faculty: teachers[(year + subjectIndex + section.charCodeAt(0)) % teachers.length]._id,
          });
        });
      }
    }
  }

  const subjectDocs = await Subject.insertMany(subjectRows);

  const studentsByGroup = {};
  studentDocs.forEach((student) => {
    const departmentCode = departments.find((department) => String(departmentByCode[department.code]._id) === String(student.department))?.code;
    const key = `${departmentCode}-${student.year}-${student.section}`;
    studentsByGroup[key] ||= [];
    studentsByGroup[key].push(student);
  });

  const attendanceRows = [];
  const timetableRows = [];
  const today = new Date();
  for (let dayOffset = 0; dayOffset < 12; dayOffset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const iso = date.toISOString().slice(0, 10);

    subjectDocs.forEach((subject, subjectIndex) => {
      const departmentCode = departments.find(
        (department) => String(departmentByCode[department.code]._id) === String(subject.department)
      )?.code;
      const groupKey = `${departmentCode}-${subject.year}-${subject.section}`;
      const eligibleStudents = studentsByGroup[groupKey] || [];

      if (!eligibleStudents.length) return;

      attendanceRows.push({
        date: iso,
        department: subject.department,
        subject: subject._id,
        faculty: subject.faculty,
        year: subject.year,
        section: subject.section,
        notes: dayOffset % 4 === 0 ? "Internal review day" : "Regular working day",
        entries: eligibleStudents.map((student, studentIndex) => ({
          student: student._id,
          status:
            (dayOffset + studentIndex + subjectIndex + subject.year) % 9 === 0
              ? "absent"
              : (dayOffset + studentIndex + subjectIndex) % 5 === 0
                ? "late"
                : "present",
        })),
      });
    });
  }

  await Attendance.insertMany(attendanceRows);
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const slotTimes = [
    ["09:00", "09:50"],
    ["09:50", "10:40"],
    ["11:00", "11:50"],
    ["11:50", "12:40"],
    ["01:30", "02:20"],
    ["02:20", "03:10"],
  ];

  const subjectsByClass = {};
  subjectDocs.forEach((subject) => {
    const departmentCode = departments.find(
      (department) => String(departmentByCode[department.code]._id) === String(subject.department)
    )?.code;
    const key = `${departmentCode}-${subject.year}-${subject.section}`;
    subjectsByClass[key] ||= [];
    subjectsByClass[key].push(subject);
  });

  Object.entries(subjectsByClass).forEach(([key, classSubjects]) => {
    const [, year, section] = key.split("-");
    dayNames.forEach((day, dayIndex) => {
      slotTimes.forEach((slot, slotIndex) => {
        const subject = classSubjects[(dayIndex + slotIndex) % classSubjects.length];
        timetableRows.push({
          department: subject.department,
          subject: subject._id,
          faculty: subject.faculty,
          year: Number(year),
          section,
          day,
          startTime: slot[0],
          endTime: slot[1],
          room: `R-${year}${section}-${slotIndex + 1}`,
        });
      });
    });
  });

  await Timetable.insertMany(timetableRows);
  await Holiday.insertMany([
    { title: "May Day", date: "2026-05-01", description: "College holiday", type: "public" },
    { title: "Faculty Development Day", date: "2026-05-15", description: "No regular classes", type: "college" },
    { title: "Semester Break", date: "2026-06-01", description: "Planned semester break", type: "semester" },
  ]);
  await Setting.create(setting);
  await Promise.all([
    User.syncIndexes(),
    Department.syncIndexes(),
    Faculty.syncIndexes(),
    Student.syncIndexes(),
    Subject.syncIndexes(),
    Attendance.syncIndexes(),
    Timetable.syncIndexes(),
  ]);

  console.log("Seed completed successfully.");
  console.log("Admin login: admin / Admin@123");
  console.log("HOD logins: hod.cse, hod.ece, hod.eee, hod.mech, hod.civil, hod.it / Hod@1234");
  console.log("Faculty login pattern: faculty.<dept>.<01-10> / Faculty@123");
  console.log("Student login pattern: student.<dept>.<year>.<001-045> / Student@123");
  console.log("Examples:");
  console.log("  hod.cse / Hod@1234");
  console.log("  faculty.cse.01 / Faculty@123");
  console.log("  student.cse.1.001 / Student@123");
  console.log("  student.it.4.045 / Student@123");
  process.exit(0);
}

/*runSeed().catch((error) => {
  console.error(error);
  process.exit(1);
});*/
module.exports = runSeed;
