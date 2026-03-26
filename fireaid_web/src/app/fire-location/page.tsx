"use client";

import Link from "next/link";
import { LayoutGrid, Database, Terminal, BarChart3, Download, MapPin } from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps",   label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",   label: "DATA",   icon: Database,   href: "/data" },
  { key: "prompt", label: "PROMPT", icon: Terminal,    href: "/prompt" },
];

export default function FireLocationPage() {
  return (
    <div className="flex w-full min-h-screen">
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shrink-0">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href}
            className={`w-11 py-2.5 flex flex-col items-center gap-1 text-[8px] font-semibold tracking-widest transition ${
              key === "data"
                ? "rounded-l-xl bg-blue-50 text-[#003366] border-r-[3px] border-[#003366] w-12"
                : "rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366]"
            }`}>
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="bg-[#003366] px-12 py-10">
          <p className="text-[#FFCC33] text-xs font-semibold tracking-widest uppercase mb-1">FireAID · Data</p>
          <div className="flex items-center gap-4">
            <img src="/uaf-logo.png" alt="UAF" style={{ height: 48, width: "auto", mixBlendMode: "screen" }} />
            <h1 className="text-3xl font-bold text-white tracking-tight">Fire Location</h1>
          </div>
          <p className="text-blue-200 text-sm mt-1">Alaska fire location point data</p>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-10">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-6">Available Dataset</p>

          <a
            href="/fire-location/AK_fire_location_points.csv"
            download="AK_fire_location_points.csv"
            className="group inline-flex items-center gap-5 bg-white border border-slate-200 rounded-2xl px-8 py-6 hover:border-[#003366] hover:shadow-lg transition"
            >
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
              <MapPin size={28} className="text-green-600" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-800 group-hover:text-[#003366] transition">
                AK Fire Location Points
              </div>
              <div className="text-xs text-slate-400 mt-1">AK_fire_location_points.csv</div>
            </div>
            <div className="ml-8 flex items-center gap-2 text-sm font-semibold text-[#003366] opacity-0 group-hover:opacity-100 transition">
              <Download size={16} />
              Download
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}