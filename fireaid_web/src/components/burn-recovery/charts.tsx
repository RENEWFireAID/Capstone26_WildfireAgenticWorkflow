"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TOOLTIP_STYLE } from "@/components/ui/app";
import { SEVERITY_COLORS, colorAt, gradientCss } from "./data";

type Stop = [number, string];
export type Scale = { stops: Stop[]; low: number; high: number; title: string; digits: number };

export function ColorBar({ scale }: { scale: { stops: Stop[]; low: number; high: number; title: string } }) {
  return (
    <div className="mx-auto w-full max-w-md text-xs text-slate-600">
      <div className="h-3" style={{ background: gradientCss(scale.stops) }} />
      <div className="mt-1 flex justify-between font-mono tabular">
        <span>{scale.low}</span>
        <span className="font-sans">{scale.title}</span>
        <span>{scale.high}</span>
      </div>
    </div>
  );
}

function ticks(lo: number, hi: number, count = 4) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / count)));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => (hi - lo) / s <= count + 1) ?? step;
  const out: number[] = [];
  for (let v = Math.ceil(lo / nice) * nice; v <= hi + 1e-9; v += nice) out.push(+v.toFixed(6));
  return out;
}

/**
 * Sample locations on their UTM grid, equal scale on both axes, coloured by a
 * value. Clicking a point selects it.
 */
export function SampleMap({ x, y, values, scale, selected, onSelect }: {
  x: number[];
  y: number[];
  values: number[];
  scale: Scale;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const layout = useMemo(() => {
    const [x0, x1] = [Math.min(...x), Math.max(...x)];
    const [y0, y1] = [Math.min(...y), Math.max(...y)];
    const pad = 0.03 * Math.max(x1 - x0, y1 - y0);
    const xr: [number, number] = [x0 - pad, x1 + pad];
    const yr: [number, number] = [y0 - pad, y1 + pad];
    const W = 560, L = 52, R = 12, T = 12, B = 40;
    const k = (W - L - R) / (xr[1] - xr[0]); // pixels per km, shared by both axes
    const H = Math.round(T + B + k * (yr[1] - yr[0]));
    return { xr, yr, W, H, L, T, B, k };
  }, [x, y]);
  const { xr, yr, W, H, L, T, B, k } = layout;
  const px = (v: number) => L + (v - xr[0]) * k;
  const py = (v: number) => T + (yr[1] - v) * k;
  const shown = hover ?? selected;

  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full border border-slate-200 bg-white" role="img"
        aria-label="Sampled locations coloured by the selected value; select a point to see its greenness over time">
        {ticks(xr[0], xr[1]).map((t) => (
          <g key={`x${t}`}>
            <line x1={px(t)} x2={px(t)} y1={T} y2={H - B} stroke="#eef1f4" />
            <text x={px(t)} y={H - B + 14} textAnchor="middle" fontSize="10" fill="#64748b">{t}</text>
          </g>
        ))}
        {ticks(yr[0], yr[1]).map((t) => (
          <g key={`y${t}`}>
            <line x1={L} x2={W - 12} y1={py(t)} y2={py(t)} stroke="#eef1f4" />
            <text x={L - 6} y={py(t) + 3} textAnchor="end" fontSize="10" fill="#64748b">{t}</text>
          </g>
        ))}
        <text x={(L + W - 12) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#475569">UTM easting (km)</text>
        <text transform={`translate(13 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#475569">UTM northing (km)</text>
        {x.map((_, i) => (
          <circle key={i} cx={px(x[i])} cy={py(y[i])} r={3.2}
            fill={colorAt(scale.stops, values[i], scale.low, scale.high)}
            className="cursor-pointer"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(i)} />
        ))}
        {selected !== null && (
          <circle cx={px(x[selected])} cy={py(y[selected])} r={6.5} fill="none" stroke="#0a1f3d" strokeWidth={2.2} pointerEvents="none" />
        )}
      </svg>
      <div className="mt-2 flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-mono tabular">
          {shown !== null
            ? `Sample ${shown} · E ${x[shown].toFixed(2)} km · N ${y[shown].toFixed(2)} km · ${scale.title} ${values[shown].toFixed(scale.digits)}`
            : "Point at a location for its values; select it to plot its greenness."}
        </span>
      </div>
      <div className="mt-2"><ColorBar scale={scale} /></div>
    </div>
  );
}

/** Mean NDVI per dNBR group across the sample years, plus one selected location. */
export function TrajectoryChart({ years, trajectory, selected }: {
  years: number[];
  trajectory: { severity: number; label: string; n: number; mean: number[] }[];
  selected: { index: number; values: number[] } | null;
}) {
  const rows = years.map((year, i) => {
    const row: Record<string, number> = { year };
    for (const t of trajectory) row[`g${t.severity}`] = t.mean[i];
    if (selected) row.selected = selected.values[i];
    return row;
  });
  return (
    <div className="h-[400px] w-full min-w-0 border border-slate-200 bg-white p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#eef1f4" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} label={{ value: "Summer", position: "insideBottom", offset: -2, fontSize: 11 }} height={36} />
          <YAxis domain={[-0.2, 1]} ticks={[-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]} tick={{ fontSize: 11 }}
            label={{ value: "NDVI", angle: -90, position: "insideLeft", offset: 14, fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "white" }} formatter={(v) => (typeof v === "number" ? v.toFixed(3) : v)} labelFormatter={(l) => `Summer ${l}`} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} />
          {trajectory.map((t) => (
            <Line key={t.severity} dataKey={`g${t.severity}`} name={`dNBR ${t.label} (n=${t.n})`}
              stroke={SEVERITY_COLORS[t.severity]} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
          ))}
          {selected && (
            <Line dataKey="selected" name={`Sample ${selected.index}`} stroke="#0a1f3d" strokeWidth={3.5} dot={{ r: 3 }} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Held-out observed vs predicted slopes on equal axes, with the 1:1 line. */
export function ObservedPredicted({ observed, predicted }: { observed: number[]; predicted: number[] }) {
  const S = 480, M = 56, P = 14;
  const lo = Math.min(...observed, ...predicted), hi = Math.max(...observed, ...predicted);
  const k = (S - M - P) / (hi - lo);
  const px = (v: number) => M + (v - lo) * k;
  const py = (v: number) => S - M + P - (v - lo) * k - P;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="h-auto w-full border border-slate-200 bg-white" role="img"
      aria-label="Observed against predicted NDVI slopes for the held-out fire">
      {ticks(lo, hi, 6).map((t) => (
        <g key={t}>
          <line x1={px(t)} x2={px(t)} y1={P} y2={S - M} stroke="#eef1f4" />
          <line x1={M} x2={S - P} y1={py(t)} y2={py(t)} stroke="#eef1f4" />
          <text x={px(t)} y={S - M + 14} textAnchor="middle" fontSize="9.5" fill="#64748b">{t}</text>
          <text x={M - 5} y={py(t) + 3} textAnchor="end" fontSize="9.5" fill="#64748b">{t}</text>
        </g>
      ))}
      {observed.map((o, i) => (
        <circle key={i} cx={px(o)} cy={py(predicted[i])} r={2.4} fill="#236192" fillOpacity={0.35} />
      ))}
      <line x1={px(lo)} y1={py(lo)} x2={px(hi)} y2={py(hi)} stroke="#111c4e" strokeDasharray="5 4" strokeWidth={1.5} />
      <text x={(M + S - P) / 2} y={S - 12} textAnchor="middle" fontSize="11" fill="#475569">Observed slope (NDVI/year)</text>
      <text transform={`translate(13 ${(P + S - M) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#475569">Predicted slope (NDVI/year)</text>
    </svg>
  );
}

/** The selected model's error beside the training-mean baseline's. */
export function RmseBars({ model, baseline }: { model: number; baseline: number }) {
  const max = Math.max(model, baseline) * 1.1;
  const rows: [string, number, string][] = [["Selected model", model, "bg-navy"], ["Training-mean baseline", baseline, "bg-slate-400"]];
  return (
    <div className="flex h-full flex-col justify-center gap-4 border border-slate-200 bg-white p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">RMSE (NDVI/year), lower is better</p>
      {rows.map(([label, value, color]) => (
        <div key={label} className="grid grid-cols-[150px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
          <span className="text-slate-700">{label}</span>
          <div className="h-5 bg-slate-100">
            <div className={`h-full ${color}`} style={{ width: `${(100 * value) / max}%` }} />
          </div>
          <span className="text-right font-mono font-semibold tabular text-navy-deep">{value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}
