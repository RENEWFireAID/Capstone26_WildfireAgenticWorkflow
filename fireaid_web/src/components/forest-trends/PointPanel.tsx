"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Flame, MapPin, X } from "lucide-react";
import {
  CLIMATE_BANDS, CLIMATE_LABELS, INDEX_COLOR, INDEX_LABEL, INDICES, postJson,
  type ClimateLabel, type FireAtPoint, type TrendSettings, type VegIndex, type VegRecord,
} from "./data";

const TOOLTIP = { backgroundColor: "#111c4e", border: "none", color: "white", fontSize: 12 } as const;
const fmt = (v: unknown, digits = 3) => (typeof v === "number" ? v.toFixed(digits) : "no data");

function Box({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="min-w-0 border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-navy-deep">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function useFires(lat: number, lon: number) {
  const [state, setState] = useState<{ fires?: FireAtPoint[]; notes?: string[]; error?: string }>({});
  useEffect(() => {
    const c = new AbortController();
    setState({});
    postJson<{ fires: FireAtPoint[]; notes: string[] }>("/api/forest-trends", { kind: "fires", lat, lon }, c.signal)
      .then((r) => setState({ fires: r.fires, notes: r.notes }))
      .catch((e) => { if (e?.name !== "AbortError") setState({ error: e.message }); });
    return () => c.abort();
  }, [lat, lon]);
  return state;
}

function useSeries(lat: number, lon: number, s: TrendSettings) {
  const [state, setState] = useState<{ data?: VegRecord[]; error?: string }>({});
  useEffect(() => {
    const c = new AbortController();
    setState({});
    postJson<{ results: VegRecord[] }>(
      "/api/mcp/vegetation",
      { lat, lon, startYear: s.startYear, endYear: s.endYear, reducer: s.reducer },
      c.signal,
    )
      .then((r) => setState({ data: r.results }))
      .catch((e) => { if (e?.name !== "AbortError") setState({ error: e.message }); });
    return () => c.abort();
  }, [lat, lon, s.startYear, s.endYear, s.reducer]);
  return state;
}

function downloadCsv(rows: VegRecord[], lat: number, lon: number) {
  const cols = ["year", ...INDICES, ...Object.values(CLIMATE_BANDS)];
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => r[c] ?? "").join(","))];
  const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `climate_veg_timeseries_${lat.toFixed(4)}_${lon.toFixed(4)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PointPanel({ lat, lon, settings, onClear }: {
  lat: number;
  lon: number;
  settings: TrendSettings;
  onClear: () => void;
}) {
  const fires = useFires(lat, lon);
  const series = useSeries(lat, lon, settings);
  const [index, setIndex] = useState<VegIndex>(settings.index);
  const [climate, setClimate] = useState<ClimateLabel>("Summer Max Temp (°C)");
  useEffect(() => setIndex(settings.index), [settings.index]);

  // One marker per burn year in range; both datasets often list the same fire.
  const fireYears = useMemo(
    () => [...new Set((fires.fires ?? []).map((f) => f.year).filter((y): y is number =>
      y != null && y >= settings.startYear && y <= settings.endYear))].sort(),
    [fires.fires, settings.startYear, settings.endYear],
  );
  const band = CLIMATE_BANDS[climate];
  const data = series.data;
  const withImagery = data?.filter((d) => d.NDVI != null).length ?? 0;
  const climateMissing = data != null && data.every((d) => d[band] == null);

  const fireMarkers = fireYears.map((y) => (
    <ReferenceLine key={y} x={y} stroke="#e4572e" strokeDasharray="4 3"
      label={{ value: `fire ${y}`, position: "insideTopLeft", fill: "#e4572e", fontSize: 11 }} />
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-navy bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <MapPin size={20} className="text-navy" aria-hidden="true" />
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">Selected point</p>
            <p className="font-mono text-base font-semibold text-navy-deep">{lat.toFixed(4)}, {lon.toFixed(4)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && data.length > 0 && (
            <button type="button" onClick={() => downloadCsv(data, lat, lon)}
              className="flex items-center gap-2 border border-navy bg-white px-3 py-1.5 font-mono text-sm font-semibold uppercase tracking-wide text-navy transition hover:bg-navy-soft">
              <Download size={14} aria-hidden="true" /> CSV
            </button>
          )}
          <button type="button" onClick={onClear} aria-label="Clear the selected point"
            className="flex h-8 w-8 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-navy">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="border border-slate-200 bg-white px-5 py-3 text-sm">
        <span className="mr-2 inline-flex items-center gap-1.5 font-semibold text-slate-800">
          <Flame size={14} className="text-fire" aria-hidden="true" /> Location history:
        </span>
        {fires.error ? (
          <span className="text-amber-800">{fires.error}</span>
        ) : !fires.fires ? (
          <span className="text-slate-500">Checking MTBS and Alaska fire perimeters…</span>
        ) : fires.fires.length === 0 ? (
          <span className="text-slate-600">No mapped fire perimeter contains this point.</span>
        ) : (
          <span className="text-slate-700">
            {fires.fires.map((f, i) => (
              <span key={i}>{i > 0 && " · "}<b className="font-semibold">{f.name}</b> ({f.source}, {f.year ?? "unknown year"})</span>
            ))}
          </span>
        )}
        {fires.notes?.map((n) => <p key={n} className="mt-1 text-xs text-amber-800">{n}</p>)}
      </div>

      {series.error ? (
        <div className="border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">{series.error}</div>
      ) : !data ? (
        <div className="border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Querying Google Earth Engine for {settings.startYear}–{settings.endYear}… the first query at a location can take up to a minute.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Box title="Spectral trends" aside={
            <span className="font-mono text-xs text-slate-500">{withImagery}/{data.length} years with imagery · {settings.reducer}</span>
          }>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)}
                  label={{ value: "Index value", angle: -90, position: "insideLeft", offset: 18, fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={TOOLTIP} formatter={(v: any, n?: string) => [fmt(v, 4), n ?? ""]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {fireMarkers}
                {INDICES.map((k) => (
                  // Gaps are years with no usable imagery, so they are not bridged.
                  <Line key={k} dataKey={k} name={INDEX_LABEL[k]} stroke={INDEX_COLOR[k]} strokeWidth={2}
                    dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              NDVI drops and NBR falls sharply in a fire year; recovery shows as both climbing back over the following seasons.
            </p>
          </Box>

          <Box title="Climate correlation">
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Vegetation index
                <select value={index} onChange={(e) => setIndex(e.target.value as VegIndex)}
                  className="h-9 border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-navy">
                  {INDICES.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Climate variable
                <select value={climate} onChange={(e) => setClimate(e.target.value as ClimateLabel)}
                  className="h-9 border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-navy">
                  {CLIMATE_LABELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            {climateMissing ? (
              <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Climate data for {climate} is not yet available for the selected years.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={data} margin={{ top: 12, right: 0, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="veg" tick={{ fontSize: 11, fill: "#16a34a" }} domain={["auto", "auto"]}
                    tickFormatter={(v: number) => v.toFixed(2)} />
                  <YAxis yAxisId="clim" orientation="right" tick={{ fontSize: 11, fill: "#dc2626" }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v: any, n?: string) => [fmt(v, n === index ? 4 : 1), n ?? ""]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="veg" dataKey={index} name={index} stroke="#16a34a" strokeWidth={2.5} dot={{ r: 2 }}
                    connectNulls={false} isAnimationActive={false} />
                  <Line yAxisId="clim" dataKey={band} name={climate} stroke="#dc2626" strokeDasharray="5 4" strokeWidth={2}
                    dot={false} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>
        </div>
      )}
    </div>
  );
}
