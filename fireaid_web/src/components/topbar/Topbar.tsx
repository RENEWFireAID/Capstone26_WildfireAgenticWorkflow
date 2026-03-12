"use client";
import Link from "next/link";

export default function Topbar() {
  return (
    <header className="border-b border-slate-200 bg-[#003366]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        {/* leftside: Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-2 ring-[#FFCC33]">
            <span className="text-xl font-bold text-[#FFCC33]">🔥</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wide text-[#FFCC33]">
              UAF Data/AI Lab
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              FireAID
            </span>
          </div>
        </div>
        {/* Middle */}
        <nav className="hidden items-center gap-10 text-sm font-semibold text-slate-200 md:flex">
          {[
            { label: "Terminology", href: "/library" },
            { label: "Data", href: "/search" },
            { label: "Tools", href: "/mcp-tools" },
            { label: "Apps", href: "/reports" },
            { label: "Visualization", href: "/charts" },
            { label: "Chat", href: "/chat" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="border-b-2 border-transparent pb-1 transition hover:border-[#FFCC33] hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
        {/* rightside: only keep "search bar" */}
        <div className="flex items-center gap-3">
          <button className="rounded-full bg-[#FFCC33] px-3 py-1 text-[11px] font-semibold text-[#003366] shadow hover:bg-amber-300">
            Upload data
          </button>

        </div>
      </div>
      {/* bottom line */}
      <div className="h-1 w-full bg-[#FFCC33]" />
    </header>
  );
}