export default function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}) {
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    secondary: "bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
    ghost: "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

