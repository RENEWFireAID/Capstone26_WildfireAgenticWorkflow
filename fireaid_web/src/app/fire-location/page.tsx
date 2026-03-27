"use client";

import Link from "next/link";
import Topbar from "@/components/topbar/Topbar";
import {
  LayoutGrid,
  Database,
  Terminal,
  Download,
  MapPin,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps", label: "APPS", icon: LayoutGrid, href: "/apps" },
  { key: "data", label: "DATA", icon: Database, href: "/data" },
  { key: "prompt", label: "PROMPT", icon: Terminal, href: "/prompt" },
];

export default function FireLocationPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Topbar />
      <div className="flex flex-1">
        <aside className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white py-6">
          {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
            <Link
              key={key}
              href={href}
              className={`flex w-11 flex-col items-center gap-1 py-2.5 text-[8px] font-semibold tracking-widest transition ${
                key === "data"
                  ? "w-12 rounded-l-xl border-r-[3px] border-[#003366] bg-blue-50 text-[#003366]"
                  : "rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366]"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </aside>

        <main className="flex flex-1 flex-col">
          <div className="border-b border-slate-200 bg-slate-50 px-12 py-10">
            <p className="mb-1 text-xs uppercase tracking-widest text-slate-400">
              FireAID · Data
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Fire Location
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Alaska fire location point data
            </p>
          </div>

          <div className="flex-1 bg-slate-50 px-12 py-10">
            <p className="mb-6 text-xs uppercase tracking-widest text-slate-400">
              Available Dataset
            </p>

            <a
              href="/fire-location/AK_fire_location_points.csv"
              download="AK_fire_location_points.csv"
              className="group inline-flex items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-6 transition hover:border-[#003366] hover:shadow-lg"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-50">
                <MapPin size={28} className="text-green-600" strokeWidth={1.5} />
              </div>

              <div>
                <div className="text-base font-semibold text-slate-800 transition group-hover:text-[#003366]">
                  AK Fire Location Points
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  AK_fire_location_points.csv
                </div>
              </div>

              <div className="ml-8 flex items-center gap-2 text-sm font-semibold text-[#003366] opacity-0 transition group-hover:opacity-100">
                <Download size={16} />
                Download
              </div>
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
