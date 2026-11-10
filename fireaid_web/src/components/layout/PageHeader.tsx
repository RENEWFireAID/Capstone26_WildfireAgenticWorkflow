import type { ReactNode } from "react";

/**
 * The header every section page opens with: where you are, what the page is
 * for, and, where the page shows data, where that data comes from.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: string[];
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-7 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
          )}
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-navy-deep text-balance">{title}</h1>
          {description && <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{description}</p>}
          {meta && meta.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-500">
              {meta.map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden="true" />
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
