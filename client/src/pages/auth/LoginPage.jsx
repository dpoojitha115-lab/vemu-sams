import { Eye, EyeOff, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { FormField, SelectInput, TextInput } from "../../components/ui/FormField";
import Button from "../../components/ui/Button";
import api from "../../api/client";

const roles = [
  { value: "admin", label: "Admin" },
  { value: "hod", label: "HOD" },
  { value: "faculty", label: "Faculty" },
  { value: "student", label: "Student" },
];

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "admin" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  function validate(nextForm = form) {
    const nextErrors = {};
    if (!nextForm.username.trim()) nextErrors.username = "Username is required.";
    if (!passwordRule.test(nextForm.password)) {
      nextErrors.password =
        "Minimum 8 chars with uppercase, lowercase, and special character.";
    }
    return nextErrors;
  }

  function handleChange(event) {
    const nextForm = { ...form, [event.target.name]: event.target.value };
    setForm(nextForm);
    setErrors(validate(nextForm));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await login(form);
      toast.success("Welcome back to SAMS.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!form.username) {
      setErrors((current) => ({ ...current, username: "Enter username to generate reset link." }));
      return;
    }

    try {
      const { data } = await api.post("/auth/forgot-password", { username: form.username });
      setResetMessage(data.resetLink);
      toast.success("Mock reset link generated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to generate reset link.");
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.35),_transparent_26%),linear-gradient(135deg,_rgba(255,255,255,0.65),_rgba(219,234,254,0.95))]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(37,99,235,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute left-0 top-0 h-80 w-80 -translate-x-24 -translate-y-24 rounded-full bg-primary-300/40 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-20 translate-y-20 rounded-full bg-sky-300/40 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="inline-flex items-center gap-4 rounded-3xl bg-white/70 p-4 shadow-xl shadow-primary-900/10 backdrop-blur-xl">
            <img src="/vemu-mark.svg" alt="VEMU mark" className="h-16 w-16 rounded-3xl" />
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-primary-600">VEMU Institute of Technology</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Student Attendance Management System</h1>
            </div>
          </div>

          <div className="max-w-2xl">
            <p className="inline-flex rounded-full bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-primary-700 shadow-sm">
              Academic Command Platform
            </p>
            <h2 className="mt-5 text-5xl font-semibold leading-tight text-slate-900">
              Centralize attendance, analytics, and student interventions in one modern workspace.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Built for administrators, HODs, faculty, and students with secure access, live dashboards, exports, and low-attendance intelligence.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              "Department-wise charts and trends",
              "Role-based access with JWT security",
              "Excel, CSV, and PDF report exports",
            ].map((item) => (
              <div key={item} className="glass-card rounded-3xl p-4 text-sm text-slate-700 dark:text-slate-100">
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card rounded-[2rem] p-6 sm:p-8"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            {!logoFailed ? (
              <img
                src="https://vemu.ac.in/images/vemu-logo.png"
                alt="VEMU Institute of Technology logo"
                className="h-20 w-auto object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="rounded-3xl border border-primary-200 bg-white px-6 py-3 text-lg font-semibold text-primary-700 shadow-sm">
                VEMU
              </div>
            )}
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] text-primary-700">
              VEMU Institute of Technology
            </p>
          </div>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-primary-100 p-3 text-primary-700">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">Secure Login</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Use your role-based academic credentials.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Role" error={errors.role}>
              <SelectInput name="role" value={form.role} onChange={handleChange}>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Username" error={errors.username}>
              <TextInput
                name="username"
                placeholder="Enter username"
                value={form.username}
                onChange={handleChange}
              />
            </FormField>

            <FormField label="Password" error={errors.password}>
              <div className="relative">
                <TextInput
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </FormField>

            <div className="rounded-2xl bg-primary-50 px-4 py-3 text-xs text-primary-800 dark:bg-primary-950/40 dark:text-primary-100">
              Demo credentials: `admin / Admin@123`, `hod.cse / Hod@1234`, `faculty.cse.01 / Faculty@123`, `student.cse.1.001 / Student@123`
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={handleForgotPassword} className="text-sm font-medium text-primary-700">
                Forgot password?
              </button>
              <Button type="submit" className="min-w-32" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </Button>
            </div>
          </form>

          {resetMessage ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
              Reset link generated: <a className="font-medium underline" href={resetMessage}>{resetMessage}</a>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
