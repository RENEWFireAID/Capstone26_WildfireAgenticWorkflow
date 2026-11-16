"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-navy"
      >
        {items.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={`flex gap-2.5 rounded-lg border px-4 py-3 text-sm leading-relaxed ${
        tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${tone === "warning" ? "text-amber-700" : "text-navy"}`} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const Caption = ({ children }: { children: ReactNode }) => (
  <p className="text-xs leading-relaxed text-slate-500">{children}</p>
);

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight text-navy-deep">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Table({ columns, rows, numeric = [] }: { columns: string[]; rows: (string | number)[][]; numeric?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {columns.map((c, i) => (
              <th key={c} className={`whitespace-nowrap px-4 py-2.5 font-semibold ${numeric.includes(i) ? "text-right" : ""}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-slate-100 last:border-0">
              {row.map((v, i) => (
                <td key={i} className={`whitespace-nowrap px-4 py-2.5 text-slate-700 ${numeric.includes(i) ? "text-right font-mono" : ""}`}>{v}</td>
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
    <details className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-xs font-semibold text-navy group-open:hidden">Show</span>
        <span className="hidden text-xs font-semibold text-navy group-open:inline">Hide</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{children}</div>
    </details>
  );
}

export function Metrics({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="bg-white px-5 py-4">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-1 font-mono text-2xl font-semibold tabular text-navy-deep">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm text-slate-500">{label}</div>;
}

export function LoadError({ message }: { message: string }) {
  return <Note tone="warning">Could not load this part of the study: {message}</Note>;
}
