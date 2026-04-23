import Link from "next/link";
import { LayoutGrid, Database, Terminal } from "lucide-react";
import Topbar from "@/components/topbar/Topbar";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";


const TEAM = [
    
        { name: "Elliott Lewandowski", role: "UAF Undergraduate Student", initials: "EL", color: "bg-blue-100 text-blue-700" },
        { name: "Ivy Swenson",         role: "UAF Undergraduate Student", initials: "IS", color: "bg-orange-100 text-orange-700" },
        { name: "Andrew Winford",      role: "UAF Undergraduate Student", initials: "AW", color: "bg-green-100 text-green-700" },
        { name: "Jenae Matson",        role: "UAF Undergraduate Student", initials: "JM", color: "bg-purple-100 text-purple-700" },
        { name: "Daniel Kim",          role: "UAF Undergraduate Student", initials: "DK", color: "bg-teal-100 text-teal-700" },
        { name: "Utsav Dutta",         role: "UAA Undergraduate Student", initials: "UD", color: "bg-rose-100 text-rose-700" },
        { name: "Yara Hassan",         role: "UAA Undergraduate Student", initials: "YH", color: "bg-red-100 text-red-700" },
        { name: "Malachi Retherford",  role: "UAA Undergraduate Student", initials: "MR", color: "bg-indigo-100 text-indigo-700" },
];

const PIS = [
    
        { name: "Arghya Kusum Das", role: "Principal Investigator", initials: "AD", color: "bg-red-100 text-red-700" },
        { name: "Orion Lawlor",     role: "Co-Investigator",        initials: "OL", color: "bg-indigo-100 text-indigo-700" },
        { name: "Santosh Panda",    role: "Co-Investigator",        initials: "SP", color: "bg-rose-100 text-rose-700" },
        { name: "Mario Muscarella", role: "Co-Investigator",        initials: "MM", color: "bg-blue-100 text-blue-700" },
        { name: "Liam Forbes",      role: "Co-Investigator",        initials: "LF", color: "bg-green-100 text-green-700" },
        { name: "Kevin Galloway",   role: "Co-Investigator",        initials: "KG", color: "bg-teal-100 text-teal-700" },
        { name: "Murat Kaceli",     role: "Co-Investigator",        initials: "MK", color: "bg-orange-100 text-orange-700" },
        { name: "Tanwi Mallick",    role: "Co-Investigator",        initials: "TM", color: "bg-purple-100 text-purple-700"},
];

export default function TeamPage() {
  return (
    <div className="flex w-full min-h-screen">
      <FireAIDSidebar/>

      <main className="flex-1 flex flex-col">
        <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Student Team</h1>
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

        <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Principal Investigator and Co-Investigators</h1>
          <p className="text-slate-400 text-sm mt-1">UAF Data/AI Lab — Wildfire Intelligence Project</p>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
            {PIS.map(({ name, role, initials, color }) => (
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