import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-semibold text-slate-900 dark:text-white">404</h1>
      <p className="mt-3 text-slate-500 dark:text-slate-400">The page you are looking for does not exist.</p>
      <Link className="mt-6 rounded-2xl bg-primary-600 px-5 py-3 text-white" to="/">
        Back to login
      </Link>
    </div>
  );
}
