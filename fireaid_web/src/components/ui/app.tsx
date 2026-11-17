"use client";

/**
 * The shared look of every FireAID app page, taken from Forest Trends:
 * a white page header, a pale working area, and square white panels lifted by
 * a soft shadow, with UAF gold for the one primary action on a panel and navy
 * outlines for the rest. Use these instead of styling app pages by hand.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";

export const SHADOW = "shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]";

/** Square text input or select. */
export const FIELD =
  "h-9 w-full min-w-0 border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-navy disabled:bg-slate-50 disabled:text-slate-400";

const BUTTON = {
  primary: "bg-gold text-navy-deep hover:bg-[#ffd94d]",
  secondary: "border border-navy bg-white text-navy hover:bg-navy-soft",
  quiet: "text-slate-500 hover:bg-slate-100 hover:text-navy",
} as const;

export function buttonClass(variant: keyof typeof BUTTON = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 px-4 py-2 font-mono text-sm font-semibold uppercase tracking-wide transition disabled:opacity-40 ${BUTTON[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON;
}) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

/** Sidebar, page header and the pale working area every app page sits in. */
export function AppPage({ eyebrow, title, description, meta, actions, children }: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  meta?: string[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader eyebrow={eyebrow} title={title} description={description} meta={meta} actions={actions} />
        <div className="flex-1 space-y-6 bg-slate-50 px-6 py-6 md:px-10">{children}</div>
      </main>
    </div>
  );
}

/** A square white panel. `accent` marks the panel holding the page's main controls. */
export function Panel({ title, subtitle, aside, accent = false, flush = false, className = "", children }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  accent?: boolean;
  /** No inner padding, for maps and tables that run to the edges. */
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`min-w-0 bg-white ${SHADOW} ${accent ? "border-t-4 border-gold" : ""} ${flush ? "" : "p-5"} ${className}`}>
      {(title || aside) && (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${flush ? "px-5 pt-5" : ""} ${children ? "mb-4" : ""}`}>
          <div className="min-w-0">
            {title && <h2 className="text-xl font-bold leading-tight text-navy-deep">{title}</h2>}
            {subtitle && <div className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</div>}
          </div>
          {aside && <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

export function Check({ label, checked, onChange, disabled }: {
  label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "text-slate-400" : "text-slate-700"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#236192]" />
      {label}
    </label>
  );
}

/** A row of square toggle buttons; the chosen one is filled navy. */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md" }: {
  options: readonly T[] | readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const items = (options as readonly (T | { value: T; label: ReactNode })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o as ReactNode } : o,
  );
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {items.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`border font-semibold transition ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
            value === o.value ? "border-navy bg-navy text-white" : "border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-slate-200 pt-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-mono text-lg font-semibold text-navy-deep tabular">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

const NOTICE = {
  info: { box: "border-slate-200 bg-slate-50 text-slate-700", icon: Info, iconColor: "text-navy" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-950", icon: AlertTriangle, iconColor: "text-amber-700" },
  error: { box: "border-red-200 bg-red-50 text-red-900", icon: XCircle, iconColor: "text-red-700" },
} as const;

export function Notice({ tone = "info", children, className = "" }: { tone?: keyof typeof NOTICE; children: ReactNode; className?: string }) {
  const t = NOTICE[tone];
  const Icon = t.icon;
  return (
    <div className={`flex gap-2.5 border px-4 py-3 text-sm leading-relaxed ${t.box} ${className}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${t.iconColor}`} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** An empty or waiting state inside a panel. */
export function Placeholder({ children, height = "py-10" }: { children: ReactNode; height?: string }) {
  return (
    <div className={`border border-dashed border-slate-300 bg-white px-5 ${height} text-center text-sm text-slate-500`}>
      {children}
    </div>
  );
}

/** Chart tooltip colours shared by the recharts on every app page. */
export const TOOLTIP_STYLE = { backgroundColor: "#111c4e", border: "none", color: "white", fontSize: 12 } as const;
