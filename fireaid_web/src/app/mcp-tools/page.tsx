"use client";

import { useEffect, useState } from "react";
import FireGPTSidebar from "@/components/layout/FireGPTSidebar";
import ToolButton from "@/components/ui/ToolButton";

/* ---------------- Types ---------------- */

type FireItem = {
  name: string;
  state: string;
  type: string;
  size: number | null;
  percent_contained: number | null;
};

type ToolMeta = {
  id: string;
  name: string;
  kind: "system" | "app";
  tag?: string;
  description?: string;
  rating?: string;
};

/* ---------------- Page ---------------- */

export default function McpToolsPage() {
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [fires, setFires] = useState<FireItem[]>([]);
  const [selectedState, setSelectedState] = useState<string>("ALL");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* -------- Load tools -------- */

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const r = await fetch("/api/mcp/tools");
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load tools");

        setTools(data.tools ?? data ?? []);
      } catch (e: any) {
        setErr(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const systemTools = tools.filter((t) => t.kind === "system");
  const userApps = tools.filter((t) => t.kind === "app");

  /* -------- Run tool -------- */

  async function handleImport(tool: ToolMeta) {
    try {
      const r = await fetch("/api/mcp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: tool.id,
          args: {},
        }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Run failed");

      console.log("Tool result:", data);

      const isWildfireTool =
        tool.name.toLowerCase().includes("wildfire") ||
        tool.id.toLowerCase().includes("wildfire") ||
        tool.tag?.toLowerCase().includes("wfigs") ||
        tool.tag?.toLowerCase().includes("nifc");

      if (isWildfireTool && Array.isArray(data?.result)) {
        const sorted = [...data.result].sort(
          (a: any, b: any) => (b?.size ?? -1) - (a?.size ?? -1)
        );
        setFires(sorted);
        setSelectedState("ALL");
      }

      if (!isWildfireTool) {
        setFires([]);
        setSelectedState("ALL");
      }

      alert(`✅ Ran ${tool.name}. Check console for result.`);
    } catch (e: any) {
      alert(`❌ ${e?.message || "Run failed"}`);
    }
  }

  /* -------- Filters -------- */

  const stateOptions = Array.from(
    new Set(fires.map((f) => f.state).filter(Boolean))
  ).sort();

  const visibleFires =
    selectedState === "ALL"
      ? fires
      : fires.filter((f) => f.state === selectedState);

  /* -------- Render -------- */

  return (
    <div className="flex gap-5">
      <FireGPTSidebar active="explore" />

      <div className="flex-1 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              MCP Tools & Apps
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Browse system tools and user apps that FireGPT can call inside a prompt.
            </p>
          </div>

          {/* Status */}
          <div className="mt-4 text-xs">
            {loading && <div className="text-slate-500">Loading tools…</div>}
            {err && <div className="text-red-600">Error: {err}</div>}
            {!loading && !err && tools.length === 0 && (
              <div className="text-slate-500">No tools found.</div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* System tools */}
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                System tools{" "}
                <span className="text-[11px] text-emerald-600">(MCP-tool)</span>
              </h2>

              {systemTools.map((t) => (
                <ToolCard
                  key={t.id}
                  name={t.name}
                  tag={t.tag || "System tool"}
                  description={t.description || ""}
                  rating={t.rating || ""}
                  onImport={() => handleImport(t)}
                />
              ))}
            </section>

            {/* User apps */}
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                User-apps{" "}
                <span className="text-[11px] text-emerald-600">(MCP-prompt)</span>
              </h2>

              {userApps.map((t) => (
                <ToolCard
                  key={t.id}
                  name={t.name}
                  tag={t.tag || "App"}
                  description={t.description || ""}
                  rating={t.rating || ""}
                  onImport={() => handleImport(t)}
                />
              ))}
            </section>
          </div>

          {/* -------- Wildfire Results -------- */}
          {fires.length > 0 && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Wildfire Results{" "}
                  <span className="text-slate-400">
                    ({visibleFires.length})
                  </span>
                </h2>

                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border px-2 py-1 text-xs text-slate-700"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="ALL">All States</option>
                    {stateOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <button
                    className="rounded-lg border px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setFires([]);
                      setSelectedState("ALL");
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleFires.map((f, idx) => (
                  <div
                    key={`${f.name}-${f.state}-${idx}`}
                    className="rounded-xl border bg-slate-50 p-4"
                  >
                    <div className="truncate font-semibold text-slate-900">
                      {f.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {f.state} · {f.type}
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Size</span>
                        <span>
                          {typeof f.size === "number"
                            ? f.size.toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Contained</span>
                        <span>
                          {f.percent_contained == null
                            ? "—"
                            : `${f.percent_contained}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
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
  onImport,
}: {
  name: string;
  tag: string;
  description: string;
  rating: string;
  onImport: () => void;
}) {
  return (
    <div className="mb-3 rounded-lg bg-white p-3 text-xs shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">{name}</div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          {tag}
        </span>
      </div>
      {description && <p className="mt-1 text-slate-600">{description}</p>}
      {rating && <div className="mt-1 text-[11px] text-slate-400">{rating}</div>}
      <div className="mt-3">
        <ToolButton label="Import to prompt" onClick={onImport as any} />
      </div>
    </div>
  );
}
