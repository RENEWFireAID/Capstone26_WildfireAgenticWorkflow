"use client";
import Link from "next/link";

export default function Topbar() {
  return (
    <header className="border-b border-slate-200 bg-[#003366]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        {/* leftside: Logo */}
        <div className="flex items-center gap-4">
          <img
            src="/uaf-logo.png"
            alt="UAF Logo"
            style={{
              height: 48,
              width: "auto",
              mixBlendMode: "screen",
              transform: "scale(2.0)",
              transformOrigin: "left center",
            }}
          />
          <div className="h8 w-px bg-white/20 ml-10" />
          
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wide text-[#FFCC33]">
              Data/AI Lab
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
               FireAID
            </span>
            <span className="text-[10px] font-medium text-white/50 tracking-wide">
              Beta v1.0
            </span>
            </div>
        </div>
        

        {/* Middle */}
        <nav className="hidden items-center gap-30 text-sm font-semibold text-slate-200 md:flex ml-10">
          {[
            { label: "Home",   href: "/" },
            { label: "Chat",   href: "/portal" },
            { label: "Apps",   href: "/apps" },
            { label: "Data",   href: "/data" },
            { label: "Prompt", href: "/prompt" },
            { label: "Team",   href: "/team" },
        
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
      </div>

      {/* bottom line */}
      <div className="h-1 w-full bg-[#FFCC33]" />
    </header>
  );
}
