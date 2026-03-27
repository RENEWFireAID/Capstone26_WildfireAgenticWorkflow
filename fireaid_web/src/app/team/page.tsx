import Link from "next/link";
import { LayoutGrid, Database, Terminal } from "lucide-react";
import Topbar from "@/components/topbar/Topbar";

const SIDEBAR_ITEMS = [
  { key: "apps",   label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",   label: "DATA",   icon: Database,   href: "/data" },
  { key: "prompt", label: "PROMPT", icon: Terminal,   href: "/prompt" },
];

const TEAM = [
    
        { name: "Elliott Lewandowski", role: "Full Stack & LLM Engineer",  initials: "EL", color: "bg-blue-100 text-blue-700" },
        { name: "Ivy Swenson",         role: "UI Design & MCP Integration", initials: "IS", color: "bg-orange-100 text-orange-700" },
        { name: "Andrew Winford",      role: "MCP Tools Developer",         initials: "AW", color: "bg-green-100 text-green-700" },
        { name: "Jenae Matson",        role: "Knowledge Base & LLM",        initials: "JM", color: "bg-purple-100 text-purple-700" },
        { name: "Daniel Kim",          role: "Prompt Engineer",             initials: "DK", color: "bg-teal-100 text-teal-700" },
        { name: "Utsav Dutta",         role: "LLM Systems Design",          initials: "UD", color: "bg-rose-100 text-rose-700" },
      
];

export default function TeamPage() {
  return (
    <div className="flex w-full min-h-screen">
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shrink-0">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href}
            className="rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366] transition w-11 py-2.5 flex flex-col items-center gap-1 text-[8px] font-semibold tracking-widest">
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Team</h1>
          <p className="text-slate-400 text-sm mt-1">UAF Data/AI Lab — Wildfire Intelligence Project</p>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
            {TEAM.map(({ name, role, initials, color }) => (
              <div key={name}
                className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5 hover:shadow-lg hover:border-slate-300 transition-all">
                <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-lg font-bold shrink-0`}>
                  {initials}
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-800">{name}</div>
                  <div className="text-xs text-slate-400 mt-1">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}