import { Bell, LogOut, Moon, School, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export default function AppShell({ title, subtitle, notifications = [], children, sections = [] }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="page-grid min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="glass-card rounded-[2rem] p-5">
          <div className="flex items-center gap-3">
            <img src="/vemu-mark.svg" alt="VEMU mark" className="h-14 w-14 rounded-2xl" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary-600 dark:text-primary-300">
                Academic ERP
              </p>
              <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-white">VEMU SAMS</h1>
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-gradient-to-br from-primary-600 to-sky-500 p-4 text-white">
            <p className="text-sm opacity-80">Logged in as</p>
            <h2 className="mt-1 text-lg font-semibold">{user?.name}</h2>
            <p className="text-sm opacity-90">{user?.role?.toUpperCase()}</p>
            <p className="mt-3 text-xs opacity-80">{user?.departmentCode || "Central Administration"}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {sections.map((item, index) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <NavLink
                  to={`/dashboard/${item.key}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                      isActive
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-900/20"
                        : "text-slate-700 hover:bg-primary-50 hover:text-primary-700 dark:text-slate-200 dark:hover:bg-primary-950/40"
                    }`
                  }
                >
                  <School className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              </motion.div>
            ))}
          </nav>

          <button
            onClick={logout}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <main className="space-y-4">
          <div className="glass-card rounded-[2rem] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-primary-600 dark:text-primary-300">
                  Student Attendance Management System
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{title}</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 text-slate-700 ring-1 ring-slate-200 transition hover:bg-primary-50 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <div className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                </div>
              </div>
            </div>

            {notifications.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {notifications.slice(0, 3).map((notice) => (
                  <div
                    key={notice._id || notice.message}
                    className="rounded-2xl bg-primary-50/90 px-4 py-3 text-sm text-primary-800 dark:bg-primary-950/40 dark:text-primary-100"
                  >
                    <p className="font-medium">{notice.title}</p>
                    <p className="mt-1 text-xs opacity-90">{notice.message}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
