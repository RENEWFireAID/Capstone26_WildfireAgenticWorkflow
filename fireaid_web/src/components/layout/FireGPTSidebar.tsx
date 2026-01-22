import Link from "next/link";

type SidebarActive = "firegpt" | "explore";

export default function FireGPTSidebar({ active }: { active: SidebarActive }) {
  return (
    <aside className="flex w-60 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      {/* 顶部 logo + New analysis */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#003366] text-lg">
            <span className="text-[#FFCC33]">🔥</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold text-[#FFCC33]">
              UAF Wildfire Lab
            </span>
            <span className="text-xs font-semibold text-slate-900">
              FireGPT
            </span>
          </div>
        </div>
      </div>

      <button className="mb-4 w-full rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
        + New analysis
      </button>

      {/* Workspace */}
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Workspace
      </div>
      <nav className="space-y-1 text-xs">
        <SidebarItem icon="🔍" label="Search" />
        <SidebarItem icon="📊" label="Charts" />
        <SidebarItem icon="📚" label="Library" />
      </nav>

      {/* Agents & MCP Explore */}
      <div className="mt-5 mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Agents & Apps
      </div>
      <nav className="space-y-1 text-xs">
        <SidebarItem
          icon="🤖"
          label="FireGPT"
          href="/firegpt"
          active={active === "firegpt"}
        />
        <SidebarItem
          icon="🧩"
          label="Explore (MCP tools)"
          href="/mcp-tools"
          active={active === "explore"}
        />
      </nav>

      {/* Projects */}
      <div className="mt-5 mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Projects</span>
        <button className="text-[10px] text-slate-400 hover:text-slate-600">
          + New
        </button>
      </div>
      <div className="space-y-1 text-xs">
        <SidebarProject label="Interior Alaska 2024 fire season" />
        <SidebarProject label="Tundra NDVI trend explorer" />
        <SidebarProject label="Custom analysis workspace" muted />
      </div>

      <div className="mt-auto pt-4 text-[10px] text-slate-400">
        Signed in as <span className="font-semibold">ivy@uaf.edu</span>
      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  href,
  active,
}: {
  icon: string;
  label: string;
  href?: string;
  active?: boolean;
}) {
  const inner = (
    <div
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }

  return <button className="w-full text-left">{inner}</button>;
}

function SidebarProject({
  label,
  muted,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      className={`w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${
        muted
          ? "text-slate-400 hover:bg-slate-100"
          : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
