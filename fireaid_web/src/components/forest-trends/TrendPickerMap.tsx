"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

type AnyObj = Record<string, any>;

export type PickedPoint = {
  lat: number;
  lon: number;
  /** The fire record when a marker was clicked, null for a bare map click. */
  fire: AnyObj | null;
};

// The full collection is ~33.6k records and ~38 MB over this route, so the
// picker loads a recent slice. The window is chosen to fit entirely under
// LIMIT (2022-2024 is 1583 points), because /api/mcp/run applies the limit
// without sorting, so a window that overflows would silently drop whole
// years off the end. Clicking bare map works anywhere regardless.
const YEAR_START = 2022;
const YEAR_END = 2024;
const LIMIT = 2000;

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickLatLng(row: AnyObj): { lat: number; lng: number } | null {
  const lat = toNum(row.LATITUDE ?? row.latitude ?? row.lat);
  const lng = toNum(row.LONGITUDE ?? row.longitude ?? row.lon ?? row.lng);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Fire markers; clicking one picks it along with its fire year. */
function FireLayer({
  rows,
  onPick,
}: {
  rows: AnyObj[];
  onPick: (p: PickedPoint) => void;
}) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map);
    const layer = layerRef.current;
    layer.clearLayers();

    for (const r of rows) {
      const ll = pickLatLng(r);
      if (!ll) continue;

      const m = L.circleMarker([ll.lat, ll.lng], {
        radius: 4,
        color: "#9a3412",
        fillColor: "#ea580c",
        fillOpacity: 0.85,
        weight: 1,
      });

      m.on("click", (e) => {
        // Keep the map's own click handler from also firing a bare pick.
        L.DomEvent.stopPropagation(e as unknown as Event);
        onPick({ lat: ll.lat, lon: ll.lng, fire: r });
      });

      const name = r.NAME ?? r.INCIDENT_NAME ?? "";
      if (name) m.bindTooltip(String(name), { direction: "top" });

      layer.addLayer(m);
    }
  }, [map, rows, onPick]);

  useEffect(() => {
    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map]);

  return null;
}

/** Any click that did not land on a fire marker picks a bare coordinate. */
function ClickCatcher({ onPick }: { onPick: (p: PickedPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng, fire: null });
    },
  });
  return null;
}

/** Highlight ring on the currently selected point. */
function SelectedMarker({ picked }: { picked: PickedPoint | null }) {
  const map = useMap();
  const ref = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (ref.current) {
      map.removeLayer(ref.current);
      ref.current = null;
    }
    if (!picked) return;

    ref.current = L.circleMarker([picked.lat, picked.lon], {
      radius: 9,
      color: "#16a34a",
      fillColor: "#16a34a",
      fillOpacity: 0.2,
      weight: 3,
    }).addTo(map);

    return () => {
      if (ref.current && map.hasLayer(ref.current)) map.removeLayer(ref.current);
      ref.current = null;
    };
  }, [map, picked]);

  return null;
}

export default function TrendPickerMap({
  picked,
  onPick,
}: {
  picked: PickedPoint | null;
  onPick: (p: PickedPoint) => void;
}) {
  const [rows, setRows] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/mcp/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearStart: YEAR_START,
            yearEnd: YEAR_END,
            limit: LIMIT,
          }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        const results = json.results ?? [];
        setRows(results);
        // Never claim a complete window if the limit actually clipped it.
        setTruncated(results.length >= LIMIT);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErr(e?.message ?? "Failed to load fire points");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <MapContainer
          className="h-full w-full"
          style={{ width: "100%", height: "100%" }}
          center={[64.8, -147.7]}
          zoom={5}
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCatcher onPick={onPick} />
          <FireLayer rows={rows} onPick={onPick} />
          <SelectedMarker picked={picked} />
        </MapContainer>

        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/60 text-xs text-slate-500">
            Loading fire points…
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[11px] text-slate-400">
        <span>
          Click anywhere on the map, or click a fire to carry its fire year into
          the chart.
        </span>
        {err ? (
          <span className="text-amber-700">{err}</span>
        ) : (
          <span>
            {rows.length} fires ·{" "}
            {truncated ? `${YEAR_START}–${YEAR_END}, truncated` : `${YEAR_START}–${YEAR_END}`}
          </span>
        )}
      </div>
    </div>
  );
}
