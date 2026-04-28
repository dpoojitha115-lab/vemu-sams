export default function Panel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`surface-card rounded-3xl p-5 shadow-lg shadow-primary-900/5 ${className}`}>
      {(title || subtitle || actions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

