"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import FiresByYearChart from "@/components/mcp/FiresByYearChart";
import FireDashboard from "@/components/mcp/FireDashboard";

// map app
const FireMap = dynamic(() => import("@/components/map/FireMap"), { ssr: false });

type Tool = { name: string; desc: string };

type PrescribedMode = "all" | "yes" | "no";
type ViewMode = "points" | "cluster" | "heat" | "smoke";

type QuerySpec = {
  yearStart?: number;
  yearEnd?: number;
  prescribed?: PrescribedMode;
  state?: string;
  acresMin?: number;
  acresMax?: number;
  limit?: number;
  bbox?: [number, number, number, number] | null; // [minLon,minLat,maxLon,maxLat]
};

export default function McpToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [toolsErr, setToolsErr] = useState<string | null>(null);

  // Workbench state
  const [spec, setSpec] = useState<QuerySpec>({
    yearStart: 2020,
    yearEnd: 2020,
    prescribed: "all",
    state: "Alaska",
    acresMin: undefined,
    acresMax: undefined,
    limit: 200,
    bbox: null,
  });

  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("points");
  const [llmInput, setLlmInput] = useState("");
  const [llmMessages, setLlmMessages] = useState<{role:"user"|"ai", text:string, toolsUsed?: {name:string, recordCount:number}[]}[]>([]);
  const [llmLoading, setLlmLoading] = useState(false);

  async function askLlm() {
    if (!llmInput.trim()) return;
    const userText = llmInput.trim();
    setLlmInput("");
    const next = [...llmMessages, { role: "user" as const, text: userText }];
    setLlmMessages(next);
    setLlmLoading(true);
    try {
      const res = await fetch("/api/mcp/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: llmMessages.map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });
      const data = await res.json();
      const toolsUsed = data?.toolsUsed ?? [];
      const reply = toolsUsed.length === 0
        ? "⚠️ I could not verify this answer from the database. Please rephrase your question to ask about fire counts, acres, causes, or years — data that exists in our Alaska wildfire records."
        : data?.reply ?? "No response.";
      setLlmMessages([...next, { role: "ai" as const, text: reply, toolsUsed }]);
    } catch (e: any) {
      setLlmMessages([...next, { role: "ai" as const, text: "Error: " + e.message }]);
    } finally {
      setLlmLoading(false);
    }
  }

  // Listen for bbox selection from FireMap
  useEffect(() => {
    const handler = (e: Event) => {
      const bbox = (e as CustomEvent).detail as [number,number,number,number] | null;
      const nextSpec = { ...spec, bbox };
      setSpec(nextSpec);
      if (bbox) runQuery(nextSpec);
    };
    window.addEventListener("mcp:boxselected", handler);
    return () => window.removeEventListener("mcp:boxselected", handler);
  }, [spec]);

  // Load MCP tools list
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/mcp/run", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setTools(data.tools ?? []);
      } catch (e: any) {
        setToolsErr(e?.message || "Failed to load tools");
      } finally {
        setLoadingTools(false);
      }
    })();
  }, []);

  // Query preview (UI only)
  const templateQuery = useMemo(() => {
    const ys = spec.yearStart;
    const ye = spec.yearEnd ?? spec.yearStart;
    const yearPart =
      ys && ye && ys !== ye ? `from ${ys} to ${ye}` : ys ? `in ${ys}` : "";

    const prescribedPart =
      spec.prescribed === "yes"
        ? "prescribed fires"
        : spec.prescribed === "no"
        ? "wildfires"
        : "fires";

    const statePart = spec.state ? `in ${spec.state}` : "";
    const limitPart = spec.limit ? `limit ${spec.limit}` : "";

    const acresPart =
      spec.acresMin != null || spec.acresMax != null
        ? `acres ${spec.acresMin ?? 0} to ${spec.acresMax ?? "max"}`
        : "";

    return `Show ${prescribedPart} ${statePart} ${yearPart}. ${acresPart}. ${limitPart}`
      .replace(/\s+/g, " ")
      .trim();
  }, [spec]);

  async function runQuery(nextSpec?: QuerySpec) {
    const s = nextSpec ?? spec;
    setRunning(true);
    setRunErr(null);
  
    try {
      localStorage.setItem("mcp:last_spec", JSON.stringify(s));
  
      const backendSpec = {
        yearStart: s.yearStart ?? 2020,
        yearEnd: s.yearEnd ?? s.yearStart ?? 2020,
        prescribed: s.prescribed === "all" ? null : s.prescribed === "yes" ? "Y" : "N",
        state: s.state ?? undefined,
        acresMin: s.acresMin ?? undefined,
        acresMax: s.acresMax ?? undefined,
        bbox: s.bbox ?? null,
        limit: s.limit ?? 200,
      };
  
      const res = await fetch("/api/mcp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "", ...backendSpec }), 
      });
  
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(`Run failed: HTTP ${res.status} ${text}`);
  
      const parsed = JSON.parse(text);
      const rows =
        parsed?.results ?? parsed?.items ?? parsed?.data ?? (Array.isArray(parsed) ? parsed : []);
  
      localStorage.setItem(
        "mcp:last_result",
        JSON.stringify({ results: rows, filters: backendSpec })
      );
  
      window.dispatchEvent(new Event("mcp:updated"));
    } catch (e: any) {
      setRunErr(e?.message || "Failed to run query");
    } finally {
      setRunning(false);
    }
  }
  
        
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1.4fr)_minmax(0,0.9fr)]">
      {/* Left */}
      <FireAIDSidebar active="explore" />

      {/* Center */}
      <div className="min-w-0 space-y-4">
        <WorkbenchHeader
          title="Wildfire Analytics Dashboard"
          subtitle="Alaska Wildfire Historical Records · 1939–2024"
          running={running}
          onRefresh={() => runQuery()}
        />

        {/* Map card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <MapToolbar viewMode={viewMode} setViewMode={setViewMode} />
          <div className="h-[520px]">
            <FireMap viewMode={viewMode} />
          </div>
        </div>

        <FireDashboard />

      </div> {/* Center */}

      {/* Right */}
      <div className="min-w-0 space-y-4">
        {/* LLM Natural Language Query */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Ask AI about this data</div>
            {llmMessages.length > 0 && (
              <button className="text-[11px] text-slate-400 hover:text-slate-600" onClick={() => setLlmMessages([])}>Clear</button>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
            {llmMessages.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-4">Ask anything about the wildfire data...</div>
            )}
            {llmMessages.map((m, i) => (
              <div key={i} className={`rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-slate-900 text-white self-end max-w-[85%] ml-auto"
                  : "bg-emerald-50 border border-emerald-100 text-slate-700 self-start max-w-[95%]"
              }`}>
                {m.text}
                {m.role === "ai" && m.toolsUsed && m.toolsUsed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.toolsUsed.map((t, j) => (
                      <span key={j} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        ✓ {t.name} · {t.recordCount} records
                      </span>
                    ))}
                  </div>
                )}
                {m.role === "ai" && (!m.toolsUsed || m.toolsUsed.length === 0) && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      ⚠ No database query — verify this answer
                    </span>
                  </div>
                )}
              </div>
            ))}
            {llmLoading && (
              <div className="rounded-xl px-3 py-2 text-xs bg-slate-50 border border-slate-100 text-slate-400">Analyzing…</div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-slate-400"
              placeholder="Ask about the wildfire data..."
              value={llmInput}
              onChange={(e) => setLlmInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askLlm(); }}}
              disabled={llmLoading}
            />
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              onClick={askLlm}
              disabled={llmLoading || !llmInput.trim()}
            >Send</button>
          </div>
        </div>

        <QueryBuilderPanel
          spec={spec}
          setSpec={setSpec}
          running={running}
          onRun={() => runQuery()}
          runErr={runErr}
          templateQuery={templateQuery}
        />

        <InsightsPanel />

      </div>
    </div>
  );
}


/* ===========================
   Header
=========================== */

function WorkbenchHeader({
  title,
  subtitle,
  running,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  running: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-bold text-slate-900">{title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {subtitle}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              AK Fire Location Points
            </span>
            <span className="text-[11px] text-slate-400">
              Source: Alaska Fire Service (BLM) · Alaska Fire Science Consortium
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onRefresh}
          >
            Refresh
          </button>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              const raw = localStorage.getItem("mcp:last_result");
              if (!raw) return;
              const blob = new Blob([raw], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "mcp_last_result.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </button>
          <div className="text-[11px] text-slate-500">{running ? "Running…" : ""}</div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Map Toolbar
=========================== */

function MapToolbar({
  viewMode,
  setViewMode,
}: {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
}) {
  const btn = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold ${
      active
        ? "bg-slate-900 text-white"
        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
      <div className="text-xs font-semibold text-slate-700">View:</div>
      <button className={btn(viewMode === "points")} onClick={() => setViewMode("points")}>
        Points
      </button>
      <button className={btn(viewMode === "cluster")} onClick={() => setViewMode("cluster")}>
        Cluster
      </button>
      <button className={btn(viewMode === "heat")} onClick={() => setViewMode("heat")}>
        Heat
      </button>
      <button className={btn(viewMode === "smoke")} onClick={() => setViewMode("smoke")}>
        Smoke
      </button>

      <div className="mx-2 h-4 w-px bg-slate-200" />

      <button className={btn(false)} onClick={() => window.dispatchEvent(new Event("mcp:drawbox"))}>
        Draw Box
      </button>
      <button
        className={btn(false)}
        onClick={() => {
          window.dispatchEvent(new Event("mcp:clearselection"));
          setViewMode("points");
        }}
      >
        Clear Selection
      </button>
    </div>
  );
}

/* ===========================
   Query Builder
=========================== */

function QueryBuilderPanel({
  spec,
  setSpec,
  running,
  onRun,
  runErr,
  templateQuery,
}: {
  spec: QuerySpec;
  setSpec: (s: QuerySpec) => void;
  running: boolean;
  onRun: () => void;
  runErr: string | null;
  templateQuery: string;
}) {
  const set = (patch: Partial<QuerySpec>) => setSpec({ ...spec, ...patch });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Query Builder</div>
          <div className="mt-1 text-xs text-slate-500">
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 space-y-3">
        <Field label="Year range">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
              type="number"
              value={spec.yearStart ?? ""}
              onChange={(e) =>
                set({ yearStart: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="start"
            />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
              type="number"
              value={spec.yearEnd ?? ""}
              onChange={(e) =>
                set({ yearEnd: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="end"
            />
          </div>
        </Field>

        <Field label="Prescribed">
          <div className="flex gap-2">
            <SegButton active={spec.prescribed === "all"} onClick={() => set({ prescribed: "all" })}>
              All
            </SegButton>
            <SegButton active={spec.prescribed === "yes"} onClick={() => set({ prescribed: "yes" })}>
              Yes
            </SegButton>
            <SegButton active={spec.prescribed === "no"} onClick={() => set({ prescribed: "no" })}>
              No
            </SegButton>
          </div>
        </Field>

        <Field label="State (UI only for now)">
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
            value={spec.state ?? ""}
            onChange={(e) => set({ state: e.target.value || undefined })}
            placeholder="e.g., Alaska"
          />
        </Field>

        <Field label="Acres (UI only for now)">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
              type="number"
              value={spec.acresMin ?? ""}
              onChange={(e) =>
                set({ acresMin: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="min"
            />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
              type="number"
              value={spec.acresMax ?? ""}
              onChange={(e) =>
                set({ acresMax: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="max"
            />
          </div>
        </Field>

        <Field label="Limit">
          <select
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
            value={spec.limit ?? 200}
            onChange={(e) => set({ limit: Number(e.target.value) })}
          >
            <option value={50}>50</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </Field>
      </div>

      {runErr && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {runErr}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white disabled:opacity-60"
          onClick={onRun}
          disabled={running}
        >
          {running ? "Running…" : "Run Query"}
        </button>
        <button
          className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() =>
            setSpec({
              yearStart: 2020,
              yearEnd: 2020,
              prescribed: "all",
              state: "Alaska",
              acresMin: undefined,
              acresMax: undefined,
              limit: 200,
              bbox: null,
            })
          }
          disabled={running}
        >
          Reset
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-700">Query preview</div>
        <div className="mt-1 text-[11px] text-slate-600">{templateQuery}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-slate-700">{label}</div>
      {children}
    </div>
  );
}

function SegButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/* ===========================
   Insights (right column)
=========================== */

type AnyObj = Record<string, any>;
type Point = { year: string; count: number };

function safeParseJSON(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function pickRowsFromMcpResult(parsed: any): AnyObj[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed as AnyObj[];
  if (typeof parsed === "object" && Array.isArray((parsed as any).results))
    return (parsed as any).results as AnyObj[];
  if (typeof parsed === "object" && Array.isArray((parsed as any).items))
    return (parsed as any).items as AnyObj[];
  if (typeof parsed === "object" && Array.isArray((parsed as any).data))
    return (parsed as any).data as AnyObj[];
  return [];
}

function isPrescribedRow(row: AnyObj): boolean {
  const v = row?.PRESCRIBEDFIRE ?? row?.prescribed ?? row?.PRESCRIBED;
  const s = String(v ?? "").trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "TRUE" || s === "1";
}

function pickState(row: AnyObj): string | null {
  const v = row?.STATE ?? row?.State ?? row?.state;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function pickAcres(row: AnyObj): number {
  const candidates = ["ACRES", "acres", "GISACRES", "gisacres", "TOTALACRES", "total_acres"];
  for (const k of candidates) {
    const n = toNumber((row as any)?.[k]);
    if (n != null) return n;
  }
  return 0;
}

function pickYear(row: AnyObj): string | null {
  const y =
    row?.FIRESEASON ??
    row?.fireSeason ??
    row?.year ??
    row?.YEAR ??
    row?.fire_year ??
    row?.start_year ??
    (typeof row?.start_date === "string" ? row.start_date.slice(0, 4) : undefined);

  if (y == null) return null;
  const s = String(y).trim();
  if (!/^\d{4}$/.test(s)) return null;
  return s;
}

function computeYearData(rows: AnyObj[]): Point[] {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const year = pickYear(r);
    if (!year) continue;
    counts[year] = (counts[year] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

function computeKpis(rows: AnyObj[]) {
  const totalFires = rows.length;

  let prescribedCount = 0;
  let acresSum = 0;

  const stateCounts = new Map<string, number>();

  for (const r of rows) {
    if (isPrescribedRow(r)) prescribedCount += 1;
    acresSum += pickAcres(r);

    const st = pickState(r);
    if (st) stateCounts.set(st, (stateCounts.get(st) ?? 0) + 1);
  }

  let topState: string | null = null;
  let topStateCount = -1;
  for (const [st, cnt] of stateCounts.entries()) {
    if (cnt > topStateCount) {
      topStateCount = cnt;
      topState = st;
    }
  }

  return {
    totalFires,
    prescribedCount,
    acresSum,
    topState: topState ?? "—",
  };
}

function InsightsPanel() {
  const [kpis, setKpis] = useState({
    totalFires: 0,
    prescribedCount: 0,
    acresSum: 0,
    topState: "—",
  });

  const [rows, setRows] = useState<AnyObj[]>([]);
  const [yearData, setYearData] = useState<Point[]>([]);

  function updateFromStorage() {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("mcp:last_result");
    const parsed = safeParseJSON(raw);
    const nextRows = pickRowsFromMcpResult(parsed);

    setRows(nextRows);
    setKpis(computeKpis(nextRows));
    setYearData(computeYearData(nextRows));
  }

  useEffect(() => {
    updateFromStorage();

    const handler = () => updateFromStorage();
    window.addEventListener("mcp:updated", handler);

    return () => window.removeEventListener("mcp:updated", handler);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Insights</div>
        <button
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          onClick={updateFromStorage}
        >
          Update
        </button>
      </div>

      {/* KPIs */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <KpiCard label="Total Fires" value={String(kpis.totalFires)} />
        <KpiCard label="Prescribed" value={String(kpis.prescribedCount)} />
        <KpiCard label="Total Acres" value={kpis.acresSum ? formatCompact(kpis.acresSum) : "—"} />
        <KpiCard label="Top State" value={kpis.topState} />
      </div>

      {/* Fires by Year */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-700">Fires by Year</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Grouped from current MCP results ({rows.length} rows).
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            years:{" "}
            {yearData.length
              ? `${yearData[0].year}–${yearData[yearData.length - 1].year}`
              : "—"}
          </div>
        </div>

        <div className="mt-3 mx-auto max-w-[360px] rounded-lg border border-slate-200 bg-white p-2">
          <FiresByYearChart data={yearData} height={680} title=" " />
        </div>
      </div>

      {/* Placeholder */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="text-[11px] font-semibold text-slate-700">Results Table</div>
        <div className="mt-1 text-[11px] text-slate-500">
          Next step: pageable table + columns picker from MCP rows.
        </div>
        <div className="mt-3 h-28 rounded-lg border border-dashed border-slate-200 bg-white" />
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
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
        <button
          type="button"
          onClick={() => {
            const suggestedCall =
              name === "search_fire_points"
                ? "/mcp/search?year=2024&prescribed=Y&limit=10"
                : name === "count_by_year"
                ? "/mcp/count?year=2024"
                : "";

            localStorage.setItem("mcp:last_tool", name);
            localStorage.setItem("mcp:last_call", suggestedCall);

            const snippet =
              `Tool: ${name}\n` +
              `Description: ${description}\n\n` +
              `Suggested call:\n${suggestedCall}\n`;

            navigator.clipboard.writeText(snippet).catch(() => {});
            window.location.href = "/fireaid";
          }}
        />
      </div>
    </div>
  );
}
