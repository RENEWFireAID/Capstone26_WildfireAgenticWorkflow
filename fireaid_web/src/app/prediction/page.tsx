"use client";

import { useState } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { TrendingUp, Flame, AlertTriangle, RefreshCw, Info } from "lucide-react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

type HistoricalPoint = { year: number; count: number; acres: number };
type PredictionPoint = { year: number; predictedCount: number; predictedAcres: number };
type TopItem = { label: string; value: number };

type PredictionResult = {
  historical: HistoricalPoint[];
  predictions: PredictionPoint[];
  regression: {
    count: { slope: number; r2: number };
    acres: { slope: number; r2: number };
  };
  topCauses: TopItem[];
  topFuels: TopItem[];
  analysis: string;
  totalRecords: number;
};

const FOCUS_OPTIONS = [
  { value: "general",   label: "General Overview" },
  { value: "lightning", label: "Lightning Fires" },
  { value: "prescribed","label": "Prescribed Burns" },
  { value: "large",     label: "Large Fires (>1000 acres)" },
];

const TARGET_YEAR_OPTIONS = [
  { label: "2025 only",       value: [2025] },
  { label: "2025-2026",       value: [2025, 2026] },
  { label: "2025-2027",       value: [2025, 2026, 2027] },
];

export default function PredictionPage() {
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<PredictionResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [focus, setFocus]         = useState("general");
  const [targetYears, setTargetYears] = useState([2025, 2026, 2027]);
  const [nlInput, setNlInput] = useState("");

  async function generate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/mcp/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetYears, focus, message: nlInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate prediction");
    } finally {
      setLoading(false);
    }
  }

  // Merge historical + predictions for chart
  const chartData = result ? [
    ...result.historical.map(d => ({
      year: d.year,
      actual: d.count,
      acres: Math.round(d.acres / 1000),
      predicted: null,
    })),
    ...result.predictions.map(p => ({
      year: p.year,
      actual: null,
      acres: null,
      predicted: p.predictedCount,
    })),
  ] : [];

  const confidence = result ? Math.round(result.regression.count.r2 * 100) : 0;
  const trend = result ? (result.regression.count.slope > 0 ? "increasing" : "decreasing") : null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1fr)]">
      <FireAIDSidebar/>

      <div className="min-w-0 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">AI Fire Prediction</div>
              <div className="text-xs text-slate-500">Statistical trend analysis based on historical data (1939-2024)</div>
            </div>
          </div>

          {/* Natural language input */}
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 placeholder:text-slate-400"
              placeholder='e.g. "Predict lightning fires for 2025-2027" or "Will prescribed burns increase next year?"'
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              disabled={loading}
            />
            <button
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              onClick={generate}
              disabled={loading || !nlInput.trim()}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <TrendingUp size={14} />}
              {loading ? "Analyzing..." : "Predict"}
            </button>
          </div>

          {/* Suggested queries */}
          {!result && !loading && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Predict total fires for 2025-2027",
                "Will lightning fires increase in 2025?",
                "Forecast prescribed burns trend",
                "Predict large fires over 1000 acres",
                "Which fuel type will dominate future fires?",
              ].map(q => (
                <button key={q} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition" onClick={() => setNlInput(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        </div>

        {result && (
          <>
            {/* Prediction summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {result.predictions.map(p => (
                <div key={p.year} className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
                  <div className="text-[11px] font-semibold text-orange-600">{p.year} Prediction</div>
                  <div className="mt-1 text-2xl font-bold text-orange-700">{p.predictedCount}</div>
                  <div className="text-[11px] text-orange-500">fires expected</div>
                  <div className="mt-1 text-xs text-orange-600">{(p.predictedAcres/1000).toFixed(1)}K acres</div>
                </div>
              ))}
              <div className={`rounded-2xl border p-4 shadow-sm ${confidence >= 70 ? "border-emerald-200 bg-emerald-50" : confidence >= 40 ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}`}>
                <div className={`text-[11px] font-semibold ${confidence >= 70 ? "text-emerald-600" : confidence >= 40 ? "text-yellow-600" : "text-red-600"}`}>Model Confidence</div>
                <div className={`mt-1 text-2xl font-bold ${confidence >= 70 ? "text-emerald-700" : confidence >= 40 ? "text-yellow-700" : "text-red-700"}`}>{confidence}%</div>
                <div className={`text-[11px] ${confidence >= 70 ? "text-emerald-500" : confidence >= 40 ? "text-yellow-500" : "text-red-500"}`}>R² = {result.regression.count.r2.toFixed(2)} (1939–2024 fit)</div>
                <div className={`mt-1 text-xs ${confidence >= 70 ? "text-emerald-600" : confidence >= 40 ? "text-yellow-600" : "text-red-600"}`}>Trend: {trend}</div>
              </div>
            </div>

            {/* Main chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-slate-900">Historical Trend + Prediction</div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Info size={11} /> Based on {result.totalRecords} records
                </div>
              </div>
              <div className="text-xs text-slate-500 mb-4">Solid bars = actual data · Orange line = predicted</div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name) => [value, name === "actual" ? "Actual fires" : name === "predicted" ? "Predicted fires" : "Acres (K)"]} />
                  <Legend />
                  <ReferenceLine x={2024} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Now", fontSize: 11, fill: "#94a3b8" }} />
                  <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[3,3,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={_.actual !== null ? "#3b82f6" : "transparent"} />)}
                  </Bar>
                  <Bar dataKey="predicted" name="Predicted" fill="#f97316" radius={[3,3,0,0]} opacity={0.8} />
                  <Line type="monotone" dataKey="acres" name="Acres (K)" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* AI Analysis */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-blue-600" />
                <div className="text-sm font-bold text-blue-900">AI Risk Analysis</div>
              </div>
              <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{result.analysis}</div>
            </div>

            {/* Risk factors */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-bold text-slate-900 mb-3">Top Fire Causes</div>
                <div className="space-y-2">
                  {result.topCauses.map((c, i) => (
                    <div key={c.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">{i+1}</div>
                      <div className="flex-1 text-xs text-slate-700">{c.label}</div>
                      <div className="text-xs font-semibold text-slate-900">{c.value}</div>
                      <div className="w-20 h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${(c.value / result.topCauses[0].value) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-bold text-slate-900 mb-3">Top Fuel Types</div>
                <div className="space-y-2">
                  {result.topFuels.map((f, i) => (
                    <div key={f.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">{i+1}</div>
                      <div className="flex-1 text-xs text-slate-700">{f.label}</div>
                      <div className="text-xs font-semibold text-slate-900">{f.value}</div>
                      <div className="w-20 h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(f.value / result.topFuels[0].value) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
              <span className="font-semibold">Disclaimer:</span> Predictions are based on linear regression of historical data and are intended for research purposes only. Actual fire activity depends on weather, climate, and other factors not captured in this model.
            </div>
          </>
        )}

        {!result && !loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
            <TrendingUp size={32} className="mx-auto text-slate-300 mb-3" />
            <div className="text-sm font-semibold text-slate-500">No prediction yet</div>
            <div className="text-xs text-slate-400 mt-1">Configure parameters above and click Generate Prediction</div>
          </div>
        )}
      </div>
    </div>
  );
}