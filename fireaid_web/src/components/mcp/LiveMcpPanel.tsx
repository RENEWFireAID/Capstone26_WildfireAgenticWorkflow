"use client";

import { useMemo, useState } from "react";

type RunResult = any;

function buildPathFromNL(nl: string) {
  // 超轻量规则：你后面可以换成“LLM 路由”
  const text = (nl || "").toLowerCase();

  // year：抓 4 位数
  const m = text.match(/\b(19|20)\d{2}\b/);
  const year = m ? Number(m[0]) : 2024;

  // prescribed: 默认 Y；如果包含 “not prescribed / unprescribed / wildfire” 就 N
  const prescribed =
    text.includes("not prescribed") ||
    text.includes("unprescribed") ||
    text.includes("wildfire") ||
    text.includes("non-prescribed")
      ? "N"
      : "Y";

  // limit：默认 200（这样地图有点可画）
  const limit = 200;

  if (text.includes("count")) {
    return `/mcp/count?year=${year}&prescribed=${prescribed}`;
  }

  // 默认走 search
  return `/mcp/search?year=${year}&prescribed=${prescribed}&limit=${limit}`;
}

export default function LiveMcpPanel() {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const suggestedPath = useMemo(() => buildPathFromNL(input), [input]);

  async function onRun() {
    const query = input.trim();
    if (!query) return;

    setRunning(true);
    setStatus(null);

    // ✅ 先清 error
    localStorage.removeItem("mcp:last_error");

    // ✅ 写入 query & suggested path
    localStorage.setItem("mcp:last_query", query);
    localStorage.setItem("mcp:last_call", suggestedPath);

    try {
      const r = await fetch(`/api/mcp/run?path=${encodeURIComponent(suggestedPath)}`, {
        method: "GET",
        cache: "no-store",
      });

      const text = await r.text();

      if (!r.ok) {
        // 把后端错误也存起来
        localStorage.setItem("mcp:last_error", `HTTP ${r.status}: ${text}`);
        localStorage.removeItem("mcp:last_result");
        window.dispatchEvent(new Event("mcp:updated"));
        setStatus(`HTTP ${r.status}`);
        return;
      }

      // FireMCP 返回的是 JSON string
      let data: RunResult;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      // ✅ 写入结果（关键）
      localStorage.setItem("mcp:last_result", JSON.stringify(data));

      // ✅ 通知所有面板刷新（关键）
      window.dispatchEvent(new Event("mcp:updated"));

      setStatus("OK");
    } catch (e: any) {
      localStorage.setItem("mcp:last_error", e?.message || "fetch failed");
      localStorage.removeItem("mcp:last_result");
      window.dispatchEvent(new Event("mcp:updated"));
      setStatus("FAILED");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Live MCP</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ask in natural language. We route to FireMCP tools and update the map/results.
          </p>
        </div>

        <button
          onClick={onRun}
          disabled={running}
          className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`Examples:\n- "Show prescribed fires in 2024"\n- "Count fires in 2023"\n- "Show wildfires in 2020"`}
        className="mt-4 h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Suggested call:{" "}
          <span className="font-mono text-slate-700">{suggestedPath}</span>
        </div>
        {status && <div className="text-slate-700">Status: {status}</div>}
      </div>

      <div className="mt-2 text-[11px] text-slate-400">
        Tip: include a year like <b>2024</b> or <b>2023</b> to control the query.
      </div>
    </section>
  );
}
