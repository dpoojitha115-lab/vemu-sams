import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Mail, PencilLine, RefreshCcw, Upload } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client";
import { DepartmentPie, SubjectBarChart, TrendChart } from "../../components/charts/AttendanceCharts";
import AppShell from "../../components/layout/AppShell";
import Button from "../../components/ui/Button";
import { FormField, SelectInput, TextArea, TextInput } from "../../components/ui/FormField";
import Panel from "../../components/ui/Panel";
import ProgressBar from "../../components/ui/ProgressBar";
import StatCard from "../../components/ui/StatCard";
import { useAuth } from "../../context/AuthContext";

const roleSections = {
  admin: [
    { key: "overview", label: "Command Center" },
    { key: "students", label: "Students" },
    { key: "faculty", label: "Faculty" },
    { key: "subjects", label: "Subjects" },
    { key: "departments", label: "Departments" },
    { key: "reports", label: "Reports" },
    { key: "settings", label: "Settings" },
  ],
  hod: [
    { key: "overview", label: "Department Overview" },
    { key: "analytics", label: "Analytics" },
    { key: "performance", label: "Performance" },
    { key: "reports", label: "Reports" },
  ],
  faculty: [
    { key: "attendance", label: "Attendance" },
    { key: "records", label: "Daily Records" },
    { key: "reports", label: "Reports" },
    { key: "students", label: "Students" },
  ],
  student: [
    { key: "overview", label: "Overview" },
    { key: "subjects", label: "Subjects" },
    { key: "history", label: "History" },
    { key: "reports", label: "Report Download" },
  ],
};

const sectionDescriptions = {
  overview: "Your central view of the latest attendance performance and institutional metrics.",
  students: "Search, filter, and manage student records with department-aware views.",
  faculty: "Manage faculty and HOD accounts with proper department mapping.",
  subjects: "Review and maintain subject allocations and subject-wise attendance insights.",
  departments: "Create and maintain department records and academic ownership.",
  reports: "Generate attendance reports, exports, and intervention data.",
  settings: "Update institutional settings, branding, and your profile.",
  analytics: "Department analytics with chart-based attendance insights.",
  performance: "Student performance tracking and low-attendance intervention.",
  attendance: "Mark attendance by subject, year, section, and date.",
  records: "Review and edit saved attendance sessions.",
  history: "Inspect your day-to-day attendance history.",
};

const initialStudentForm = {
  name: "",
  username: "",
  rollNumber: "",
  department: "",
  year: 1,
  section: "A",
  email: "",
  phone: "",
  guardianName: "",
  guardianPhone: "",
};

const initialFacultyForm = {
  name: "",
  username: "",
  employeeId: "",
  department: "",
  email: "",
  phone: "",
  designation: "Assistant Professor",
  role: "faculty",
};

const initialSubjectForm = {
  name: "",
  code: "",
  department: "",
  year: 1,
  section: "A",
  faculty: "",
};

const initialDepartmentForm = {
  name: "",
  code: "",
  description: "",
  totalIntake: 60,
};

function EmptyState({ message }) {
  return (
    <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
      {message}
    </p>
  );
}

function LoadingState({ label = "Loading workspace..." }) {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-6 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        {label}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    present: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
    late: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    absent: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${map[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function DataTable({ columns, rows, keyField = "_id" }) {
  return (
    <div className="custom-scroll overflow-x-auto rounded-3xl">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, index) => (
            <tr key={row[keyField] || row.id || `${index}-${row.rollNumber || row.student || row.date}`}>
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({ filters, setFilters, departments, lockedDepartment = false, showDepartment = true }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {showDepartment ? (
        <SelectInput
          value={filters.department}
          disabled={lockedDepartment}
          onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}
        >
          <option value="">All Departments</option>
          {departments.map((department) => (
            <option key={department._id} value={department.code}>
              {department.code}
            </option>
          ))}
        </SelectInput>
      ) : null}
      <SelectInput value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}>
        <option value="">All Years</option>
        {[1, 2, 3, 4].map((year) => (
          <option key={year} value={year}>
            Year {year}
          </option>
        ))}
      </SelectInput>
      <SelectInput value={filters.section} onChange={(event) => setFilters((current) => ({ ...current, section: event.target.value }))}>
        <option value="">All Sections</option>
        {["A", "B", "C"].map((section) => (
          <option key={section} value={section}>
            Section {section}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}

function DownloadButton({ label, onClick }) {
  return (
    <Button variant="secondary" onClick={onClick} className="gap-2">
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}

export default function DashboardPage() {
  const { user, setUser } = useAuth();
  const { section } = useParams();
  const navigate = useNavigate();
  const sections = roleSections[user.role] || [];
  const defaultSection = sections[0]?.key || "overview";
  const activeSection = sections.some((item) => item.key === section) ? section : defaultSection;

  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentPagination, setStudentPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [studentListLoading, setStudentListLoading] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [attendanceContext, setAttendanceContext] = useState({ subjects: [], departments: [] });
  const [attendanceSubjects, setAttendanceSubjects] = useState([]);
  const [attendanceSubjectLoading, setAttendanceSubjectLoading] = useState(false);
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [facultySummary, setFacultySummary] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [holidayForm, setHolidayForm] = useState({ title: "", date: "", description: "", type: "college" });
  const [correctionForm, setCorrectionForm] = useState({ attendance: "", requestedStatus: "present", reason: "" });
  const [pdfSubjectFilter, setPdfSubjectFilter] = useState("");
  const [reportDateRange, setReportDateRange] = useState({ from: "", to: "" });
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    department: user.role === "admin" ? "" : user.departmentCode || "",
    year: "",
    section: "",
  });
  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [facultyForm, setFacultyForm] = useState(initialFacultyForm);
  const [subjectForm, setSubjectForm] = useState(initialSubjectForm);
  const [departmentForm, setDepartmentForm] = useState(initialDepartmentForm);
  const [editingStudentId, setEditingStudentId] = useState("");
  const [editingFacultyId, setEditingFacultyId] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState("");
  const [attendanceForm, setAttendanceForm] = useState({
    departmentCode: user.departmentCode || "",
    subjectId: "",
    year: "",
    section: "A",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [attendanceEntryState, setAttendanceEntryState] = useState({});
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", avatar: null });
  const deferredSearch = useDeferredValue(search);
  const studentReportPreview = useMemo(() => {
    const inRangeHistory = (dashboard?.history || []).filter((item) => {
      if (reportDateRange.from && item.date < reportDateRange.from) return false;
      if (reportDateRange.to && item.date > reportDateRange.to) return false;
      return true;
    });

    const subjectMap = new Map();
    inRangeHistory.forEach((item) => {
      if (pdfSubjectFilter && item.subjectCode !== pdfSubjectFilter) return;
      const current = subjectMap.get(item.subjectCode) || {
        subject: item.subject,
        code: item.subjectCode,
        total: 0,
        present: 0,
        absent: 0,
      };
      current.total += 1;
      if (item.status === "absent") current.absent += 1;
      else current.present += 1;
      subjectMap.set(item.subjectCode, current);
    });

    return Array.from(subjectMap.values()).map((item) => ({
      ...item,
      attendance: item.total ? Number(((item.present / item.total) * 100).toFixed(1)) : 0,
    }));
  }, [dashboard?.history, pdfSubjectFilter, reportDateRange.from, reportDateRange.to]);

  useEffect(() => {
    if (section !== activeSection) {
      navigate(`/dashboard/${activeSection}`, { replace: true });
    }
  }, [section, activeSection, navigate]);

  const sectionTitle = sections.find((item) => item.key === activeSection)?.label || "Dashboard";

  const cardRouteMap = useMemo(
    () => ({
      admin: {
        "Total Students": "students",
        "Total Faculty": "faculty",
        Departments: "departments",
        Subjects: "subjects",
      },
      hod: {
        "Total Students": "performance",
        "Total Faculty": "analytics",
        Departments: "analytics",
        Subjects: "reports",
      },
      faculty: {
        "Total Students": "students",
        "Total Faculty": "reports",
        Departments: "reports",
        Subjects: "attendance",
      },
      student: {
        "Overall Attendance": "overview",
        Subjects: "subjects",
        "Attendance Threshold": "reports",
      },
    }),
    []
  );

  const currentDepartmentLabel =
    departments.find((department) => department.code === (filters.department || user.departmentCode))?.name ||
    user.departmentCode ||
    "All Departments";

  const selectedAttendanceSubject = attendanceSubjects.find(
    (item) => item._id === attendanceForm.subjectId
  );

  async function fetchDashboard() {
    const { data } = await api.get("/attendance/dashboard");
    setDashboard(data.data);
  }

  async function fetchProfile() {
    const { data } = await api.get("/attendance/profile");
    setProfile(data.data);
    setProfileForm({
      name: data.data.user.name,
      email: data.data.user.email,
      phone: data.data.user.phone,
      avatar: null,
    });
  }

  async function fetchSettings() {
    const { data } = await api.get("/settings");
    setSettings(data.item);
  }

  async function fetchCollections() {
    const requests = [api.get("/departments")];
    const handlers = [
      (response) => setDepartments(response.data.items),
    ];

    const needSubjects = ["attendance", "subjects", "students"].includes(activeSection) || user.role !== "admin";
    const needReports = ["reports", "performance", "overview", "subjects"].includes(activeSection) || user.role === "student";
    const needAttendanceContext = activeSection === "attendance";
    const needAttendanceRecords = activeSection === "records" || user.role === "student";
    const needStudents = ["students", "attendance"].includes(activeSection) && user.role !== "student";
    const needFaculty = ["faculty", "reports", "analytics", "overview"].includes(activeSection) && (user.role === "admin" || user.role === "hod");
    const needTimetable = ["overview", "attendance"].includes(activeSection) || user.role === "student";
    const needHolidays = activeSection === "settings";
    const needCorrections = activeSection === "settings" || activeSection === "history";

    if (needSubjects) {
      requests.push(api.get("/subjects"));
      handlers.push((response) => setSubjects(response.data.items));
    } else {
      setSubjects([]);
    }

    if (needReports) {
      requests.push(api.get("/attendance/reports", { params: filters }));
      handlers.push((response) => {
        setReports(response.data.data.rows);
        setFacultySummary(response.data.data.facultySummary || []);
      });
    } else {
      setReports([]);
      setFacultySummary([]);
    }

    if (needAttendanceContext) {
      requests.push(api.get("/attendance/context"));
      handlers.push((response) => setAttendanceContext(response.data.data));
    } else {
      setAttendanceContext({ subjects: [], departments: [] });
    }

    if (needAttendanceRecords) {
      requests.push(api.get("/attendance/records", { params: filters }));
      handlers.push((response) => setAttendanceRecords(response.data.items));
    } else {
      setAttendanceRecords([]);
    }

    if (needTimetable) {
      requests.push(api.get("/academic/timetable", { params: filters }));
      handlers.push((response) => setTimetable(response.data.items));
    } else {
      setTimetable([]);
    }

    if (needHolidays) {
      requests.push(api.get("/academic/holidays"));
      handlers.push((response) => setHolidays(response.data.items));
    } else {
      setHolidays([]);
    }

    if (needCorrections) {
      requests.push(api.get("/academic/corrections"));
      handlers.push((response) => setCorrections(response.data.items));
    } else {
      setCorrections([]);
    }

    if (needStudents) {
      setStudentListLoading(true);
      requests.push(
        api.get("/people/students", {
          params: {
            ...filters,
            search: deferredSearch,
            page: studentPagination.page,
            limit: studentPagination.limit,
          },
        })
      );
      handlers.push((response) => {
        setStudents(response.data.items);
        setStudentPagination((current) => ({
          ...current,
          ...(response.data.pagination || current),
        }));
        setStudentListLoading(false);
      });
    } else {
      setStudents([]);
      setStudentListLoading(false);
    }

    if (needFaculty) {
      requests.push(api.get("/people/faculty", { params: { department: filters.department } }));
      handlers.push((response) => setFaculty(response.data.items));
    } else {
      setFaculty([]);
    }

    const responses = await Promise.all(requests);
    responses.forEach((response, index) => handlers[index](response));
  }

  async function bootstrap() {
    setLoading(true);
    setLoadError("");
    try {
      await Promise.all([fetchDashboard(), fetchProfile(), fetchSettings(), fetchCollections()]);
    } catch (error) {
      const message = error.response?.data?.message || "Unable to load dashboard.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    const interval = setInterval(bootstrap, 30000);
    return () => clearInterval(interval);
  }, [user.role]);

  useEffect(() => {
    fetchCollections().catch(() => {});
  }, [activeSection, deferredSearch, filters.department, filters.year, filters.section, studentPagination.page]);

  useEffect(() => {
    setStudentPagination((current) => ({ ...current, page: 1 }));
  }, [deferredSearch, filters.department, filters.year, filters.section]);

  useEffect(() => {
    async function fetchAttendanceSubjects() {
      if (!(user.role === "faculty" || (user.role === "admin" && activeSection === "attendance"))) return;

      if (!attendanceForm.departmentCode || !attendanceForm.year || !attendanceForm.section) {
        setAttendanceSubjects([]);
        setAttendanceStudents([]);
        setAttendanceEntryState({});
        return;
      }

      setAttendanceSubjectLoading(true);

      try {
        const { data } = await api.get("/subjects", {
          params: {
            department: attendanceForm.departmentCode,
            year: attendanceForm.year,
            section: attendanceForm.section,
          },
        });

        console.log("Faculty subjects API response", data.items);
        setAttendanceSubjects(data.items || []);

        setAttendanceForm((current) => {
          const subjectStillExists = (data.items || []).some((subject) => subject._id === current.subjectId);
          return subjectStillExists ? current : { ...current, subjectId: "" };
        });
      } catch (error) {
        setAttendanceSubjects([]);
        toast.error(error.response?.data?.message || "Unable to load subjects for the selected class.");
      } finally {
        setAttendanceSubjectLoading(false);
      }
    }

    fetchAttendanceSubjects();
  }, [
    attendanceForm.departmentCode,
    attendanceForm.year,
    attendanceForm.section,
    activeSection,
    user.role,
  ]);

  useEffect(() => {
    async function fetchAttendanceStudents() {
      if (!attendanceForm.subjectId) {
        setAttendanceStudents([]);
        setAttendanceEntryState({});
        return;
      }

      try {
        const { data } = await api.get("/attendance/students", {
          params: {
            subjectId: attendanceForm.subjectId,
            year: attendanceForm.year,
            section: attendanceForm.section,
            department: attendanceForm.departmentCode,
          },
        });
        setAttendanceStudents(data.items);
        setAttendanceEntryState(
          Object.fromEntries(data.items.map((item) => [item._id, "present"]))
        );
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to load students for attendance.");
      }
    }

    if ((user.role === "faculty" || (user.role === "admin" && activeSection === "attendance")) && attendanceForm.year && attendanceForm.section) {
      fetchAttendanceStudents();
    }
  }, [attendanceForm.subjectId, attendanceForm.year, attendanceForm.section, attendanceForm.departmentCode, activeSection, user.role]);

  function resetStudentForm() {
    setStudentForm(initialStudentForm);
    setEditingStudentId("");
  }

  function resetFacultyForm() {
    setFacultyForm(initialFacultyForm);
    setEditingFacultyId("");
  }

  function resetSubjectForm() {
    setSubjectForm(initialSubjectForm);
    setEditingSubjectId("");
  }

  function resetDepartmentForm() {
    setDepartmentForm(initialDepartmentForm);
    setEditingDepartmentId("");
  }

  async function handleCreateStudent(event) {
    event.preventDefault();
    try {
      if (editingStudentId) {
        await api.put(`/people/students/${editingStudentId}`, studentForm);
        toast.success("Student updated successfully.");
      } else {
        await api.post("/people/students", studentForm);
        toast.success("Student created successfully.");
      }
      resetStudentForm();
      bootstrap();
      navigate("/dashboard/students");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save student.");
    }
  }

  async function handleCreateFaculty(event) {
    event.preventDefault();
    try {
      if (editingFacultyId) {
        await api.put(`/people/faculty/${editingFacultyId}`, facultyForm);
        toast.success("Faculty profile updated.");
      } else {
        await api.post("/people/faculty", facultyForm);
        toast.success(facultyForm.role === "hod" ? "HOD profile created." : "Faculty profile created.");
      }
      resetFacultyForm();
      bootstrap();
      navigate("/dashboard/faculty");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save faculty profile.");
    }
  }

  async function handleCreateSubject(event) {
    event.preventDefault();
    try {
      if (editingSubjectId) {
        await api.put(`/subjects/${editingSubjectId}`, subjectForm);
        toast.success("Subject updated.");
      } else {
        await api.post("/subjects", subjectForm);
        toast.success("Subject created.");
      }
      resetSubjectForm();
      bootstrap();
      navigate("/dashboard/subjects");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save subject.");
    }
  }

  async function handleCreateDepartment(event) {
    event.preventDefault();
    try {
      if (editingDepartmentId) {
        await api.put(`/departments/${editingDepartmentId}`, departmentForm);
        toast.success("Department updated.");
      } else {
        await api.post("/departments", departmentForm);
        toast.success("Department created.");
      }
      resetDepartmentForm();
      bootstrap();
      navigate("/dashboard/departments");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save department.");
    }
  }

  async function handleDelete(path, id, label) {
    try {
      await api.delete(`${path}/${id}`);
      toast.success(`${label} deleted.`);
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || `Unable to delete ${label.toLowerCase()}.`);
    }
  }

  async function handleMarkAttendance(event) {
    event.preventDefault();
    try {
      await api.post("/attendance/mark", {
        ...attendanceForm,
        entries: Object.entries(attendanceEntryState).map(([student, status]) => ({ student, status })),
      });
      toast.success("Attendance saved successfully.");
      bootstrap();
      navigate("/dashboard/records");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save attendance.");
    }
  }

  async function handleExport(type) {
    try {
      const response = await api.get(`/attendance/reports/${type}`, {
        params: filters,
        responseType: "blob",
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-report.${type === "excel" ? "xlsx" : type}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to export report.");
    }
  }

  async function handleAlertSend() {
    try {
      const { data } = await api.post("/attendance/alerts/low-attendance");
      toast.success(data.message);
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to send alerts.");
    }
  }

  async function handleSettingsUpdate(event) {
    event.preventDefault();
    try {
      const { data } = await api.put("/settings", settings);
      setSettings(data.item);
      toast.success("Settings updated.");
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update settings.");
    }
  }

  async function handleProfileUpdate(event) {
    event.preventDefault();
    const payload = new FormData();
    payload.append("name", profileForm.name);
    payload.append("email", profileForm.email);
    payload.append("phone", profileForm.phone);
    if (profileForm.avatar) payload.append("avatar", profileForm.avatar);

    try {
      const { data } = await api.put("/settings/profile", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser((current) => ({
        ...current,
        name: data.item.name,
        email: data.item.email,
        phone: data.item.phone,
        avatar: data.item.avatar,
      }));
      toast.success("Profile updated.");
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update profile.");
    }
  }

  async function handleStudentPdfDownload() {
    try {
      setPdfGenerating(true);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      let cursorY = 20;

      try {
        const response = await fetch("https://vemu.ac.in/images/vemu-logo.png");
        const blob = await response.blob();
        const reader = new FileReader();
        const imageData = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        doc.addImage(imageData, "PNG", 14, 10, 32, 18);
      } catch {
        doc.setFontSize(16);
        doc.text("VEMU", 14, 20);
      }

      doc.setFontSize(18);
      doc.text("VEMU Institute of Technology", 52, 18);
      doc.setFontSize(12);
      doc.text("Student Attendance Report", 52, 26);
      cursorY = 38;

      const profileInfo = profile.student;
      const subjectRows = studentReportPreview;

      doc.setFontSize(11);
      doc.text(`Name: ${profileInfo?.name || user.name}`, 14, cursorY);
      doc.text(`Roll No: ${profileInfo?.rollNumber || "-"}`, 110, cursorY);
      cursorY += 7;
      doc.text(`Department: ${profileInfo?.department?.code || user.departmentCode || "-"}`, 14, cursorY);
      doc.text(`Year / Section: ${profileInfo?.year || "-"} / ${profileInfo?.section || "-"}`, 110, cursorY);
      cursorY += 7;
      doc.text(`Overall Attendance: ${dashboard.cards[0]?.value || "-"}`, 14, cursorY);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 110, cursorY);
      cursorY += 7;
      doc.text(`Date Range: ${reportDateRange.from || "Start"} to ${reportDateRange.to || "Today"}`, 14, cursorY);
      cursorY += 12;

      doc.setFontSize(10);
      doc.text("Subject", 14, cursorY);
      doc.text("Total", 95, cursorY);
      doc.text("Present", 120, cursorY);
      doc.text("Absent", 150, cursorY);
      doc.text("%", 184, cursorY, { align: "right" });
      cursorY += 6;

      subjectRows.forEach((row) => {
        if (cursorY > 270) {
          doc.addPage();
          cursorY = 20;
        }
        doc.setTextColor(17, 24, 39);
        doc.text(row.subject, 14, cursorY);
        doc.text(String(row.total ?? "-"), 97, cursorY);
        doc.text(String(row.present ?? "-"), 124, cursorY);
        doc.text(String(row.absent ?? "-"), 154, cursorY);
        doc.setTextColor(row.attendance >= 75 ? 22 : 220, row.attendance >= 75 ? 163 : 38, row.attendance >= 75 ? 74 : 38);
        doc.text(`${row.attendance}%`, 184, cursorY, { align: "right" });
        cursorY += 7;
      });

      doc.save(`attendance-report-${profileInfo?.rollNumber || "student"}.pdf`);
      toast.success("PDF report downloaded successfully.");
    } catch (error) {
      toast.error("Unable to generate PDF report.");
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleHolidayCreate(event) {
    event.preventDefault();
    try {
      await api.post("/academic/holidays", holidayForm);
      toast.success("Holiday added.");
      setHolidayForm({ title: "", date: "", description: "", type: "college" });
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save holiday.");
    }
  }

  async function handleHolidayDelete(id) {
    try {
      await api.delete(`/academic/holidays/${id}`);
      toast.success("Holiday deleted.");
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete holiday.");
    }
  }

  async function handleCorrectionCreate(payload) {
    try {
      await api.post("/academic/corrections", payload);
      toast.success("Correction request submitted.");
      setCorrectionForm({ attendance: "", requestedStatus: "present", reason: "" });
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to submit correction request.");
    }
  }

  async function handleCorrectionReview(id, status) {
    try {
      await api.patch(`/academic/corrections/${id}`, { status });
      toast.success(`Correction request ${status}.`);
      bootstrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update correction request.");
    }
  }

  if (loading || !dashboard || !profile || !settings) {
    return (
      <div className="page-grid min-h-screen p-6">
        <LoadingState label="Loading dashboard..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-grid min-h-screen p-6">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-rose-200 bg-white/90 p-8 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900/90">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Unable to load dashboard</h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
          <Button className="mt-5" onClick={bootstrap}>Retry</Button>
        </div>
      </div>
    );
  }

  const studentRows = students.filter((item) => {
    const term = deferredSearch.toLowerCase();
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      item.rollNumber.toLowerCase().includes(term) ||
      item.email.toLowerCase().includes(term)
    );
  });

  function goToSection(nextSection) {
    navigate(`/dashboard/${nextSection}`);
  }

  function renderProfilePanel() {
    return (
      <Panel
        title="Profile and Notifications"
        subtitle="Update your basic profile and review automated academic notifications."
        actions={
          <Button variant="secondary" className="gap-2" onClick={bootstrap}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={handleProfileUpdate} className="grid gap-3">
            <FormField label="Name">
              <TextInput value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} />
            </FormField>
            <FormField label="Email">
              <TextInput type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} />
            </FormField>
            <FormField label="Phone">
              <TextInput value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} />
            </FormField>
            <FormField label="Avatar Upload">
              <input type="file" accept="image/*" onChange={(event) => setProfileForm({ ...profileForm, avatar: event.target.files?.[0] || null })} />
            </FormField>
            <Button type="submit" className="gap-2">
              <Upload className="h-4 w-4" />
              Update Profile
            </Button>
          </form>

          <div className="space-y-3">
            {(profile.notifications || []).length ? (
              profile.notifications.map((notice) => (
                <div key={notice._id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
                  <p className="font-medium text-slate-900 dark:text-white">{notice.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{notice.message}</p>
                </div>
              ))
            ) : (
              <EmptyState message="No notifications yet." />
            )}
          </div>
        </div>
      </Panel>
    );
  }

  function renderAdminOverview() {
    return (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.cards.map((card) => (
            <StatCard
              key={card.title}
              {...card}
              onClick={() => goToSection(cardRouteMap[user.role]?.[card.title] || "reports")}
            />
          ))}
        </section>
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Department Attendance" subtitle="Click into reports for filtered exports and intervention actions.">
            <DepartmentPie data={dashboard.charts.departmentAttendance || []} />
          </Panel>
          <Panel title="Monthly Trends" subtitle="Attendance performance over recent months.">
            <TrendChart data={dashboard.charts.monthlyTrends || []} />
          </Panel>
        </section>
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Quick Actions" subtitle="Jump straight to working sections from the command center.">
            <div className="grid gap-2">
              {[
                ["Manage Students", "students"],
                ["Manage Faculty / HOD", "faculty"],
                ["Manage Subjects", "subjects"],
                ["Manage Departments", "departments"],
                ["Open Reports", "reports"],
              ].map(([label, route]) => (
                <Button key={route} variant="secondary" onClick={() => goToSection(route)}>
                  {label}
                </Button>
              ))}
            </div>
          </Panel>
          <Panel title="Low Attendance Queue" subtitle="Immediate intervention list for students below threshold.">
            {dashboard.lowAttendanceStudents.length ? (
              <DataTable
                rows={dashboard.lowAttendanceStudents.slice(0, 6)}
                columns={[
                  { key: "name", label: "Student" },
                  { key: "rollNumber", label: "Roll" },
                  { key: "percentage", label: "%" },
                ]}
                keyField="rollNumber"
              />
            ) : (
              <EmptyState message="No students below threshold." />
            )}
          </Panel>
          <Panel title="Admin Shortcuts" subtitle="Most used actions for daily operations.">
            <div className="grid gap-2">
              <Button onClick={() => handleExport("excel")}>Export Excel</Button>
              <Button variant="secondary" onClick={handleAlertSend}>
                Send Low Attendance Alerts
              </Button>
              <Button variant="ghost" onClick={() => goToSection("settings")}>
                Open Settings
              </Button>
            </div>
          </Panel>
        </section>
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Daily Attendance Graph" subtitle="Latest daily attendance trend across the college.">
            <TrendChart data={dashboard.charts.dailyTrends || []} xKey="day" barColor="#16a34a" />
          </Panel>
          <Panel title="Weekly Attendance Graph" subtitle="Weekly comparison for college-wide attendance.">
            <TrendChart data={dashboard.charts.weeklyTrends || []} xKey="week" barColor="#0f766e" />
          </Panel>
        </section>
        <Panel title="Faculty-wise Attendance Snapshot" subtitle="High-level attendance averages by faculty.">
          {dashboard.facultySummary?.length ? (
            <DataTable
              rows={dashboard.facultySummary.slice(0, 12)}
              columns={[
                { key: "name", label: "Faculty" },
                { key: "department", label: "Dept" },
                { key: "classesHandled", label: "Classes" },
                { key: "attendanceAverage", label: "Avg %" },
              ]}
              keyField="id"
            />
          ) : (
            <EmptyState message="No faculty summary available." />
          )}
        </Panel>
      </>
    );
  }

  function renderStudentsSection() {
    return (
      <section className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Student Directory" subtitle="Department-wise filtering and student record management.">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <TextInput placeholder="Search students" value={search} onChange={(event) => setSearch(event.target.value)} />
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              departments={departments}
              lockedDepartment={user.role !== "admin"}
            />
          </div>
          {studentListLoading ? (
            <LoadingState label="Loading students..." />
          ) : studentRows.length ? (
            <DataTable
              rows={studentRows}
              columns={[
                { key: "name", label: "Name" },
                { key: "rollNumber", label: "Roll" },
                { key: "department", label: "Dept", render: (row) => row.department.code },
                { key: "year", label: "Year" },
                { key: "section", label: "Section" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                ...(user.role === "admin"
                  ? [
                      {
                        key: "actions",
                        label: "Actions",
                        render: (row) => (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setEditingStudentId(row._id);
                                setStudentForm({
                                  name: row.name,
                                  username: row.user.username,
                                  rollNumber: row.rollNumber,
                                  department: row.department._id,
                                  year: row.year,
                                  section: row.section,
                                  email: row.email,
                                  phone: row.phone,
                                  guardianName: row.guardianName || "",
                                  guardianPhone: row.guardianPhone || "",
                                });
                              }}
                              className="text-primary-600"
                            >
                              Edit
                            </button>
                            <button onClick={() => handleDelete("/people/students", row._id, "Student")} className="text-rose-600">
                              Delete
                            </button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <EmptyState message="No students found for the selected filters." />
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing page {studentPagination.page} of {studentPagination.totalPages} · Total students {studentPagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={studentPagination.page <= 1}
                onClick={() => setStudentPagination((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={studentPagination.page >= studentPagination.totalPages}
                onClick={() => setStudentPagination((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </Panel>

        {user.role === "admin" ? (
          <Panel title={editingStudentId ? "Edit Student" : "Add Student"} subtitle="Create student accounts directly from the admin dashboard.">
            <form onSubmit={handleCreateStudent} className="grid gap-3 md:grid-cols-2">
              <FormField label="Name"><TextInput value={studentForm.name} onChange={(event) => setStudentForm({ ...studentForm, name: event.target.value })} /></FormField>
              <FormField label="Username"><TextInput value={studentForm.username} onChange={(event) => setStudentForm({ ...studentForm, username: event.target.value })} /></FormField>
              <FormField label="Roll Number"><TextInput value={studentForm.rollNumber} onChange={(event) => setStudentForm({ ...studentForm, rollNumber: event.target.value })} /></FormField>
              <FormField label="Department">
                <SelectInput value={studentForm.department} onChange={(event) => setStudentForm({ ...studentForm, department: event.target.value })}>
                  <option value="">Select Department</option>
                  {departments.map((department) => (
                    <option key={department._id} value={department._id}>{department.name}</option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Year"><TextInput type="number" min="1" max="4" value={studentForm.year} onChange={(event) => setStudentForm({ ...studentForm, year: event.target.value })} /></FormField>
              <FormField label="Section"><TextInput value={studentForm.section} onChange={(event) => setStudentForm({ ...studentForm, section: event.target.value })} /></FormField>
              <FormField label="Email"><TextInput type="email" value={studentForm.email} onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })} /></FormField>
              <FormField label="Phone"><TextInput value={studentForm.phone} onChange={(event) => setStudentForm({ ...studentForm, phone: event.target.value })} /></FormField>
              <FormField label="Guardian Name"><TextInput value={studentForm.guardianName} onChange={(event) => setStudentForm({ ...studentForm, guardianName: event.target.value })} /></FormField>
              <FormField label="Guardian Phone"><TextInput value={studentForm.guardianPhone} onChange={(event) => setStudentForm({ ...studentForm, guardianPhone: event.target.value })} /></FormField>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">{editingStudentId ? "Update Student" : "Create Student"}</Button>
                {editingStudentId ? <Button type="button" variant="secondary" onClick={resetStudentForm}>Cancel</Button> : null}
              </div>
            </form>
          </Panel>
        ) : null}
      </section>
    );
  }

  function renderFacultySection() {
    return (
      <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Faculty Directory" subtitle="All active faculty and HOD accounts with department mapping.">
          <div className="mb-4">
            <FilterBar filters={filters} setFilters={setFilters} departments={departments} lockedDepartment={user.role !== "admin"} showDepartment />
          </div>
          {faculty.length ? (
            <DataTable
              rows={faculty}
              columns={[
                { key: "name", label: "Name" },
                { key: "employeeId", label: "Employee ID" },
                { key: "department", label: "Department", render: (row) => row.department.code },
                { key: "designation", label: "Designation" },
                { key: "role", label: "Role", render: (row) => row.user.role.toUpperCase() },
                ...(user.role === "admin"
                  ? [
                      {
                        key: "actions",
                        label: "Actions",
                        render: (row) => (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setEditingFacultyId(row._id);
                                setFacultyForm({
                                  name: row.name,
                                  username: row.user.username,
                                  employeeId: row.employeeId,
                                  department: row.department._id,
                                  email: row.user.email,
                                  phone: row.user.phone,
                                  designation: row.designation,
                                  role: row.user.role,
                                });
                              }}
                              className="text-primary-600"
                            >
                              Edit
                            </button>
                            <button onClick={() => handleDelete("/people/faculty", row._id, "Faculty")} className="text-rose-600">
                              Delete
                            </button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <EmptyState message="No faculty records found." />
          )}
        </Panel>

        {user.role === "admin" ? (
          <Panel title={editingFacultyId ? "Edit Faculty / HOD" : "Add Faculty / HOD"} subtitle="Admin can create faculty and department HOD accounts here.">
            <form onSubmit={handleCreateFaculty} className="grid gap-3">
              <FormField label="Name"><TextInput value={facultyForm.name} onChange={(event) => setFacultyForm({ ...facultyForm, name: event.target.value })} /></FormField>
              <FormField label="Username"><TextInput value={facultyForm.username} onChange={(event) => setFacultyForm({ ...facultyForm, username: event.target.value })} /></FormField>
              <FormField label="Employee ID"><TextInput value={facultyForm.employeeId} onChange={(event) => setFacultyForm({ ...facultyForm, employeeId: event.target.value })} /></FormField>
              <FormField label="Role">
                <SelectInput value={facultyForm.role} onChange={(event) => setFacultyForm({ ...facultyForm, role: event.target.value })}>
                  <option value="faculty">Faculty</option>
                  <option value="hod">HOD</option>
                </SelectInput>
              </FormField>
              <FormField label="Department">
                <SelectInput value={facultyForm.department} onChange={(event) => setFacultyForm({ ...facultyForm, department: event.target.value })}>
                  <option value="">Select Department</option>
                  {departments.map((department) => (
                    <option key={department._id} value={department._id}>{department.name}</option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Designation"><TextInput value={facultyForm.designation} onChange={(event) => setFacultyForm({ ...facultyForm, designation: event.target.value })} /></FormField>
              <FormField label="Email"><TextInput type="email" value={facultyForm.email} onChange={(event) => setFacultyForm({ ...facultyForm, email: event.target.value })} /></FormField>
              <FormField label="Phone"><TextInput value={facultyForm.phone} onChange={(event) => setFacultyForm({ ...facultyForm, phone: event.target.value })} /></FormField>
              <div className="flex gap-2">
                <Button type="submit">{editingFacultyId ? "Update Profile" : "Create Profile"}</Button>
                {editingFacultyId ? <Button type="button" variant="secondary" onClick={resetFacultyForm}>Cancel</Button> : null}
              </div>
            </form>
          </Panel>
        ) : null}
      </section>
    );
  }

  function renderSubjectSection() {
    const visibleSubjects =
      user.role === "student"
        ? dashboard.charts.subjectBreakdown || []
        : subjects.filter((item) => !filters.department || item.department.code === filters.department);

    if (user.role === "student") {
      return (
        <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
          <Panel title="Subject-wise Attendance" subtitle="Every enrolled subject with current percentage.">
            {visibleSubjects.length ? (
              <DataTable
                rows={visibleSubjects}
                columns={[
                  { key: "subject", label: "Subject" },
                  { key: "code", label: "Code" },
                  { key: "attendance", label: "Attendance %" },
                ]}
                keyField="code"
              />
            ) : (
              <EmptyState message="No subject attendance data available yet." />
            )}
          </Panel>
          <Panel title="Subject Performance Chart" subtitle="Visual comparison of attendance across subjects.">
            <SubjectBarChart data={visibleSubjects} />
          </Panel>
        </section>
      );
    }

    return (
      <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Subject Directory" subtitle="Review subject mapping by department, year, and section.">
          <div className="mb-4">
            <FilterBar filters={filters} setFilters={setFilters} departments={departments} lockedDepartment={user.role !== "admin"} />
          </div>
          {visibleSubjects.length ? (
            <DataTable
              rows={visibleSubjects}
              columns={[
                { key: "name", label: "Subject" },
                { key: "code", label: "Code" },
                { key: "department", label: "Department", render: (row) => row.department.code },
                { key: "year", label: "Year" },
                { key: "section", label: "Section" },
                ...(user.role === "admin"
                  ? [
                      {
                        key: "actions",
                        label: "Actions",
                        render: (row) => (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setEditingSubjectId(row._id);
                                setSubjectForm({
                                  name: row.name,
                                  code: row.code,
                                  department: row.department._id,
                                  year: row.year,
                                  section: row.section,
                                  faculty: row.faculty?._id || "",
                                });
                              }}
                              className="text-primary-600"
                            >
                              Edit
                            </button>
                            <button onClick={() => handleDelete("/subjects", row._id, "Subject")} className="text-rose-600">
                              Delete
                            </button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <EmptyState message="No subjects found." />
          )}
        </Panel>

        {user.role === "admin" ? (
          <Panel title={editingSubjectId ? "Edit Subject" : "Add Subject"} subtitle="Create new subjects and map them to faculty members.">
            <form onSubmit={handleCreateSubject} className="grid gap-3">
              <FormField label="Subject Name"><TextInput value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} /></FormField>
              <FormField label="Code"><TextInput value={subjectForm.code} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })} /></FormField>
              <FormField label="Department">
                <SelectInput value={subjectForm.department} onChange={(event) => setSubjectForm({ ...subjectForm, department: event.target.value })}>
                  <option value="">Select Department</option>
                  {departments.map((department) => (
                    <option key={department._id} value={department._id}>{department.name}</option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Faculty">
                <SelectInput value={subjectForm.faculty} onChange={(event) => setSubjectForm({ ...subjectForm, faculty: event.target.value })}>
                  <option value="">Select Faculty</option>
                  {faculty.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
                  ))}
                </SelectInput>
              </FormField>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Year"><TextInput type="number" min="1" max="4" value={subjectForm.year} onChange={(event) => setSubjectForm({ ...subjectForm, year: event.target.value })} /></FormField>
                <FormField label="Section"><TextInput value={subjectForm.section} onChange={(event) => setSubjectForm({ ...subjectForm, section: event.target.value })} /></FormField>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingSubjectId ? "Update Subject" : "Create Subject"}</Button>
                {editingSubjectId ? <Button type="button" variant="secondary" onClick={resetSubjectForm}>Cancel</Button> : null}
              </div>
            </form>
          </Panel>
        ) : null}
      </section>
    );
  }

  function renderDepartmentSection() {
    return (
      <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
        <Panel title="Department Directory" subtitle="All departments configured in the system.">
          <div className="space-y-3">
            {departments.map((department) => (
              <div key={department._id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{department.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {department.code} · Intake {department.totalIntake} · HOD {department.hod?.name || "Not assigned"}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingDepartmentId(department._id);
                      setDepartmentForm({
                        name: department.name,
                        code: department.code,
                        description: department.description,
                        totalIntake: department.totalIntake,
                      });
                    }}
                    className="text-primary-600"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDelete("/departments", department._id, "Department")} className="text-rose-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={editingDepartmentId ? "Edit Department" : "Add Department"} subtitle="Create or update department records.">
          <form onSubmit={handleCreateDepartment} className="grid gap-3">
            <FormField label="Department Name"><TextInput value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} /></FormField>
            <FormField label="Code"><TextInput value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value.toUpperCase() })} /></FormField>
            <FormField label="Description"><TextArea value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} /></FormField>
            <FormField label="Total Intake"><TextInput type="number" value={departmentForm.totalIntake} onChange={(event) => setDepartmentForm({ ...departmentForm, totalIntake: event.target.value })} /></FormField>
            <div className="flex gap-2">
              <Button type="submit">{editingDepartmentId ? "Update Department" : "Create Department"}</Button>
              {editingDepartmentId ? <Button type="button" variant="secondary" onClick={resetDepartmentForm}>Cancel</Button> : null}
            </div>
          </form>
        </Panel>
      </section>
    );
  }

  function renderReportsSection() {
    return (
      <>
        <Panel
          title={user.role === "student" ? "Attendance Downloads" : "Attendance Reports"}
          subtitle={
            user.role === "student"
              ? "Download your attendance report in CSV, Excel, or PDF format."
              : `Department-aware exports and attendance reports for ${currentDepartmentLabel}.`
          }
          actions={[
            ...(user.role === "student"
              ? [<Button key="pdf-client" onClick={handleStudentPdfDownload} className="gap-2">{pdfGenerating ? "Generating..." : "Download Report PDF"}</Button>]
              : [
                  <DownloadButton key="csv" label="CSV" onClick={() => handleExport("csv")} />,
                  <DownloadButton key="excel" label="Excel" onClick={() => handleExport("excel")} />,
                  <DownloadButton key="pdf" label="PDF" onClick={() => handleExport("pdf")} />,
                ]),
            ...(user.role === "admin" || user.role === "hod"
              ? [
                  <Button key="mail" onClick={handleAlertSend} className="gap-2">
                    <Mail className="h-4 w-4" />
                    Send Alerts
                  </Button>,
                ]
              : []),
          ]}
        >
          {user.role !== "student" ? (
            <div className="mb-4">
              <FilterBar filters={filters} setFilters={setFilters} departments={departments} lockedDepartment={user.role !== "admin"} />
            </div>
          ) : (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <FormField label="Subject Filter for PDF">
                <SelectInput value={pdfSubjectFilter} onChange={(event) => setPdfSubjectFilter(event.target.value)}>
                  <option value="">All Subjects</option>
                  {(dashboard.charts.subjectBreakdown || []).map((subject) => (
                    <option key={subject.code} value={subject.code}>
                      {subject.code}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="From Date">
                <TextInput type="date" value={reportDateRange.from} onChange={(event) => setReportDateRange({ ...reportDateRange, from: event.target.value })} />
              </FormField>
              <FormField label="To Date">
                <TextInput type="date" value={reportDateRange.to} onChange={(event) => setReportDateRange({ ...reportDateRange, to: event.target.value })} />
              </FormField>
            </div>
          )}
          {reports.length ? (
            <DataTable
              rows={reports}
              columns={[
                { key: "student", label: "Student" },
                { key: "rollNumber", label: "Roll Number" },
                ...(user.role !== "student" ? [{ key: "department", label: "Department" }] : []),
                { key: "year", label: "Year" },
                { key: "section", label: "Section" },
                { key: "attendancePercentage", label: "Attendance %" },
                { key: "presentClasses", label: "Present" },
                { key: "lateClasses", label: "Late" },
                { key: "absentClasses", label: "Absent" },
              ]}
              keyField="rollNumber"
            />
          ) : (
            <EmptyState message="No report data is available for the selected filters." />
          )}
        </Panel>

        {user.role === "student" ? (
          <Panel title="Report Preview" subtitle="Preview the PDF content before downloading.">
            {studentReportPreview.length ? (
              <DataTable
                rows={studentReportPreview}
                columns={[
                  { key: "subject", label: "Subject Name" },
                  { key: "total", label: "Total Classes" },
                  { key: "present", label: "Present" },
                  { key: "absent", label: "Absent" },
                  {
                    key: "attendance",
                    label: "Percentage",
                    render: (row) => (
                      <span className={row.attendance >= 75 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                        {row.attendance}%
                      </span>
                    ),
                  },
                ]}
                keyField="code"
              />
            ) : (
              <EmptyState message="No attendance data available for the selected report range." />
            )}
          </Panel>
        ) : null}

        {user.role === "hod" || user.role === "admin" ? (
          <Panel title="Faculty-wise Attendance Report" subtitle="Attendance averages across faculty and handled classes.">
            {facultySummary.length ? (
              <DataTable
                rows={facultySummary}
                columns={[
                  { key: "name", label: "Faculty" },
                  { key: "department", label: "Department" },
                  { key: "classesHandled", label: "Classes" },
                  { key: "attendanceAverage", label: "Avg %" },
                ]}
                keyField="id"
              />
            ) : (
              <EmptyState message="No faculty summary available." />
            )}
          </Panel>
        ) : null}

        {user.role !== "student" ? renderProfilePanel() : null}
      </>
    );
  }

  function renderSettingsSection() {
    return (
      <section className="grid gap-4">
        <div className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
          <Panel title="System Settings" subtitle="Manage threshold, branding, and support contact details.">
            <form onSubmit={handleSettingsUpdate} className="grid gap-3">
              <FormField label="College Name"><TextInput value={settings.collegeName} onChange={(event) => setSettings({ ...settings, collegeName: event.target.value })} /></FormField>
              <FormField label="College Motto"><TextInput value={settings.collegeMotto} onChange={(event) => setSettings({ ...settings, collegeMotto: event.target.value })} /></FormField>
              <FormField label="College Address"><TextArea value={settings.collegeAddress} onChange={(event) => setSettings({ ...settings, collegeAddress: event.target.value })} /></FormField>
              <FormField label="Attendance Threshold"><TextInput type="number" value={settings.threshold} onChange={(event) => setSettings({ ...settings, threshold: event.target.value })} /></FormField>
              <FormField label="Support Email"><TextInput type="email" value={settings.supportEmail} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} /></FormField>
              <Button type="submit">Save Settings</Button>
            </form>
          </Panel>
          {renderProfilePanel()}
        </div>

        <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Holiday Management" subtitle="Admin can add and remove holidays from the attendance calendar.">
            <form onSubmit={handleHolidayCreate} className="grid gap-3">
              <FormField label="Holiday Title"><TextInput value={holidayForm.title} onChange={(event) => setHolidayForm({ ...holidayForm, title: event.target.value })} /></FormField>
              <FormField label="Date"><TextInput type="date" value={holidayForm.date} onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })} /></FormField>
              <FormField label="Type"><TextInput value={holidayForm.type} onChange={(event) => setHolidayForm({ ...holidayForm, type: event.target.value })} /></FormField>
              <FormField label="Description"><TextArea value={holidayForm.description} onChange={(event) => setHolidayForm({ ...holidayForm, description: event.target.value })} /></FormField>
              <Button type="submit">Add Holiday</Button>
            </form>
          </Panel>

          <Panel title="Holiday Calendar" subtitle="Configured holiday list for the academic year.">
            {holidays.length ? (
              <DataTable
                rows={holidays}
                columns={[
                  { key: "date", label: "Date" },
                  { key: "title", label: "Title" },
                  { key: "type", label: "Type" },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <button onClick={() => handleHolidayDelete(row._id)} className="text-rose-600">
                        Delete
                      </button>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState message="No holidays configured yet." />
            )}
          </Panel>
        </div>

        <Panel title="Attendance Correction Requests" subtitle="Review pending correction requests from students.">
          {corrections.length ? (
            <DataTable
              rows={corrections}
              columns={[
                { key: "student", label: "Student", render: (row) => row.student.name },
                { key: "requestedStatus", label: "Requested", render: (row) => <StatusPill status={row.requestedStatus} /> },
                { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
                { key: "reason", label: "Reason" },
                {
                  key: "review",
                  label: "Review",
                  render: (row) => (
                    <div className="flex gap-2">
                      <button onClick={() => handleCorrectionReview(row._id, "approved")} className="text-emerald-600">
                        Approve
                      </button>
                      <button onClick={() => handleCorrectionReview(row._id, "rejected")} className="text-rose-600">
                        Reject
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState message="No correction requests available." />
          )}
        </Panel>
      </section>
    );
  }

  function renderHodOverview() {
    return (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.cards.map((card) => (
            <StatCard
              key={card.title}
              {...card}
              onClick={() => goToSection(cardRouteMap[user.role]?.[card.title] || "reports")}
            />
          ))}
        </section>
        <Panel title="Department Snapshot" subtitle={`Current overview for ${currentDepartmentLabel}.`}>
          <div className="grid gap-3 md:grid-cols-3">
            <Button variant="secondary" onClick={() => goToSection("analytics")}>Open Analytics</Button>
            <Button variant="secondary" onClick={() => goToSection("performance")}>Track Performance</Button>
            <Button variant="secondary" onClick={() => goToSection("reports")}>Download Reports</Button>
          </div>
        </Panel>
      </>
    );
  }

  function renderAnalyticsSection() {
    return (
      <>
        <Panel title="Department Filters" subtitle="Filter the department analytics by year and section.">
          <FilterBar filters={filters} setFilters={setFilters} departments={departments} lockedDepartment />
        </Panel>
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Attendance Distribution" subtitle="Overall attendance mix for your department.">
            <DepartmentPie data={dashboard.charts.departmentAttendance || []} />
          </Panel>
          <Panel title="Monthly Attendance Trends" subtitle="Department-wide attendance pattern over time.">
            <TrendChart data={dashboard.charts.monthlyTrends || []} />
          </Panel>
        </section>
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Weekly Attendance Trends" subtitle="Weekly movement inside your department.">
            <TrendChart data={dashboard.charts.weeklyTrends || []} xKey="week" barColor="#0891b2" />
          </Panel>
          <Panel title="Daily Attendance Trends" subtitle="Recent daily attendance behaviour.">
            <TrendChart data={dashboard.charts.dailyTrends || []} xKey="day" barColor="#16a34a" />
          </Panel>
        </section>
        <Panel title="Faculty-wise Attendance Report" subtitle="How each department faculty member is performing on attendance.">
          {dashboard.facultySummary?.length ? (
            <DataTable
              rows={dashboard.facultySummary}
              columns={[
                { key: "name", label: "Faculty" },
                { key: "classesHandled", label: "Classes" },
                { key: "attendanceAverage", label: "Avg %" },
              ]}
              keyField="id"
            />
          ) : (
            <EmptyState message="No faculty report available." />
          )}
        </Panel>
      </>
    );
  }

  function renderPerformanceSection() {
    return (
      <section className="grid gap-4 2xl:grid-cols-[1fr_1.1fr]">
        <Panel title="Student Performance Tracking" subtitle="Year-wise and section-wise student attendance performance.">
          <div className="mb-4">
            <FilterBar filters={filters} setFilters={setFilters} departments={departments} lockedDepartment />
          </div>
          {reports.length ? (
            <DataTable
              rows={reports}
              columns={[
                { key: "student", label: "Student" },
                { key: "rollNumber", label: "Roll Number" },
                { key: "year", label: "Year" },
                { key: "section", label: "Section" },
                { key: "attendancePercentage", label: "Attendance %" },
              ]}
              keyField="rollNumber"
            />
          ) : (
            <EmptyState message="No performance data available for these filters." />
          )}
        </Panel>

        <Panel
          title="Low Attendance Intervention Queue"
          subtitle="Students below the configured threshold in your department."
          actions={
            <Button onClick={handleAlertSend} className="gap-2">
              <Mail className="h-4 w-4" />
              Send Alerts
            </Button>
          }
        >
          {dashboard.lowAttendanceStudents.length ? (
            <DataTable
              rows={dashboard.lowAttendanceStudents}
              columns={[
                { key: "name", label: "Student" },
                { key: "rollNumber", label: "Roll Number" },
                { key: "percentage", label: "Attendance %" },
                { key: "email", label: "Email" },
              ]}
              keyField="rollNumber"
            />
          ) : (
            <EmptyState message="No students are currently below the threshold." />
          )}
        </Panel>
      </section>
    );
  }

  function renderFacultyAttendance() {
    return (
      <section className="grid gap-4 2xl:grid-cols-[1fr_1.05fr]">
        <Panel title="Attendance Marking" subtitle="Select department, year, section, subject, and date to mark attendance.">
          <form onSubmit={handleMarkAttendance} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <FormField label="Department">
                <SelectInput value={attendanceForm.departmentCode} disabled>
                  <option value={attendanceForm.departmentCode}>{attendanceForm.departmentCode || "Department"}</option>
                </SelectInput>
              </FormField>
              <FormField label="Year">
                <SelectInput
                  value={attendanceForm.year}
                  onChange={(event) =>
                    setAttendanceForm({
                      ...attendanceForm,
                      year: event.target.value,
                      subjectId: "",
                    })
                  }
                >
                  <option value="">Select Year</option>
                  {[1, 2, 3, 4].map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Section">
                <SelectInput
                  value={attendanceForm.section}
                  onChange={(event) =>
                    setAttendanceForm({
                      ...attendanceForm,
                      section: event.target.value,
                      subjectId: "",
                    })
                  }
                >
                  {["A", "B", "C"].map((section) => (
                  <option key={section} value={section}>
                    Section {section}
                  </option>
                ))}
              </SelectInput>
              </FormField>
              <FormField label="Subject">
                <SelectInput
                  value={attendanceForm.subjectId}
                  disabled={!attendanceForm.year || attendanceSubjectLoading}
                  onChange={(event) => {
                    const subjectId = event.target.value;
                    setAttendanceForm({
                      ...attendanceForm,
                      subjectId,
                    });
                  }}
                >
                  <option value="">Select Subject</option>
                  {attendanceSubjects.map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.code} - {subject.name}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Date"><TextInput type="date" value={attendanceForm.date} onChange={(event) => setAttendanceForm({ ...attendanceForm, date: event.target.value })} /></FormField>
            </div>
            <FormField label="Remarks">
              <TextArea value={attendanceForm.notes} onChange={(event) => setAttendanceForm({ ...attendanceForm, notes: event.target.value })} />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setAttendanceEntryState(
                    Object.fromEntries(attendanceStudents.map((student) => [student._id, "present"]))
                  )
                }
              >
                Mark All Present
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setAttendanceEntryState(
                    Object.fromEntries(attendanceStudents.map((student) => [student._id, "absent"]))
                  )
                }
              >
                Mark All Absent
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setAttendanceEntryState(
                    Object.fromEntries(attendanceStudents.map((student) => [student._id, "late"]))
                  )
                }
              >
                Mark All Late
              </Button>
            </div>

            {selectedAttendanceSubject ? (
              <div className="rounded-2xl bg-primary-50 p-4 text-sm text-primary-800 dark:bg-primary-950/40 dark:text-primary-100">
                {selectedAttendanceSubject.code} · {selectedAttendanceSubject.name} · Year {attendanceForm.year} · Section {attendanceForm.section}
              </div>
            ) : null}

            {attendanceSubjectLoading ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950/40 dark:text-slate-300">
                Loading subjects for {attendanceForm.departmentCode} Year {attendanceForm.year} Section {attendanceForm.section}...
              </div>
            ) : null}

            {attendanceStudents.length ? (
              <div className="custom-scroll max-h-[420px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50 p-4 dark:bg-slate-950/40">
                {attendanceStudents.map((student) => (
                  <div key={student._id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{student.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {student.rollNumber} · {student.department.code} · Year {student.year}{student.section}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${student.attendancePercentage >= 75 ? "text-emerald-600" : "text-rose-600"}`}>
                        Current subject attendance: {student.attendancePercentage}%
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {["present", "late", "absent"].map((status) => (
                        <button
                          type="button"
                          key={status}
                          onClick={() => setAttendanceEntryState({ ...attendanceEntryState, [student._id]: status })}
                          className={`rounded-2xl px-4 py-2 text-sm font-medium capitalize ${
                            attendanceEntryState[student._id] === status
                              ? status === "present"
                                ? "bg-emerald-500 text-white"
                                : status === "late"
                                  ? "bg-amber-500 text-white"
                                  : "bg-rose-500 text-white"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Choose a subject to load students for attendance." />
            )}
            <Button type="submit">Save Attendance</Button>
          </form>
        </Panel>

        <Panel title="Faculty Tools" subtitle="Quick navigation, timetable view, and reporting shortcuts.">
          <div className="grid gap-3">
            <Button variant="secondary" onClick={() => goToSection("records")}>Open Attendance Records</Button>
            <Button variant="secondary" onClick={() => goToSection("reports")}>Open Faculty Reports</Button>
            <Button variant="secondary" onClick={() => goToSection("students")}>Open Student List</Button>
          </div>
          <div className="mt-5">
            {timetable.length ? (
              <DataTable
                rows={timetable.slice(0, 8)}
                columns={[
                  { key: "day", label: "Day" },
                  { key: "subject", label: "Subject", render: (row) => row.subject.code },
                  { key: "startTime", label: "Start" },
                  { key: "section", label: "Section" },
                ]}
                keyField="_id"
              />
            ) : (
              <EmptyState message="Timetable not available." />
            )}
          </div>
        </Panel>
      </section>
    );
  }

  function renderRecordsSection() {
    return (
      <Panel title="Attendance Records" subtitle="Review and edit saved attendance sessions.">
        <div className="mb-4">
          <FilterBar filters={filters} setFilters={setFilters} departments={departments} lockedDepartment={user.role !== "admin"} />
        </div>
        {attendanceRecords.length ? (
          <DataTable
            rows={attendanceRecords}
            columns={[
              { key: "date", label: "Date" },
              { key: "subject", label: "Subject", render: (row) => row.subject.code },
              { key: "year", label: "Year" },
              { key: "section", label: "Section" },
              { key: "entries", label: "Students", render: (row) => row.entries.length },
              {
                key: "edit",
                label: "Edit",
                render: (row) => (
                  <button
                    className="inline-flex items-center gap-1 text-primary-600"
                    onClick={() => {
                      setAttendanceForm({
                        subjectId: row.subject._id,
                        year: row.year,
                        section: row.section,
                        date: row.date,
                        notes: row.notes || "",
                      });
                      setAttendanceEntryState(
                        Object.fromEntries(row.entries.map((entry) => [entry.student._id, entry.status]))
                      );
                      goToSection("attendance");
                      toast.success("Attendance record loaded into the marking page.");
                    }}
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </button>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState message="No attendance records found for the selected filters." />
        )}
      </Panel>
    );
  }

  function renderStudentOverview() {
    return (
      <>
        <section className="grid gap-4 md:grid-cols-3">
          {dashboard.cards.map((card) => (
            <StatCard
              key={card.title}
              {...card}
              onClick={() => goToSection(cardRouteMap[user.role]?.[card.title] || "reports")}
            />
          ))}
        </section>
        <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <Panel title={`Hello, ${user.name}`} subtitle="Your personalized attendance snapshot for the semester.">
            <ProgressBar value={Number(String(dashboard.cards[0].value).replace("%", ""))} threshold={dashboard.threshold} />
            {dashboard.lowAttendanceWarning ? (
              <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                Warning: your attendance is below 75%. Please improve attendance and contact faculty if a correction is needed.
              </div>
            ) : null}
            <div className="mt-5 rounded-3xl bg-primary-50 p-4 text-sm text-primary-800 dark:bg-primary-950/40 dark:text-primary-100">
              Use the subject and report sections to inspect subject-wise attendance percentages and download your latest report.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => goToSection("subjects")}>Open Subject Breakdown</Button>
              <Button variant="secondary" onClick={() => goToSection("history")}>Open History</Button>
              <Button variant="secondary" onClick={() => goToSection("reports")}>Download Reports</Button>
            </div>
          </Panel>
          <Panel title="Present vs Absent" subtitle="Overall attendance distribution">
            <DepartmentPie data={dashboard.charts.donut || []} dataKey="value" nameKey="name" />
          </Panel>
        </section>
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="Month-wise Attendance Report" subtitle="Monthly attendance percentages across the semester.">
            <TrendChart data={dashboard.charts.monthlyTrends || []} />
          </Panel>
          <Panel title="Student Timetable" subtitle="Your current class timetable.">
            {timetable.length ? (
              <DataTable
                rows={timetable}
                columns={[
                  { key: "day", label: "Day" },
                  { key: "subject", label: "Subject", render: (row) => row.subject.code },
                  { key: "startTime", label: "Start" },
                  { key: "endTime", label: "End" },
                  { key: "room", label: "Room" },
                ]}
                keyField="_id"
              />
            ) : (
              <EmptyState message="Timetable not available." />
            )}
          </Panel>
        </section>
      </>
    );
  }

  function renderStudentHistory() {
    return (
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Daily Attendance History" subtitle="Recent attendance entries across your enrolled subjects.">
          {dashboard.history.length ? (
            <DataTable
              rows={dashboard.history}
              columns={[
                { key: "date", label: "Date" },
                { key: "subjectCode", label: "Code" },
                { key: "subject", label: "Subject" },
                { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
              ]}
              keyField="date"
            />
          ) : (
            <EmptyState message="No history found yet." />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Attendance Calendar" subtitle="Recent present, late, and absent days.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(dashboard.calendar || []).slice(0, 18).map((item) => (
                <div key={`${item.date}-${item.subjectCode}`} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.date}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{item.subjectCode}</p>
                  <div className="mt-2"><StatusPill status={item.status} /></div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Attendance Correction Request" subtitle="Request correction for a marked entry if needed.">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCorrectionCreate(correctionForm);
              }}
              className="grid gap-3"
            >
              <FormField label="Attendance Entry">
                <SelectInput value={correctionForm.attendance} onChange={(event) => setCorrectionForm({ ...correctionForm, attendance: event.target.value })}>
                  <option value="">Select Entry</option>
                  {attendanceRecords.slice(0, 40).map((record) => (
                    <option key={record._id} value={record._id}>
                      {record.date} - {record.subject.code} - {record.section}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Requested Status">
                <SelectInput value={correctionForm.requestedStatus} onChange={(event) => setCorrectionForm({ ...correctionForm, requestedStatus: event.target.value })}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </SelectInput>
              </FormField>
              <FormField label="Reason">
                <TextArea value={correctionForm.reason} onChange={(event) => setCorrectionForm({ ...correctionForm, reason: event.target.value })} />
              </FormField>
              <Button type="submit">Submit Correction Request</Button>
            </form>
          </Panel>
        </div>
      </section>
    );
  }

  function renderSection() {
    if (user.role === "admin") {
      if (activeSection === "overview") return renderAdminOverview();
      if (activeSection === "students") return renderStudentsSection();
      if (activeSection === "faculty") return renderFacultySection();
      if (activeSection === "subjects") return renderSubjectSection();
      if (activeSection === "departments") return renderDepartmentSection();
      if (activeSection === "reports") return renderReportsSection();
      if (activeSection === "settings") return renderSettingsSection();
    }

    if (user.role === "hod") {
      if (activeSection === "overview") return renderHodOverview();
      if (activeSection === "analytics") return renderAnalyticsSection();
      if (activeSection === "performance") return renderPerformanceSection();
      if (activeSection === "reports") return renderReportsSection();
    }

    if (user.role === "faculty") {
      if (activeSection === "attendance") return renderFacultyAttendance();
      if (activeSection === "records") return renderRecordsSection();
      if (activeSection === "reports") return renderReportsSection();
      if (activeSection === "students") return renderStudentsSection();
    }

    if (user.role === "student") {
      if (activeSection === "overview") return renderStudentOverview();
      if (activeSection === "subjects") return renderSubjectSection();
      if (activeSection === "history") return renderStudentHistory();
      if (activeSection === "reports") return renderReportsSection();
    }

    return <EmptyState message="This section is not available." />;
  }

  return (
    <AppShell
      title={sectionTitle}
      subtitle={sectionDescriptions[activeSection] || `${settings.collegeName} · ${settings.collegeMotto}`}
      notifications={profile.notifications || []}
      sections={sections}
    >
      {renderSection()}
    </AppShell>
  );
}
