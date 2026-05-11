"use client";

import Link from "next/link";
import { useState } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { BarChart3, BookOpen, FileText, Flame, Search, TrendingUp } from "lucide-react";

const APPS = [
  { label: "Terminology",        desc: "Browse wildfire terms & definitions", icon: BookOpen,   href: "/library",             accent: "#003366", bg: "bg-blue-50",   iconColor: "text-blue-600",  developer: "Jenae Matson", role: "Undergraduate Student · UAF Computer Science" },
  { label: "Publication",        desc: "Research papers & reports",          icon: FileText,   href: "/publication",         accent: "#64748b", bg: "bg-slate-100", iconColor: "text-slate-500", developer: "Utsav Dutta",  role: "Undergraduate Student · UAA Computer Science" },
  { label: "Fire History",       desc: "Explore historical fire records",    icon: Flame,      href: "/mcp-tools",           accent: "#ea580c", bg: "bg-orange-50", iconColor: "text-orange-500", developer: "Ivy Swenson",  role: "Undergraduate Student · UAF Computer Science" },
  { label: "Wildfire Prediction", desc: "AI-powered fire risk predictions",  icon: TrendingUp, href: "/wildfire-prediction", accent: "#dc2626", bg: "bg-red-50",    iconColor: "text-red-500" },
];

const VISUALS = [
  { label: "Search",     desc: "Search historical fire records",   icon: Search,     href: "/search",     accent: "#003366", bg: "bg-blue-50",   iconColor: "text-blue-600" },
  { label: "Charts",     desc: "Visualize fire data & trends",     icon: BarChart3,  href: "/charts",     accent: "#7c3aed", bg: "bg-violet-50", iconColor: "text-violet-600" },
  { label: "Prediction", desc: "AI-powered fire prediction",       icon: TrendingUp, href: "/prediction", accent: "#ea580c", bg: "bg-orange-50", iconColor: "text-orange-500" },
  { label: "Reports",    desc: "Generate & export reports",        icon: FileText,   href: "/reports",    accent: "#16a34a", bg: "bg-green-50",  iconColor: "text-green-600" },
];

export default function AppsPage() {
  return (
    <div className="flex w-full min-h-screen">
      <FireAIDSidebar/>

      <main className="flex-1 flex flex-col">
        <div className="bg-slate-50 px-12 py-8 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Apps</h1>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
          {APPS.map(({ label, desc, icon: Icon, href, bg, iconColor, accent }) => (
  <Link key={label} href={href}
    className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all duration-200">
    <div className="h-1.5 w-full" style={{ background: accent }} />
    <div className="p-6 flex flex-col gap-4">
      <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center`}>
        <Icon size={28} className={iconColor} strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-base font-semibold text-slate-800 group-hover:text-[#003366] transition">{label}</div>
        <div className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</div>
      </div>
      {/* {developer && (
        <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#003366] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {developer.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-700">{developer}</div>
            <div className="text-[10px] text-slate-400">{role}</div>
          </div>
        </div>
      )} */}
      <div className="text-xs font-semibold text-[#003366] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">Open →</div>
    </div>
  </Link>
))}
          </div>
        </div>
      </main>
    </div>
  );
}
