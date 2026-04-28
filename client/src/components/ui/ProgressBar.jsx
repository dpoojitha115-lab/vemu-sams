export default function ProgressBar({ value, threshold = 75 }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const statusColor =
    safeValue >= threshold ? "from-emerald-500 to-teal-500" : "from-amber-400 to-rose-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <span>Attendance progress</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-3 rounded-full bg-gradient-to-r ${statusColor} transition-all`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Threshold: {threshold}% {safeValue < threshold ? " - warning zone" : " - safe zone"}
      </p>
    </div>
  );
}

