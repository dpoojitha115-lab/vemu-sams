import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import NotFoundPage from "./pages/shared/NotFoundPage";
import { useAuth } from "./context/AuthContext";

const DashboardPage = lazy(() => import("./pages/dashboards/DashboardPage"));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600 dark:text-slate-200">
        Loading secure workspace...
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route
        path="/dashboard/:section?"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center text-slate-600 dark:text-slate-200">
                  Loading dashboard module...
                </div>
              }
            >
              <DashboardPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
