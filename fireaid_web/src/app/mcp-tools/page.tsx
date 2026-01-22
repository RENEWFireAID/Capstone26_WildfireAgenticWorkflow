import FireGPTSidebar from "@/components/layout/FireGPTSidebar";
import ToolButton from "@/components/ui/ToolButton";

export default function McpToolsPage() {
  return (
    <div className="flex gap-5">
      {/* 左侧导航：当前在 Explore / MCP tools 页面 */}
      <FireGPTSidebar active="explore" />

      <div className="flex-1 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                MCP Tools & Apps
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Browse system tools and user apps that FireGPT can call inside
                a prompt.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* System tools */}
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                System tools <span className="text-[11px] text-emerald-600">(MCP-tool)</span>
              </h2>

              <ToolCard
                name="Tool-0"
                tag="Lidar + VIIRS"
                description="Query and process co-registered Lidar and VIIRS data for a given AOI."
                rating="Used by fire scientists"
              />
              <ToolCard
                name="Tool-1"
                tag="Weather + CHM"
                description="Combine canopy height model with station weather time series."
                rating="Prototype"
              />
            </section>

            {/* User apps */}
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                User-apps <span className="text-[11px] text-emerald-600">(MCP-prompt)</span>
              </h2>

              <ToolCard
                name="Demo-0"
                tag="NDVI trend app"
                description="Generate NDVI time series plots for a selected region and season."
                rating="5★ by Alice (school kid)"
              />
              <ToolCard
                name="Demo-1"
                tag="Prompt summary app"
                description="Summarize prompts and responses into a reusable app template."
                rating="4★ by Bob (fire fighter)"
              />
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolCard({
  name,
  tag,
  description,
  rating,
}: {
  name: string;
  tag: string;
  description: string;
  rating: string;
}) {
  return (
    <div className="mb-3 rounded-lg bg-white p-3 text-xs shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">{name}</div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          {tag}
        </span>
      </div>
      <p className="mt-1 text-slate-600">{description}</p>
      <div className="mt-1 text-[11px] text-slate-400">{rating}</div>
      <div className="mt-3">
        <ToolButton label="Import to prompt" />
      </div>
    </div>
  );
}
