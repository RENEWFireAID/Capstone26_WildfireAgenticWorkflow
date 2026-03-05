"use client";

import { useState, useRef } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { BarChart3, Send, X, Download } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

type ChartType = "bar" | "line" | "pie";
type ChatMsg = { role: "user" | "ai"; text: string };

type ChartData = {
  type: ChartType;
  title: string;
  description: string;
  data: { label: string; value: number }[];
  xKey: string;
  yKey: string;
};

const COLORS = ["#f97316","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#84cc16"];

const SUGGESTED = [
  "Show fires by general cause in 2022",
  "Fires per year from 2015 to 2024",
  "Top 10 fuel types by fire count",
  "Compare prescribed vs wildfire counts 2020-2024",
  "Lightning fires trend over the years",
];

export default function ChartsPage() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/mcp/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      setMsgs(m => [...m, { role: "ai", text: data.summary }]);
      if (data.chart) setCharts(c => [data.chart, ...c]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: "ai", text: "Error: " + (e?.message ?? "Failed to generate chart") }]);
    } finally {
      setLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1fr)]">
      <FireAIDSidebar active="charts" />

      <div className="min-w-0 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white">
              <BarChart3 size={18} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">AI Chart Generator</div>
              <div className="text-xs text-slate-500">Ask in plain English — AI queries the database and generates charts</div>
            </div>
          </div>

          {/* Chat input */}
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder:text-slate-400"
              placeholder="e.g. Show fires by cause in 2022..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading}
            />
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              {loading ? "..." : <Send size={14} />}
            </button>
          </div>

          {/* Suggested queries */}
          {charts.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED.map(q => (
                <button key={q} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition" onClick={() => sendMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat messages */}
        {msgs.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 max-h-48 overflow-y-auto">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 animate-pulse">Generating chart...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Charts */}
        {charts.map((chart, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold text-slate-900">{chart.title}</div>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => setCharts(c => c.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
            <div className="text-xs text-slate-500 mb-4">{chart.description}</div>

            <ResponsiveContainer width="100%" height={300}>
              {chart.type === "bar" ? (
                <BarChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f97316" radius={[4,4,0,0]} />
                </BarChart>
              ) : chart.type === "line" ? (
                <LineChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie data={chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={110} label={({ label, percent }) => `${label} ${(percent*100).toFixed(0)}%`}>
                    {chart.data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        ))}

        {charts.length === 0 && msgs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
            <BarChart3 size={32} className="mx-auto text-slate-300 mb-3" />
            <div className="text-sm font-semibold text-slate-500">No charts yet</div>
            <div className="text-xs text-slate-400 mt-1">Ask a question above to generate your first chart</div>
          </div>
        )}
      </div>
    </div>
  );
}