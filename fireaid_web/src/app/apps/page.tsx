"use client";

import Link from "next/link";
import { LayoutGrid, Database, Terminal, BarChart3, BookOpen, FileText, Flame } from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps",   label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",   label: "DATA",   icon: Database,   href: "/data" },
  { key: "visualization", label: "VISUAL", icon: BarChart3, href: "/visualization" },
  { key: "prompt", label: "PROMPT", icon: Terminal,    href: "/prompt" },
];

const APPS = [
  {
    label: "Terminology",
    desc: "Browse wildfire terms & definitions",
    icon: BookOpen,
    href: "/library",
    accent: "#003366",
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    label: "Publication",
    desc: "Research papers & reports",
    icon: FileText,
    href: "/publication",
    accent: "#64748b",
    bg: "bg-slate-100",
    iconColor: "text-slate-500",
  },
  {
    label: "Fire History",
    desc: "Explore historical fire records",
    icon: Flame,
    href: "/mcp-tools",
    accent: "#ea580c",
    bg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
];

export default function AppsPage() {
  return (
    <div className="flex w-full min-h-screen">
      {/* SIDEBAR */}
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 flex-shrink-0">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href}
            className={`w-11 py-2.5 flex flex-col items-center gap-1 text-[8px] font-semibold tracking-widest transition
              ${key === "apps"
                ? "rounded-l-xl bg-blue-50 text-[#003366] border-r-[3px] border-[#003366] w-12"
                : "rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366]"}`}>
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col">
      <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Apps</h1>
          <p className="text-slate-400 text-sm mt-1">Select a tool to get started</p>
      </div>
        {/* Cards */}
        <div className="flex-1 bg-slate-50 px-12 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
            {APPS.map(({ label, desc, icon: Icon, href, bg, iconColor, accent }) => (
              <Link key={label} href={href}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-200">
                {/* Color bar */}
                <div className="h-1.5 w-full" style={{ background: accent }} />
                <div className="p-6 flex flex-col gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center`}>
                    <Icon size={28} className={iconColor} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-800 group-hover:text-[#003366] transition">
                      {label}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</div>
                  </div>
                  <div className="text-xs font-semibold text-[#003366] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    Open →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
