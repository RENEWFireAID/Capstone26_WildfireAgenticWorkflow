"use client";

import Topbar from "@/components/topbar/Topbar";
import {
  Download,
  FileText,
  Search,
} from "lucide-react";
import { useState } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";


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

  const filtered = FILES.filter((file) =>
    file.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Topbar />
      <div className="flex flex-1">
        <FireAIDSidebar/>

        <main className="flex flex-1 flex-col">
          <div className="border-b border-slate-200 bg-slate-50 px-12 py-10">
            <p className="mb-1 text-xs uppercase tracking-widest text-slate-400">
              FireAID · Data
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Weather Data
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Weather datasets from across Alaska — {FILES.length} files available
            </p>
          </div>

          <div className="flex-1 bg-slate-50 px-12 py-8">
            <div className="mb-6 flex items-center gap-4">
              <div className="relative max-w-sm flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[#003366]"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-400">{filtered.length} files</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((file) => (
                <a
                  key={file}
                  href={`/weather/${file}`}
                  download={file}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-[#003366] hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <FileText
                      size={20}
                      className="text-amber-500"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="break-all text-[11px] font-medium leading-tight text-slate-600">
                    {file.replace(".csv", "")}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#003366] opacity-0 transition group-hover:opacity-100">
                    <Download size={11} />
                    Download
                  </div>
                </a>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-400">
                No files found
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
