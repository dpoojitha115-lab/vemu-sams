const bcrypt = require("bcryptjs");

const departments = [
  {
    name: "Computer Science and Engineering",
    code: "CSE",
    description: "Advanced computing, software engineering, and AI-focused learning.",
    totalIntake: 240,
  },
  {
    name: "Electronics and Communication Engineering",
    code: "ECE",
    description: "Communication systems, embedded technology, and electronics design.",
    totalIntake: 240,
  },
  {
    name: "Electrical and Electronics Engineering",
    code: "EEE",
    description: "Power systems, control systems, and industrial electronics.",
    totalIntake: 240,
  },
  {
    name: "Mechanical Engineering",
    code: "MECH",
    description: "Manufacturing systems, design, thermodynamics, and automation.",
    totalIntake: 240,
  },
  {
    name: "Civil Engineering",
    code: "CIVIL",
    description: "Infrastructure planning, structural design, and sustainable construction.",
    totalIntake: 240,
  },
  {
    name: "Information Technology",
    code: "IT",
    description: "Enterprise software, data systems, and information security.",
    totalIntake: 240,
  },
];

const setting = {
  collegeName: "VEMU Institute of Technology",
  collegeMotto: "Quality education for bright future.",
  collegeAddress: "P.Kothakota, Near Pakala, Chittoor District, Andhra Pradesh",
  threshold: 75,
  supportEmail: "sams@vemu.edu.in",
};

const accountPasswords = {
  admin: "Admin@123",
  hod: "Hod@1234",
  faculty: "Faculty@123",
  student: "Student@123",
};

const departmentHeads = {
  CSE: "Dr. S. Madhavi",
  ECE: "Dr. K. Lakshmi Devi",
  EEE: "Dr. R. Nageswara Rao",
  MECH: "Dr. M. Srinivasulu",
  CIVIL: "Dr. P. Rajeshwari",
  IT: "Dr. A. Revathi",
};

const subjectCatalog = {
  CSE: {
    1: ["Mathematics-I", "Physics", "Chemistry", "Programming in C", "English", "Engineering Workshop"],
    2: ["Data Structures", "DBMS", "Operating Systems", "Computer Networks", "OOP", "Discrete Mathematics"],
    3: ["Software Engineering", "Web Technologies", "Artificial Intelligence", "Machine Learning", "Cloud Computing", "Compiler Design"],
    4: ["Project", "Elective-1", "Elective-2", "Seminar", "Cyber Security", "Internship Review"],
  },
  ECE: {
    1: ["Mathematics-I", "Physics", "Basic Electronics", "Engineering Graphics", "English", "Chemistry Lab"],
    2: ["Signals and Systems", "Electronic Devices", "Analog Circuits", "Network Theory", "Microcontrollers", "Measurements"],
    3: ["Digital Signal Processing", "VLSI Design", "Communication Systems", "Embedded Systems", "Antenna Theory", "Control Systems"],
    4: ["Project", "Elective-1", "Elective-2", "Seminar", "Wireless Networks", "Internship Review"],
  },
  EEE: {
    1: ["Mathematics-I", "Physics", "Basic Electrical Engineering", "Engineering Mechanics", "English", "Workshop Practice"],
    2: ["Electrical Machines-I", "Power Systems-I", "Control Systems", "Electronic Circuits", "Power Electronics", "Measurements"],
    3: ["Power Systems-II", "Electrical Machines-II", "Utilization of Electrical Energy", "Microprocessors", "Renewable Energy", "Industrial Drives"],
    4: ["Project", "Elective-1", "Elective-2", "Seminar", "Smart Grids", "Internship Review"],
  },
  MECH: {
    1: ["Mathematics-I", "Engineering Physics", "Engineering Chemistry", "Engineering Drawing", "English", "Workshop Practice"],
    2: ["Thermodynamics", "Mechanics of Solids", "Manufacturing Process", "Fluid Mechanics", "Machine Drawing", "Material Science"],
    3: ["Heat Transfer", "Machine Design", "CAD/CAM", "Metrology", "Industrial Engineering", "Dynamics of Machinery"],
    4: ["Project", "Elective-1", "Elective-2", "Seminar", "Automation", "Internship Review"],
  },
  CIVIL: {
    1: ["Mathematics-I", "Engineering Physics", "Engineering Chemistry", "Engineering Graphics", "English", "Environmental Studies"],
    2: ["Strength of Materials", "Surveying", "Fluid Mechanics", "Building Materials", "Geology", "Structural Analysis"],
    3: ["Concrete Technology", "Geotechnical Engineering", "Transportation Engineering", "Hydrology", "Design of Structures", "Water Resources"],
    4: ["Project", "Elective-1", "Elective-2", "Seminar", "Estimation and Costing", "Internship Review"],
  },
  IT: {
    1: ["Mathematics-I", "Physics", "Chemistry", "Programming in C", "English", "IT Workshop"],
    2: ["Data Structures", "Database Systems", "Operating Systems", "Computer Organization", "Java Programming", "Discrete Mathematics"],
    3: ["Web Technologies", "Software Engineering", "Data Mining", "Information Security", "Cloud Computing", "Mobile Computing"],
    4: ["Project", "Elective-1", "Elective-2", "Seminar", "Big Data Analytics", "Internship Review"],
  },
};

async function getUserSeeds() {
  const passwordHashes = {
    admin: await bcrypt.hash(accountPasswords.admin, 10),
    hod: await bcrypt.hash(accountPasswords.hod, 10),
    faculty: await bcrypt.hash(accountPasswords.faculty, 10),
    student: await bcrypt.hash(accountPasswords.student, 10),
  };

  const users = [
    {
      username: "admin",
      password: passwordHashes.admin,
      role: "admin",
      name: "Aparna Reddy",
      email: "admin@vemu.edu.in",
      phone: "9876543200",
      title: "System Administrator",
      departmentCode: "",
    },
  ];

  let phoneCounter = 1;

  for (const department of departments) {
    const code = department.code.toLowerCase();

    users.push({
      username: `hod.${code}`,
      password: passwordHashes.hod,
      role: "hod",
      name: departmentHeads[department.code],
      email: `hod.${code}@vemu.edu.in`,
      phone: `987651${String(phoneCounter++).padStart(4, "0")}`,
      title: "Head of Department",
      departmentCode: department.code,
    });

    for (let facultyIndex = 1; facultyIndex <= 10; facultyIndex += 1) {
      users.push({
        username: `faculty.${code}.${String(facultyIndex).padStart(2, "0")}`,
        password: passwordHashes.faculty,
        role: "faculty",
        name: `${department.code} Faculty ${facultyIndex}`,
        email: `faculty${facultyIndex}.${code}@vemu.edu.in`,
        phone: `987651${String(phoneCounter++).padStart(4, "0")}`,
        title: facultyIndex <= 3 ? "Associate Professor" : "Assistant Professor",
        departmentCode: department.code,
      });
    }

    for (let year = 1; year <= 4; year += 1) {
      for (let studentIndex = 1; studentIndex <= 45; studentIndex += 1) {
        users.push({
          username: `student.${code}.${year}.${String(studentIndex).padStart(3, "0")}`,
          password: passwordHashes.student,
          role: "student",
          name: `${department.code} Student Y${year}-${String(studentIndex).padStart(3, "0")}`,
          email: `student${year}${String(studentIndex).padStart(3, "0")}.${code}@vemu.edu.in`,
          phone: `987651${String(phoneCounter++).padStart(4, "0")}`,
          title: `B.Tech ${department.code} Year ${year}`,
          departmentCode: department.code,
        });
      }
    }
  }

  return users;
}

module.exports = {
  departments,
  setting,
  accountPasswords,
  departmentHeads,
  subjectCatalog,
  getUserSeeds,
};
