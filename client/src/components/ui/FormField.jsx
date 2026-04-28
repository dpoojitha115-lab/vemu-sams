export function FormField({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-500">{error}</span> : null}
    </label>
  );
}

export function TextInput(props) {
  return (
    <input
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-primary-950"
      {...props}
    />
  );
}

export function SelectInput({ children, ...props }) {
  return (
    <select
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-primary-950"
      {...props}
    >
      {children}
    </select>
  );
}

export function TextArea(props) {
  return (
    <textarea
      className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-primary-950"
      {...props}
    />
  );
}

