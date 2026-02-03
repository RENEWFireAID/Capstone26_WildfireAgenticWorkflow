"use client";

import { useEffect, useMemo, useState } from "react";

type AnyObj = Record<string, any>;
type ViewMode = "table" | "json";

function isObject(v: any): v is AnyObj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// 从常见 MCP 返回里“猜”出可读的数组结果
function pickRows(data: any): AnyObj[] | null {
  if (!data) return null;

  // case 1: { results: [...] }
  if (isObject(data) && Array.isArray(data.results)) return data.results as AnyObj[];

  // case 2: { items: [...] }
  if (isObject(data) && Array.isArray((data as any).items)) return (data as any).items as AnyObj[];

  // case 3: data itself is array
  if (Array.isArray(data)) return data as AnyObj[];

  return null;
}

// 从返回里提取一个“count”类摘要（用于 count_by_year 或其他统计工具）
function pickCount(data: any): number | null {
  if (!data) return null;

  // case: { count: 469 }
  if (isObject(data) && typeof data.count === "number") return data.count;

  // case: { count: { year: 2024, count: 469 } }
  if (isObject(data) && isObject(data.count) && typeof data.count.count === "number") {
    return data.count.count;
  }

  // case: { total: 469 }
  if (isObject(data) && typeof (data as any).total === "number") return (data as any).total;

  // case: rows length
  const rows = pickRows(data);
  if (rows) return rows.length;

  return null;
}

// 自动选择更好看的列（针对 fire points）
function preferredColumns(tool: string, rows: AnyObj[]): string[] {
  const lowerTool = (tool || "").toLowerCase();

  // search_fire_points 特化：你截图里的字段
  if (lowerTool.includes("search_fire_points")) {
    const cand = ["ID", "NAME", "FIRESEASON", "PRESCRIBEDFIRE", "LATITUDE", "LONGITUDE", "MAPNAME", "MGMTORGID"];
    return cand.filter((k) => k in (rows[0] || {}));
  }

  // 其他工具：取前 6 个 key
  const keys = Object.keys(rows[0] || {});
  return keys.slice(0, 6);
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    // 经纬度漂亮一点
    if (Math.abs(v) > 100 && Math.abs(v) < 200) return v.toFixed(4);
    return Number.isInteger(v) ? String(v) : v.toFixed(3);
  }
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  // 对象/数组：简短展示
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + "…" : s;
  } catch {
    return String(v);
  }
}

export default function McpResultPanel() {
  const [call, setCall] = useState<string>("");
  const [tool, setTool] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const lastTool = localStorage.getItem("mcp:last_tool") || "";
    const lastCall = localStorage.getItem("mcp:last_call") || "";
    setTool(lastTool);
    setCall(lastCall);
  }, []);

  const apiUrl = useMemo(() => {
    if (!call) return "";
    return `/api/mcp/run?path=${encodeURIComponent(call)}`;
  }, [call]);

  useEffect(() => {
    if (!apiUrl) return;

    (async () => {
      setLoading(true);
      setErr(null);
      setData(null);
      try {
        const r = await fetch(apiUrl, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setData(json);

        // 有数组结果默认切到 table，否则 json
        const rows = pickRows(json);
        setView(rows ? "table" : "json");
      } catch (e: any) {
        setErr(e?.message || "Failed to fetch MCP result");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiUrl]);

  const rows = useMemo(() => pickRows(data), [data]);
  const count = useMemo(() => pickCount(data), [data]);

  const cols = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return preferredColumns(tool, rows);
  }, [tool, rows]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    localStorage.removeItem("mcp:last_tool");
    localStorage.removeItem("mcp:last_call");
    setTool("");
    setCall("");
    setData(null);
    setErr(null);
    setLoading(false);
  };

  if (!call) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        MCP Result: <span className="text-slate-400">No tool selected yet.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-slate-900">MCP Result</div>

            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              {tool || "FireMCP"}
            </span>

            {typeof count === "number" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                {tool?.toLowerCase().includes("count") ? `count: ${count}` : `rows: ${count}`}
              </span>
            )}
          </div>

          <div className="mt-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
            {call}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* View toggle */}
          <div className="hidden rounded-full bg-slate-100 p-1 text-[11px] sm:flex">
            <button
              onClick={() => setView("table")}
              className={`rounded-full px-2 py-1 ${
                view === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              disabled={!rows}
              title={rows ? "" : "Table view available when results are arrays"}
            >
              Table
            </button>
            <button
              onClick={() => setView("json")}
              className={`rounded-full px-2 py-1 ${
                view === "json" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              JSON
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={handleCopy}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
            disabled={!data || loading || !!err}
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>

          <button
            onClick={handleClear}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
            title="Clear last tool/call"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && <div className="mt-2 text-[11px] text-slate-500">Loading…</div>}

      {err && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          {err}
        </div>
      )}

      {!loading && !err && data && (
        <>
          {/* Table view */}
          {view === "table" && rows && (
            <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-800">
                  {rows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      {cols.map((c) => (
                        <td key={c} className="whitespace-nowrap px-2 py-2 text-slate-700">
                          {formatCell(row?.[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                <span>
                  Showing {Math.min(10, rows.length)} of {rows.length} rows
                </span>
                <span className="font-mono">Tip: switch to JSON to see full payload</span>
              </div>
            </div>
          )}

          {/* JSON view */}
          {view === "json" && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
{JSON.stringify(data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
