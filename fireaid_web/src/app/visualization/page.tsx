"use client";

import Link from "next/link";
import { BarChart3, Search, TrendingUp, FileText } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";


const VIZ_ITEMS = [
  {
    label: "Search",
    desc: "Search historical fire records",
    icon: Search,
    href: "/search",
    accent: "#003366",
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    label: "Charts",
    desc: "Visualize fire data & trends",
    icon: BarChart3,
    href: "/charts",
    accent: "#7c3aed",
    bg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    label: "Prediction",
    desc: "AI-powered fire prediction",
    icon: TrendingUp,
    href: "/prediction",
    accent: "#ea580c",
    bg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    label: "Reports",
    desc: "Generate & export reports",
    icon: FileText,
    href: "/reports",
    accent: "#16a34a",
    bg: "bg-green-50",
    iconColor: "text-green-600",
  },
];

export default function VisualizationPage() {
  return (
    <div className="flex w-full min-h-screen">
      <FireAIDSidebar/>

      <main className="flex-1 flex flex-col">
        <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Visualization</h1>
          <p className="text-slate-400 text-sm mt-1">Explore fire data through charts, search, and reports</p>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
            {VIZ_ITEMS.map(({ label, desc, icon: Icon, href, bg, iconColor, accent }) => (
              <Link key={label} href={href}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-200">
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