"use client";

import Link from "next/link";
import {
  LayoutGrid,
  BarChart3,
  Database,
  Terminal,
  Download,
  FileText,
  Search,
} from "lucide-react";
import { useState } from "react";

const SIDEBAR_ITEMS = [
  { key: "apps", label: "APPS", icon: LayoutGrid, href: "/apps" },
  { key: "data", label: "DATA", icon: Database, href: "/data" },
  { key: "visualization", label: "VISUAL", icon: BarChart3, href: "/visualization" },
  { key: "prompt", label: "PROMPT", icon: Terminal, href: "/prompt" },
];

const FILES = [
  "weatherdata-682-1478.csv",
  "weatherdata-682-1481.csv",
  "weatherdata-682-1484.csv",
  "weatherdata-682-1488.csv",
  "weatherdata-682-1491.csv",
  "weatherdata-685-1478.csv",
  "weatherdata-685-1481.csv",
  "weatherdata-685-1484.csv",
  "weatherdata-685-1488.csv",
  "weatherdata-685-1491.csv",
  "weatherdata-688-1478.csv",
  "weatherdata-688-1481.csv",
  "weatherdata-688-1484.csv",
  "weatherdata-688-1488.csv",
  "weatherdata-688-1491.csv",
  "weatherdata-692-1478.csv",
  "weatherdata-692-1481.csv",
  "weatherdata-692-1484.csv",
  "weatherdata-692-1488.csv",
  "weatherdata-692-1491.csv",
  "weatherdata-695-1478.csv",
  "weatherdata-695-1481.csv",
  "weatherdata-695-1484.csv",
  "weatherdata-695-1488.csv",
  "weatherdata-695-1491.csv",
  "weatherdata-698-1478.csv",
  "weatherdata-698-1481.csv",
  "weatherdata-698-1484.csv",
  "weatherdata-698-1488.csv",
  "weatherdata-698-1491.csv",
  "weatherdata-701-1478.csv",
  "weatherdata-701-1481.csv",
  "weatherdata-701-1484.csv",
  "weatherdata-701-1488.csv",
  "weatherdata-701-1491.csv",
];

export default function WeatherPage() {
  const [search, setSearch] = useState("");
  const filtered = FILES.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex w-full min-h-screen">
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shrink-0">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
          <Link
            key={key}
            href={href}
            className={`w-11 py-2.5 flex flex-col items-center gap-1 text-[8px] font-semibold tracking-widest transition ${
              key === "data"
                ? "rounded-l-xl bg-blue-50 text-[#003366] border-r-[3px] border-[#003366] w-12"
                : "rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366]"
            }`}
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="bg-[#003366] px-12 py-10">
          <p className="text-[#FFCC33] text-xs font-semibold tracking-widest uppercase mb-1">
            FireAID · Data
          </p>
          <div className="flex items-center gap-4">
            <img
              src="/uaf-logo.png"
              alt="UAF"
              style={{ height: 48, width: "auto", mixBlendMode: "screen" }}
            />
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Weather Data
            </h1>
          </div>
          <p className="text-blue-200 text-sm mt-1">
            Weather datasets from across Alaska — {FILES.length} files available
          </p>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-[#003366] transition"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-xs text-slate-400">{filtered.length} files</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((file) => (
              <a
                key={file}
                href={`/weather/${file}`}
                download={file}
                className="group bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3 hover:border-[#003366] hover:shadow-md transition text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <FileText
                    size={20}
                    className="text-amber-500"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-[11px] text-slate-600 font-medium leading-tight break-all">
                  {file.replace(".csv", "")}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#003366] opacity-0 group-hover:opacity-100 transition font-semibold">
                  <Download size={11} />
                  Download
                </div>
              </a>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-16">
              No files found
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
