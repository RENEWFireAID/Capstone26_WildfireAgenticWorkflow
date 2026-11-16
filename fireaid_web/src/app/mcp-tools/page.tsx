"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { AlertTriangle, Check as CheckIcon, Download, Loader2, RefreshCw, Square, Trash2 } from "lucide-react";
import { AppPage, Button, FIELD, Notice, Panel, Placeholder, Segmented, Stat } from "@/components/ui/app";
import FiresByYearChart from "@/components/mcp/FiresByYearChart";
import FireDashboard from "@/components/mcp/FireDashboard";
import ModelBadge from "@/components/ui/ModelBadge";
import ChatChart, { type ChatChartSpec } from "@/components/chat/ChatChart";
import ReactMarkdown from "react-markdown";

// Sized for the narrow Ask AI panel, where answers are set in text-xs.
const ANSWER_MARKDOWN = {
  h1: (props: any) => <div className="mb-1 mt-2 text-sm font-semibold text-navy-deep first:mt-0">{props.children}</div>,
  h2: (props: any) => <div className="mb-1 mt-2 text-[13px] font-semibold text-navy-deep first:mt-0">{props.children}</div>,
  h3: (props: any) => <div className="mb-1 mt-2 font-semibold text-navy-deep first:mt-0">{props.children}</div>,
  p: (props: any) => <p className="mb-1.5 last:mb-0">{props.children}</p>,
  ul: (props: any) => <ul className="mb-1.5 list-disc pl-4">{props.children}</ul>,
  ol: (props: any) => <ol className="mb-1.5 list-decimal pl-4">{props.children}</ol>,
};

// map app
const FireMap = dynamic(() => import("@/components/map/FireMap"), { ssr: false });

type Tool = { name: string; desc: string };

type PrescribedMode = "all" | "yes" | "no";
type ViewMode = "points" | "cluster" | "heat" | "smoke";

type QuerySpec = {
  yearStart?: number;
  yearEnd?: number;
  prescribed?: PrescribedMode;
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
    acresMin: undefined,
    acresMax: undefined,
    limit: 200,
    bbox: null,
  });

  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("points");
  const [llmInput, setLlmInput] = useState("");
  const [llmMessages, setLlmMessages] = useState<{role:"user"|"ai", text:string, toolsUsed?: {name:string, recordCount:number}[], chart?: ChatChartSpec}[]>([]);
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
        ? "I could not verify this answer from the database. Please rephrase your question to ask about fire counts, acres, causes, or years — data that exists in our Alaska wildfire records."
        : data?.reply ?? "No response.";
      setLlmMessages([...next, { role: "ai" as const, text: reply, toolsUsed, chart: toolsUsed.length > 0 ? data?.chart ?? undefined : undefined }]);
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

    const limitPart = spec.limit ? `limit ${spec.limit}` : "";

    const acresPart =
      spec.acresMin != null || spec.acresMax != null
        ? `acres ${spec.acresMin ?? 0} to ${spec.acresMax ?? "max"}`
        : "";

    // Skip blank parts so an unset acres range doesn't leave ". ." behind.
    return [`Show ${prescribedPart} in Alaska ${yearPart}`.trim(), acresPart, limitPart]
      .filter(Boolean)
      .join(". ")
      .replace(/\s+/g, " ");
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
    <AppPage
      eyebrow="Apps · Fire records"
      title="Fire History"
      description="Filter Alaska's historical fire records by year, size and type, map where they burned, chart their causes, fuels and terrain, and ask AI questions answered from the same database."
      meta={[
        "Source: Alaska Fire Service (BLM) · Alaska Fire Science Consortium",
        "Alaska Wildfire Historical Records 1939–2024",
        "AK Fire Location Points",
      ]}
      actions={<WorkbenchActions running={running} onRefresh={() => runQuery()} />}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Map and dashboard */}
        <div className="min-w-0 space-y-6">
          <Panel flush>
            <MapToolbar viewMode={viewMode} setViewMode={setViewMode} />
            <div className="h-[420px] md:h-[560px]">
              <FireMap viewMode={viewMode} />
            </div>
          </Panel>

          <FireDashboard />
        </div>

        {/* Right column: AI, query builder and insights */}
        <div className="min-w-0 space-y-6">
          {/* LLM Natural Language Query */}
          <Panel
            title="Ask AI about this data"
            subtitle={<ModelBadge feature="fireHistory" />}
            aside={llmMessages.length > 0 && (
              <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setLlmMessages([])}>Clear</Button>
            )}
          >
            <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
              {llmMessages.length === 0 && (
                <Placeholder height="py-4">Ask anything about the wildfire data, or ask for a chart.</Placeholder>
              )}
              {llmMessages.map((m, i) => (
                <div key={i} className={`px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto max-w-[85%] self-end bg-navy-soft text-navy-deep"
                    : `self-start border border-slate-200 bg-white text-slate-700 ${m.chart ? "w-full" : "max-w-[95%]"}`
                }`}>
                  {m.role === "ai"
                    ? <ReactMarkdown components={ANSWER_MARKDOWN}>{m.text}</ReactMarkdown>
                    : <div className="whitespace-pre-wrap">{m.text}</div>}
                  {m.chart && <ChatChart chart={m.chart} />}
                  {m.role === "ai" && m.toolsUsed && m.toolsUsed.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.toolsUsed.map((t, j) => (
                        <span key={j} className="inline-flex items-center gap-1 border border-navy/30 bg-navy-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-navy">
                          <CheckIcon size={11} aria-hidden="true" /> {t.name} · {t.recordCount} records
                        </span>
                      ))}
                    </div>
                  )}
                  {m.role === "ai" && (!m.toolsUsed || m.toolsUsed.length === 0) && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800">
                        <AlertTriangle size={11} aria-hidden="true" /> No database query — verify this answer
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {llmLoading && (
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Analyzing…
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={FIELD}
                placeholder="e.g. Chart acres burned per year since 2000"
                aria-label="Question about the wildfire data"
                value={llmInput}
                onChange={(e) => setLlmInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askLlm(); }}}
                disabled={llmLoading}
              />
              <Button
                className="shrink-0"
                onClick={askLlm}
                disabled={llmLoading || !llmInput.trim()}
              >Send</Button>
            </div>
          </Panel>


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
    </AppPage>
  );
}


/* ===========================
   Header actions
=========================== */

function WorkbenchActions({
  running,
  onRefresh,
}: {
  running: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={onRefresh} disabled={running}>
        {running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
        {running ? "Running…" : "Refresh"}
      </Button>
      <Button
        variant="secondary"
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
        <Download size={14} aria-hidden="true" /> Export JSON
      </Button>
    </div>
  );
}

/* ===========================
   Map Toolbar
=========================== */

const VIEW_MODES = [
  { value: "points", label: "Points" },
  { value: "cluster", label: "Cluster" },
  { value: "heat", label: "Heat" },
  { value: "smoke", label: "Smoke" },
] as const;

const TOOL_BUTTON =
  "flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-navy hover:text-navy";

function MapToolbar({
  viewMode,
  setViewMode,
}: {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">View</span>
        <Segmented label="Map view" size="sm" options={VIEW_MODES} value={viewMode} onChange={setViewMode} />
      </div>
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Map selection">
        <button type="button" className={TOOL_BUTTON} onClick={() => window.dispatchEvent(new Event("mcp:drawbox"))}>
          <Square size={12} aria-hidden="true" /> Draw Box
        </button>
        <button
          type="button"
          className={TOOL_BUTTON}
          onClick={() => {
            window.dispatchEvent(new Event("mcp:clearselection"));
            setViewMode("points");
          }}
        >
          <Trash2 size={12} aria-hidden="true" /> Clear Selection
        </button>
      </div>
    </div>
  );
}

/* ===========================
   Query Builder
=========================== */

const PRESCRIBED_OPTIONS = [
  { value: "all", label: "All" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

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
    <Panel accent title="Query Builder" subtitle="Choose the fires to load onto the map, dashboard and insights.">
      {/* Filters */}
      <div className="space-y-3">
        <FieldGroup label="Year range">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={FIELD}
              type="number"
              aria-label="Start year"
              value={spec.yearStart ?? ""}
              onChange={(e) =>
                set({ yearStart: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="start"
            />
            <input
              className={FIELD}
              type="number"
              aria-label="End year"
              value={spec.yearEnd ?? ""}
              onChange={(e) =>
                set({ yearEnd: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="end"
            />
          </div>
        </FieldGroup>

        <FieldGroup label="Prescribed">
          <Segmented<PrescribedMode>
            label="Prescribed"
            size="sm"
            options={PRESCRIBED_OPTIONS}
            value={spec.prescribed ?? "all"}
            onChange={(v) => set({ prescribed: v })}
          />
        </FieldGroup>

        <FieldGroup label="Acres">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={FIELD}
              type="number"
              aria-label="Minimum acres"
              value={spec.acresMin ?? ""}
              onChange={(e) =>
                set({ acresMin: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="min"
            />
            <input
              className={FIELD}
              type="number"
              aria-label="Maximum acres"
              value={spec.acresMax ?? ""}
              onChange={(e) =>
                set({ acresMax: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="max"
            />
          </div>
        </FieldGroup>

        <FieldGroup label="Limit">
          <select
            className={FIELD}
            aria-label="Limit"
            value={spec.limit ?? 200}
            onChange={(e) => set({ limit: Number(e.target.value) })}
          >
            <option value={50}>50</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </FieldGroup>
      </div>

      {runErr && (
        <Notice tone="error" className="mt-4 break-words">
          {runErr}
        </Notice>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={onRun} disabled={running}>
          {running && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {running ? "Running…" : "Run Query"}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setSpec({
              yearStart: 2020,
              yearEnd: 2020,
              prescribed: "all",
              acresMin: undefined,
              acresMax: undefined,
              limit: 200,
              bbox: null,
            })
          }
          disabled={running}
        >
          Reset
        </Button>
      </div>

      <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500">Query preview</div>
        <div className="mt-0.5 text-sm text-slate-700">{templateQuery}</div>
      </div>
    </Panel>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>
      {children}
    </div>
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
    <Panel
      title="Insights"
      subtitle={rows.length ? `From the ${rows.length.toLocaleString("en-US")} records the last query returned.` : "Run a query to see a summary of the records it returns."}
      aside={
        <Button variant="secondary" className="px-3 py-1 text-xs" onClick={updateFromStorage}>
          Update
        </Button>
      }
    >
      {/* KPIs */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Total Fires" value={kpis.totalFires.toLocaleString("en-US")} />
        <Stat label="Prescribed" value={kpis.prescribedCount.toLocaleString("en-US")} />
        <Stat label="Total Acres" value={kpis.acresSum ? formatCompact(kpis.acresSum) : "—"} />
        <Stat label="Top State" value={kpis.topState} />
      </dl>

      {/* Fires by Year */}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-bold text-navy-deep">Fires by Year</h3>
          {yearData.length > 0 && (
            <span className="font-mono text-xs text-slate-500">
              {yearData[0].year}–{yearData[yearData.length - 1].year}
            </span>
          )}
        </div>
        <div className="mt-3">
          {yearData.length ? (
            <FiresByYearChart data={yearData} height={220} />
          ) : (
            <Placeholder height="py-6">No fires loaded yet.</Placeholder>
          )}
        </div>
      </div>
    </Panel>
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
