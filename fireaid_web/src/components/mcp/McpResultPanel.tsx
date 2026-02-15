"use client";

import { useEffect, useMemo, useState } from "react";

type AnyObj = Record<string, any>;

function isObject(v: any): v is AnyObj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function pickRows(data: any): AnyObj[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as AnyObj[];
  if (isObject(data) && Array.isArray((data as any).results)) return (data as any).results as AnyObj[];
  if (isObject(data) && Array.isArray((data as any).items)) return (data as any).items as AnyObj[];
  return [];
}

function extractPoints(rows: AnyObj[]) {
  return rows
    .map((r) => {
      const lat = r?.LATITUDE ?? r?.latitude ?? r?.lat ?? null;
      const lon = r?.LONGITUDE ?? r?.longitude ?? r?.lon ?? r?.lng ?? null;

      const latNum = typeof lat === "number" ? lat : Number(lat);
      const lonNum = typeof lon === "number" ? lon : Number(lon);

      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;

      return {
        lat: latNum,
        lon: lonNum,
        name: r?.NAME ?? r?.name ?? "",
        year: r?.FIRESEASON ?? r?.year ?? null,
        prescribed: r?.PRESCRIBEDFIRE ?? r?.prescribed ?? null,
        raw: r,
      };
    })
    .filter(Boolean) as Array<{ lat: number; lon: number; name: string; year: any; prescribed: any; raw: AnyObj }>;
}

function readFirst(keys: string[]) {
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.trim().length) return v;
  }
  return "";
}

export default function McpResultPanel() {
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const loadFromStorage = () => {
      // ✅ 兼容你可能用过的各种 key（不需要你回忆到底哪个）
      const q = readFirst(["mcp:last_query", "mcp:query", "mcp:last_input", "mcp:last_prompt"]);
      const r = readFirst(["mcp:last_result", "mcp:result", "mcp:last_output", "mcp:last_json"]);
      const e = readFirst(["mcp:last_error", "mcp:error"]);

      setQuery(q);
      setErr(e || null);

      if (!r) {
        setRaw(null);
        return;
      }
      try {
        setRaw(JSON.parse(r));
      } catch {
        setRaw(r);
      }
    };

    // 初次读取
    loadFromStorage();

    // 你的 Run 逻辑会 dispatch 这个
    const onUpdated = () => loadFromStorage();

    // 兜底：如果你没 dispatch，我们也能靠 storage 事件（多标签页）/间接触发
    const onStorage = () => loadFromStorage();

    window.addEventListener("mcp:updated", onUpdated as any);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("mcp:updated", onUpdated as any);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const rows = useMemo(() => pickRows(raw), [raw]);
  const points = useMemo(() => extractPoints(rows), [rows]);

  // ✅ 核心：广播给地图（事件名必须叫 mcp:points）
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mcp:points", { detail: { points } }));
  }, [points]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">MCP Result</div>
          <div className="mt-1 text-xs text-slate-500">
            {query ? (
              <>
                Query: <span className="font-medium text-slate-700">{query}</span>
              </>
            ) : (
              "No MCP result yet. Run a query to see output here."
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500">{points.length} map points</div>
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {err}
        </div>
      )}

      <pre className="mt-4 max-h-[260px] overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-50">
        {raw ? JSON.stringify(raw, null, 2) : "{\n  \"results\": []\n}"}
      </pre>
    </section>
  );
}
