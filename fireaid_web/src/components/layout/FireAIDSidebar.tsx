"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Database, Terminal } from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps",   label: "Apps",   icon: LayoutGrid, href: "/apps" },
  { key: "data",   label: "Data",   icon: Database,   href: "/data" },
  { key: "prompt", label: "Prompt", icon: Terminal,   href: "/prompt" },
];

export default function FireAIDSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-5">
      {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex w-[60px] flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] font-semibold transition ${
              active ? "bg-navy-soft text-navy" : "text-slate-500 hover:bg-slate-100 hover:text-navy"
            }`}
          >
            {active && <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-full bg-gold" aria-hidden="true" />}
            <Icon size={22} strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
