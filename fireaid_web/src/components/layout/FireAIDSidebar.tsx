"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Database, Terminal } from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps",          label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",          label: "DATA",   icon: Database,   href: "/data" },
  { key: "prompt",        label: "PROMPT", icon: Terminal,   href: "/prompt" },
];

export default function FireAIDSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shrink-0">
      {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
        <Link
          key={key}
          href={href}
          className="w-11 py-2.5 rounded-xl flex flex-col items-center gap-1 text-slate-400 hover:bg-slate-100 hover:text-[#003366] transition text-[8px] font-semibold tracking-widest"
        >
          <Icon size={18} strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </aside>
  );
}
