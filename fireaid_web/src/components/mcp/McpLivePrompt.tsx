"use client";

import { useState } from "react";
import { writeMcpResult } from "@/lib/mcpStore";

export default function McpLivePrompt() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function buildPathFromNL(input: string) {
    const q = input.toLowerCase();

    const wantsPrescribed =
      q.includes("prescribed") ||
      q.includes("rx") ||
      q.includes("planned burn") ||
      q.includes("处方") ||
      q.includes("计划烧") ||
      q.includes("控制燃烧") ||
      q.includes("prescribed fire");

    const wantsCount =
      q.includes("count") ||
      q.includes("how many") ||
      q.includes("number of") ||
      q.includes("数量") ||
      q.includes("多少") ||
      q.includes("统计");

    // parse year like 2024 if present, else default 2024
    const yearMatch = q.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : 2024;

    if (wantsCount) {
      return `/mcp/count?year=${year}`;
    }

    // default: search points
    // note: FireMCP openapi shows prescribed default "Y"; we set explicitly
    const prescribed = wantsPrescribed ? "Y" : "N";
    const limit = 200;

    return `/mcp/search?year=${year}&prescribed=${prescribed}&limit=${limit}`;
  }

  async function run() {
    if (!text.trim()) return;

    setLoading(true);
    setErr(null);

    try {
      const path = buildPathFromNL(text);

      // IMPORTANT: FireMCP currently supports GET endpoints, so we call our proxy with ?path=
      const res = await fetch(`/api/mcp/run?path=${encodeURIComponent(path)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      // Wrap it into a consistent shape for ResultPanel + Map to read
      const wrapped = {
        query: text,
        toolPath: path,
        createdAt: new Date().toISOString(),
        raw: data,
      };

      writeMcpResult(wrapped);
      setText("");
    } catch (e: any) {
      setErr(e?.message || "Failed to run MCP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Live MCP</div>
          <div className="text-xs text-slate-500">
            Ask in natural language. We route to FireMCP tools and update the map/results.
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || !text.trim()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Examples:
- "Show prescribed fires in 2024"
- "Count fires in 2023"
- "Show fires in 2024"'
        className="mt-3 h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:bg-white"
      />

      {err && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="mt-3 text-[11px] text-slate-400">
        Tip: include a year like <span className="font-medium text-slate-600">2024</span> or{" "}
        <span className="font-medium text-slate-600">2023</span> to control the query.
      </div>
    </div>
  );
}
