import { motion } from "framer-motion";

export default function StatCard({
  title,
  value,
  helper,
  accent = "from-primary-500 to-sky-500",
  onClick,
}) {
  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={`surface-card rounded-3xl p-5 shadow-lg shadow-primary-900/5 ${
        onClick ? "cursor-pointer transition hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-900" : ""
      }`}
    >
      <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <h3 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{value}</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
    </motion.div>
  );
}
