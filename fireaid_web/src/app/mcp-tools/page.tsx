"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import ToolButton from "@/components/ui/ToolButton";
import McpResultPanel from "@/components/mcp/McpResultPanel";
import FiresByYearChart from "@/components/mcp/FiresByYearChart";

// map app
const FireMap = dynamic(() => import("@/components/map/FireMap"), { ssr: false });

type Tool = { name: string; desc: string };

type PrescribedMode = "all" | "yes" | "no";
type ViewMode = "points" | "cluster" | "heat";

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

  // Load MCP tools list
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/mcp/tools", { cache: "no-store" });
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

  //  KEY: GET(path) version
  async function runQuery(nextSpec?: QuerySpec) {
    const s = nextSpec ?? spec;
    setRunning(true);
    setRunErr(null);

    try {
      localStorage.setItem("mcp:last_spec", JSON.stringify(s));

      const ys = s.yearStart ?? 2020;
      const ye = s.yearEnd ?? ys;
      const limit = s.limit ?? 200;

      const all: any[] = [];

      for (let y = ys; y <= ye; y++) {
        const params = new URLSearchParams();
        params.set("year", String(y));
        params.set("limit", String(limit));

        if (s.prescribed === "yes") params.set("prescribed", "Y");
        if (s.prescribed === "no") params.set("prescribed", "N");

        const path = `/mcp/search?${params.toString()}`;

        const res = await fetch(`/api/mcp/run?path=${encodeURIComponent(path)}`, {
          cache: "no-store",
        });

        const text = await res.text().catch(() => "");
        if (!res.ok) throw new Error(`Run failed: HTTP ${res.status} ${text}`);

        const parsed = JSON.parse(text);
        const rows =
          parsed?.results ??
          parsed?.items ??
          parsed?.data ??
          (Array.isArray(parsed) ? parsed : []);

        all.push(...rows);
      }

      const mergedText = JSON.stringify({ results: all });
      localStorage.setItem("mcp:last_result", mergedText);
      localStorage.setItem("mcp:last_call", `/mcp/search?year=${ys}..${ye}&limit=${limit}`);
      localStorage.setItem("mcp:last_tool", "search_fire_points");

      window.dispatchEvent(new Event("mcp:updated"));
    } catch (e: any) {
      setRunErr(e?.message || "Failed to run query");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1.4fr)_minmax(0,0.9fr)]">
      {/* Left */}
      <FireAIDSidebar active="explore" />

      {/* Center */}
      <div className="min-w-0 space-y-4">
        <WorkbenchHeader
          title="Wildfire Analytics Dashboard"
          subtitle="WFIGS / NIFC (MongoDB)"
          running={running}
          onRefresh={() => window.dispatchEvent(new Event("mcp:updated"))}
        />

              {/* Map card */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <MapToolbar viewMode={viewMode} setViewMode={setViewMode} />
          <div className="h-[520px]">
            <FireMap viewMode={viewMode} />
          </div>
        </div>

        {/* MCP Tools & Apps */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">MCP Tools & Apps</h3>
              <p className="text-xs text-slate-500">
                Browse tools and import snippets into your prompt.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              Live + Presets
            </span>
          </div>

          {/* System tools */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">
              System tools <span className="text-emerald-600 text-[11px]">(live)</span>
            </h4>

            {loadingTools && <div className="text-xs text-slate-500">Loading…</div>}

            {!loadingTools &&
              tools.map((t) => (
                <ToolCard
                  key={t.name}
                  name={t.name}
                  tag="FireMCP"
                  description={t.desc}
                  rating="from backend"
                />
              ))}
          </div>

          {/* User apps */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h4 className="mb-4 text-sm font-semibold text-slate-900">
              User-apps <span className="text-emerald-600 text-[11px]">(LLM → PDF)</span>
            </h4>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ToolCard
                name="Wildfire Incident Brief (PDF)"
                tag="LLM Report App"
                description="Generate a structured wildfire incident briefing PDF using live MCP data + LLM summarization."
                rating="5★ preset by LLM team"
              />
              <ToolCard
                name="Annual Fire Trend Report"
                tag="Data-to-Report App"
                description="Create an annual wildfire trends PDF with short narrative insights."
                rating="5★ preset by LLM team"
              />
            </div>
          </div>
        </section>
      </div> {/* Center */}

      {/* Right */}
      <div className="min-w-0 space-y-4">
        <QueryBuilderPanel
          spec={spec}
          setSpec={setSpec}
          running={running}
          onRun={() => runQuery()}
          runErr={runErr}
          templateQuery={templateQuery}
        />

        <InsightsPanel />

        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
            Raw MCP Result (debug)
          </summary>
          <div className="mt-3">
            <McpResultPanel />
          </div>
        </details>
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
          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {subtitle}
            </span>
            <span className="text-[11px] text-slate-500">Local MongoDB</span>
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

      <div className="mx-2 h-4 w-px bg-slate-200" />

      <button className={btn(false)} onClick={() => window.dispatchEvent(new Event("mcp:drawbox"))}>
        Draw Box
      </button>
      <button
        className={btn(false)}
        onClick={() => window.dispatchEvent(new Event("mcp:clearselection"))}
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
            Build a structured query (no natural-language topbar).
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-4 space-y-2">
        <PresetButton
          label="Prescribed Fires in 2020"
          onClick={() =>
            setSpec({
              ...spec,
              yearStart: 2020,
              yearEnd: 2020,
              prescribed: "yes",
              limit: 200,
            })
          }
        />
        <PresetButton
          label="Top 200 largest fires in 2024"
          onClick={() =>
            setSpec({
              ...spec,
              yearStart: 2024,
              yearEnd: 2024,
              prescribed: "all",
              limit: 200,
            })
          }
        />
        <PresetButton
          label="Alaska fires (all years)"
          onClick={() =>
            setSpec({
              ...spec,
              yearStart: 2010,
              yearEnd: 2024,
              state: "Alaska",
              prescribed: "all",
              limit: 200,
            })
          }
        />
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

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
      onClick={onClick}
      type="button"
    >
      {label}
      <span className="text-slate-400">›</span>
    </button>
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

/* ===========================
   Tool Card
=========================== */

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
