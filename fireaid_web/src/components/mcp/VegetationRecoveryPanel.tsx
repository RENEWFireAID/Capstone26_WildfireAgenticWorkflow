"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

type VegRecord = {
  year: number;
  NDVI: number | null;
  NBR: number | null;
  NDMI: number | null;
  Temp: number | null;
  Precip: number | null;
  [k: string]: number | null;
};

const SERIES = [
  { key: "NDVI", color: "#16a34a", label: "NDVI (greenness)" },
  { key: "NBR",  color: "#dc2626", label: "NBR (burn severity)" },
  { key: "NDMI", color: "#2563eb", label: "NDMI (moisture)" },
];

const START_YEAR = 2000;
const END_YEAR = 2024;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-sm font-semibold text-slate-800">Vegetation Recovery</div>
      <div className="mb-3 text-[11px] text-slate-400">
        Annual summer (Jun–Aug) Landsat indices · Google Earth Engine
      </div>
      {children}
    </div>
  );
}

export default function VegetationRecoveryPanel({
  lat,
  lon,
  fireYear,
}: {
  lat: number;
  lon: number;
  fireYear?: number | null;
}) {
  const [data, setData] = useState<VegRecord[] | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setErr(null);
      setData(null);
      try {
        const res = await fetch("/api/mcp/vegetation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, startYear: START_YEAR, endYear: END_YEAR }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        setData(json.results ?? []);
        setCached(Boolean(json.cached));
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErr(e?.message ?? "Failed to load vegetation data");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    // Selecting another fire point cancels the in-flight query for this one.
    return () => controller.abort();
  }, [lat, lon]);

  if (loading) {
    return (
      <Shell>
        <div className="h-[220px] w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-3 text-xs text-slate-500">
          Querying Google Earth Engine…
          <span className="block text-[11px] text-slate-400">
            The first query at a location can take up to a minute.
          </span>
        </div>
      </Shell>
    );
  }

  if (err) {
    return (
      <Shell>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {err}
        </div>
      </Shell>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Shell>
        <div className="py-6 text-center text-xs text-slate-400">
          No vegetation data available for this location.
        </div>
      </Shell>
    );
  }

  const withData = data.filter((d) => d.NDVI != null).length;
  const showFireYear =
    fireYear != null && fireYear >= START_YEAR && fireYear <= END_YEAR;

  return (
    <Shell>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 9 }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              borderRadius: "12px",
              border: "none",
              color: "white",
              fontSize: 11,
            }}
            formatter={(v: any, name: string) => [
              typeof v === "number" ? v.toFixed(4) : "no data",
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 9 }} />

          {showFireYear && (
            <ReferenceLine
              x={fireYear}
              stroke="#ea580c"
              strokeDasharray="4 3"
              label={{
                value: `fire ${fireYear}`,
                position: "top",
                fill: "#ea580c",
                fontSize: 9,
              }}
            />
          )}

          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={s.color}
              strokeWidth={2}
              // Gaps are real years with no usable imagery, so don't bridge them.
              connectNulls={false}
              dot={{ r: 1.5 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {withData}/{data.length} years with imagery · {START_YEAR}–{END_YEAR}
        </span>
        {cached && <span className="text-slate-300">cached</span>}
      </div>

      <div className="mt-2 leading-relaxed text-[10px] text-slate-400">
        NDVI drops and NBR falls sharply in a fire year; recovery shows as both
        climbing back over the following seasons.
      </div>
    </Shell>
  );
}
