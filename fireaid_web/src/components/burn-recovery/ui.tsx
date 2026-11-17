"use client";

import type { ReactNode } from "react";
import { FIELD, Notice, Placeholder, Stat } from "@/components/ui/app";

export function Select<T extends string>({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: T;
  options: readonly T[] | { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const items = (options as readonly (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={FIELD}>
        {items.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return <Notice tone={tone}>{children}</Notice>;
}

export const Caption = ({ children }: { children: ReactNode }) => (
  <p className="text-xs leading-relaxed text-slate-500">{children}</p>
);

/** A section heading inside a tab; later sections get a rule above them. */
export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="[&:not(:first-child)]:mt-8 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-slate-200 [&:not(:first-child)]:pt-6">
      <h2 className="text-xl font-bold leading-tight text-navy-deep">{title}</h2>
      {subtitle && <p className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Table({ columns, rows, numeric = [] }: { columns: string[]; rows: (string | number)[][]; numeric?: number[] }) {
  return (
    <div className="overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            {columns.map((c, i) => (
              <th key={c} className={`whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 ${numeric.includes(i) ? "text-right" : ""}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-slate-100 last:border-0">
              {row.map((v, i) => (
                <td key={i} className={`whitespace-nowrap px-4 py-2.5 ${numeric.includes(i) ? "text-right font-mono font-semibold text-navy-deep" : "text-slate-700"}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Details({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-navy-deep transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-navy group-open:hidden">Show</span>
        <span className="hidden font-mono text-xs font-semibold uppercase tracking-wide text-navy group-open:inline">Hide</span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </details>
  );
}

export function Metrics({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
      {items.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
    </dl>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <Placeholder height="py-16">{label}</Placeholder>;
}

export function LoadError({ message }: { message: string }) {
  return <Note tone="warning">Could not load this part of the study: {message}</Note>;
}
