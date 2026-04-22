"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export type GridPoint = {
  lat:             number;
  lng:             number;
  avg_probability: number;
  max_probability: number;
  fire_days:       number;
  total_days:      number;
};

type ViewMode = "probability" | "heat";

function probabilityColor(p: number): string {
  if (p >= 0.75) return "#dc2626"; // red
  if (p >= 0.5)  return "#f97316"; // orange
  if (p >= 0.25) return "#eab308"; // yellow
  return "#22c55e";                // green
}

function probabilityStroke(p: number): string {
  if (p >= 0.75) return "#7f1d1d";
  if (p >= 0.5)  return "#9a3412";
  if (p >= 0.25) return "#854d0e";
  return "#14532d";
}

const MAX_SNAP_DIST = 0.5;

function nearestPoint(points: GridPoint[], lat: number, lng: number): GridPoint | null {
  let nearest: GridPoint | null = null;
  let minDist = Infinity;
  for (const pt of points) {
    const d = Math.hypot(pt.lat - lat, pt.lng - lng);
    if (d < minDist) { minDist = d; nearest = pt; }
  }
  return minDist <= MAX_SNAP_DIST ? nearest : null;
}

function popupHtml(pt: GridPoint): string {
  return `<div style="font-family:monospace;font-size:11px;line-height:1.6">
    <b style="font-size:12px">Grid Cell</b><br/>
    Lat: ${pt.lat.toFixed(2)}° · Lon: ${pt.lng.toFixed(2)}°<br/>
    Avg probability: <b>${(pt.avg_probability * 100).toFixed(1)}%</b><br/>
    Max probability: <b>${(pt.max_probability * 100).toFixed(1)}%</b>
  </div>`;
}

function ClickLayer({ points, enabled }: { points: GridPoint[]; enabled: boolean }) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!enabled || points.length === 0) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    }
  }, [enabled, points, map]);

  useEffect(() => {
    return () => {
      if (markerRef.current) map.removeLayer(markerRef.current);
    };
  }, [map]);

  useMapEvents({
    click(e) {
      if (!enabled || points.length === 0) return;

      const pt = nearestPoint(points, e.latlng.lat, e.latlng.lng);
      if (!pt) return;

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }

      markerRef.current = L.circleMarker([pt.lat, pt.lng], {
        radius:      7,
        color:       probabilityStroke(pt.avg_probability),
        fillColor:   probabilityColor(pt.avg_probability),
        fillOpacity: 0.85,
        weight:      1,
      })
        .bindPopup(popupHtml(pt))
        .addTo(map)
        .openPopup();
    },
  });

  return null;
}

function HeatLayer({ points, enabled }: { points: GridPoint[]; enabled: boolean }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
      return;
    }
    if (!layerRef.current) {
      layerRef.current = (L as any).heatLayer([], { radius: 22, blur: 18, maxZoom: 10 });
    }
    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map);
    layerRef.current.setLatLngs(
      points.map((p) => [p.lat, p.lng, p.avg_probability])
    );
    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
    };
  }, [enabled, points, map]);

  return null;
}

const LEGEND = [
  { label: "≥ 75%",    color: "#dc2626" },
  { label: "50 – 75%", color: "#f97316" },
  { label: "25 – 50%", color: "#eab308" },
  { label: "< 25%",    color: "#22c55e" },
];

const MONTH_NAMES: Record<number, string> = {
  5: "May", 6: "June", 7: "July", 8: "August",
};

type DataMode = "historical" | "future";

const CURRENT_YEAR = new Date().getFullYear();

export default function PredictionFireMap() {
  const [dataMode, setDataMode] = useState<DataMode>("historical");
  const [year,     setYear]     = useState(2003);
  const [futureYear, setFutureYear] = useState(CURRENT_YEAR);
  const [month,    setMonth]    = useState(7);
  const [viewMode, setViewMode] = useState<ViewMode>("probability");
  const [points,   setPoints]   = useState<GridPoint[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const activeYear = dataMode === "historical" ? year : futureYear;

  async function fetchPoints(y: number, m: number, mode: DataMode) {
    setLoading(true);
    setError(null);
    const endpoint = mode === "future" ? "/api/ml/future-map-data" : "/api/ml/map-data";
    try {
      const res = await fetch(`${endpoint}?year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load map data");
      setPoints(data.points ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }

  function handleDataModeChange(mode: DataMode) {
    setDataMode(mode);
    setPoints([]);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Data mode toggle */}
      <div className="flex gap-1 self-start rounded-xl border border-slate-200 bg-white p-1">
        {(["historical", "future"] as DataMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleDataModeChange(m)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              dataMode === m
                ? "bg-orange-500 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {m === "historical" ? "Historical (2000–2007)" : "Future Forecast"}
          </button>
        ))}
      </div>

      {dataMode === "future" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Future fire probability is estimated by extrapolating historical weather trends with linear regression, then running the XGBoost model on those predicted conditions.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-800">
            Year
          </label>
          {dataMode === "historical" ? (
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-orange-400"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 8 }, (_, i) => 2000 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={2008}
              max={2100}
              value={futureYear}
              onChange={(e) => setFutureYear(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-orange-400"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-800">
            Month
          </label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-orange-400"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {[5, 6, 7, 8].map((m) => (
              <option key={m} value={m}>{MONTH_NAMES[m]}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => fetchPoints(activeYear, month, dataMode)}
          disabled={loading}
          className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load Map"}
        </button>

        <div className="ml-auto flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(["probability", "heat"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                viewMode === m
                  ? "bg-orange-500 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {m === "probability" ? "Points" : "Heat"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200" style={{ height: 420 }}>
        <MapContainer
          center={[64.8, -147.7]}
          zoom={6}
          scrollWheelZoom
          className="h-full w-full"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickLayer  points={points} enabled={viewMode === "probability"} />
          <HeatLayer   points={points} enabled={viewMode === "heat"} />
        </MapContainer>

        {/* Legend — only for points mode */}
        {viewMode === "probability" && (
          <div className="pointer-events-none absolute bottom-6 left-3 z-[1000] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow text-[10px]">
            <div className="mb-1 text-[11px] font-bold text-slate-700">
              Avg Fire Probability
            </div>
            {LEGEND.map(({ label, color }) => (
              <div key={label} className="mt-0.5 flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full" style={{ background: color }} />
                <span className="text-slate-600">{label}</span>
              </div>
            ))}
            {points.length > 0 && (
              <div className="mt-1.5 border-t border-slate-100 pt-1 text-slate-400">
                {MONTH_NAMES[month]} {activeYear}{dataMode === "future" ? " (forecast)" : ""} · click map to reveal
              </div>
            )}
          </div>
        )}

        {/* Empty state overlay */}
        {!loading && points.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
            <div className="rounded-xl border border-slate-200 bg-white/90 px-6 py-4 text-center shadow">
              <div className="text-sm font-semibold text-slate-500">No data loaded</div>
              <div className="mt-1 text-xs text-slate-400">
                Select a year and month, click Load Map, then click anywhere on the map
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
