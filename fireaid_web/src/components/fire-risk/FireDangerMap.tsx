"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { RefreshCw } from "lucide-react";

type Cell = { lat: number; lon: number; status: string; rating: string | null };
type DangerMap = { date: string; cell_deg: { lat: number; lon: number }; cells: Cell[] };
export type MapPlace = { name: string; latitude: number; longitude: number };

// Same AICC colours as the risk card.
const RATING_COLOR: Record<string, string> = {
  Low: "#2563eb",
  Moderate: "#16a34a",
  High: "#facc15",
  "Very High": "#f97316",
  Extreme: "#dc2626",
};
const UNRATED_COLOR = "#94a3b8";
const STATUS_TEXT: Record<string, string> = {
  out_of_season: "Out of season",
  snow: "Snow cover",
  too_cold: "Not started",
};
// Mainland, Aleutians to the Panhandle.
const ALASKA_BOUNDS: [[number, number], [number, number]] = [[54.5, -168], [71.5, -130]];

// The map can mount inside a hidden tab at 0x0, so re-measure (and fit Alaska the first
// time) whenever its container changes size.
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let fitted = el.clientWidth > 0;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && el.clientWidth > 0) {
        map.fitBounds(ALASKA_BOUNDS);
        fitted = true;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (place: MapPlace) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onPick({
        name: `${lat.toFixed(2)}°N, ${Math.abs(lng).toFixed(2)}°W`,
        latitude: Number(lat.toFixed(4)),
        longitude: Number(lng.toFixed(4)),
      });
    },
  });
  return null;
}

export default function FireDangerMap({
  date,
  selected,
  onPick,
}: {
  date: string;
  selected: MapPlace;
  onPick: (place: MapPlace) => void;
}) {
  const [map, setMap] = useState<DangerMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/fire-danger/map?date=${date}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setMap(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Map failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [date]);

  const halfLat = (map?.cell_deg.lat ?? 1) / 2;
  const halfLon = (map?.cell_deg.lon ?? 2) / 2;
  const allUnrated = map !== null && map.cells.every((c) => !c.rating);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Statewide fire danger</div>
          <div className="text-xs text-slate-600">Click anywhere on the map to see that spot&apos;s forecast above.</div>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
          {[...Object.entries(RATING_COLOR), ["Not rated", UNRATED_COLOR]].map(([label, color]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative h-[460px] overflow-hidden rounded-xl">
        <MapContainer
          bounds={ALASKA_BOUNDS}
          minZoom={3}
          scrollWheelZoom={false}
          className="h-full w-full"
          attributionControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {map?.cells.map((c) => (
            <Rectangle
              key={`${c.lat},${c.lon}`}
              bounds={[
                [c.lat - halfLat, c.lon - halfLon],
                [c.lat + halfLat, c.lon + halfLon],
              ]}
              pathOptions={{
                color: "#ffffff",
                weight: 0.5,
                fillColor: c.rating ? RATING_COLOR[c.rating] : UNRATED_COLOR,
                fillOpacity: c.rating ? 0.6 : 0.25,
              }}
            >
              <Tooltip sticky>{c.rating ?? STATUS_TEXT[c.status] ?? c.status}</Tooltip>
            </Rectangle>
          ))}
          <CircleMarker
            center={[selected.latitude, selected.longitude]}
            radius={7}
            pathOptions={{ color: "#0f172a", weight: 2, fillColor: "#ffffff", fillOpacity: 1 }}
          >
            <Tooltip>{selected.name}</Tooltip>
          </CircleMarker>
          <ClickToPick onPick={onPick} />
          <KeepSized />
        </MapContainer>

        {(loading || error || allUnrated) && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
            <div
              role={error ? "alert" : "status"}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md ${
                error ? "bg-red-50 text-red-700" : "bg-white text-slate-700"
              }`}
            >
              {error ? (
                <>Couldn&apos;t load the map: {error}</>
              ) : loading ? (
                <>
                  <RefreshCw size={14} className="motion-safe:animate-spin" aria-hidden />
                  Building the statewide map. A new date takes about 20 seconds.
                </>
              ) : (
                <>No ratings on this date. Alaska rates fire danger April 1 to September 30.</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
