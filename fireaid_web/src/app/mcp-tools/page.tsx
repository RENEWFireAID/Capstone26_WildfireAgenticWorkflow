"use client";

import { useEffect, useState } from "react";

import FireGPTSidebar from "@/components/layout/FireAIDSidebar";
import ToolButton from "@/components/ui/ToolButton";

type Tool = { name: string; desc: string };

export default function McpToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/mcp/tools", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setTools(data.tools ?? []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load tools");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex gap-5">
      {/* 左侧导航 */}
      <FireGPTSidebar active="explore" />

      <div className="flex-1 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                MCP Tools & Apps
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Browse system tools and user apps that FireAID can call inside
                a prompt.
              </p>
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              Failed to load tools: {err}
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* System tools：来自后端 */}
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                System tools{" "}
                <span className="text-[11px] text-emerald-600">(live)</span>
              </h2>

              {loading && (
                <div className="text-xs text-slate-500">Loading…</div>
              )}

              {!loading && !err && tools.length === 0 && (
                <div className="text-xs text-slate-500">No tools found.</div>
              )}

              {!loading &&
                tools.map((t) => (
                  <ToolCard
                    key={t.name}
                    name={t.name}
                    tag="FireMCP"
                    description={t.desc}
                    rating="from backend"
                  />
                ))}
            </section>

            {/* User apps：demo */}
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                User-apps{" "}
                <span className="text-[11px] text-emerald-600">(MCP-prompt)</span>
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

/* ---------------- Tool Card ---------------- */

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
      <ToolButton
        label="Import to prompt"
        onClick={() => {
    // 根据工具名决定调用哪个 MCP 接口
          const suggestedCall =
            name === "search_fire_points"
              ? "/mcp/search?year=2024&prescribed=Y&limit=10"
              : name === "count_by_year"
              ? "/mcp/count?year=2024"
              : "";

    // ① 记住“刚刚选中的工具”和调用
    localStorage.setItem("mcp:last_tool", name);
    localStorage.setItem("mcp:last_call", suggestedCall);

    // ② 仍然复制到剪贴板（方便你 demo / debug）
    const snippet =
      `Tool: ${name}\n` +
      `Description: ${description}\n\n` +
      `Suggested call:\n${suggestedCall}\n`;

    navigator.clipboard.writeText(snippet).catch(() => {});

    // ③ 跳转到 FireGPT 页面，看结果
    window.location.href = "/firegpt";
  }}
/>
      </div>
    </div>
  );
}
