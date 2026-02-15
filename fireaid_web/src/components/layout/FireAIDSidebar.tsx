"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, BarChart3, Book, Bot, Puzzle } from "lucide-react";

export default function FireGPTSidebar({ active }: { active: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* 顶部品牌 */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white text-lg">
            🔥
          </div>
          <div>
            <div className="text-xs text-slate-500">UAF Wildfire Lab</div>
            <div className="text-lg font-bold text-slate-900">FireAID</div>
          </div>
        </div>

        <Link
          href="/firegpt"
          className="mt-4 block w-full rounded-xl border border-blue-500 px-3 py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
        >
          + New analysis
        </Link>
      </div>

      {/* WORKSPACE */}
      <Section title="WORKSPACE">
        <NavItem
          icon={Search}
          label="Search"
          href="/firegpt"
          active={pathname === "/firegpt"}
        />
        <NavItem
          icon={BarChart3}
          label="Charts"
          href="/firegpt"
          active={false}
        />
        <NavItem
          icon={Book}
          label="Library"
          href="/firegpt"
          active={false}
        />
      </Section>

      {/* AI & MCP */}
      <Section title="AI & TOOLS">
        <NavItem
          icon={Bot}
          label="FireAID Assistant"
          href="/firegpt"
          active={pathname === "/firegpt"}
        />
        <NavItem
          icon={Puzzle}
          label="Explore (MCP tools)"
          href="/mcp-tools"
          active={pathname === "/mcp-tools"}
        />
      </Section>

      {/* PROJECTS */}
      <Section title="PROJECTS">
        <div className="space-y-2 text-xs">
          <ProjectItem name="Interior Alaska 2024 fire season" />
          <ProjectItem name="Tundra NDVI trend explorer" />
          <Link
            href="/firegpt"
            className="mt-1 block text-blue-600 hover:underline"
          >
            Custom analysis workspace
          </Link>
        </div>
      </Section>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 text-[11px] uppercase tracking-widest text-slate-400">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: any;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition
        ${
          active
            ? "bg-blue-50 text-blue-600 font-semibold"
            : "text-slate-700 hover:bg-slate-100"
        }`}
    >
      <Icon size={18} className={active ? "text-blue-600" : "text-slate-500"} />
      {label}
    </Link>
  );
}

function ProjectItem({ name }: { name: string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 cursor-pointer transition">
      {name}
    </div>
  );
}
