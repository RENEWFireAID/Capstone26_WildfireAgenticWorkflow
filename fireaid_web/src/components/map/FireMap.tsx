"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet.markercluster";

type ViewMode = "points" | "cluster" | "heat";
type AnyObj = Record<string, any>;

function safeParseJSON(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickRows(parsed: any): AnyObj[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && Array.isArray((parsed as any).results)) return (parsed as any).results;
  if (typeof parsed === "object" && Array.isArray((parsed as any).items)) return (parsed as any).items;
  if (typeof parsed === "object" && Array.isArray((parsed as any).data)) return (parsed as any).data;
  return [];
}

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickLatLng(row: AnyObj): { lat: number; lng: number } | null {
  const lat =
    toNum(row.LATITUDE) ??
    toNum(row.latitude) ??
    toNum(row.Latitude) ??
    toNum(row.lat) ??
    toNum(row.LAT);

  const lng =
    toNum(row.LONGITUDE) ??
    toNum(row.longitude) ??
    toNum(row.Longitude) ??
    toNum(row.lon) ??
    toNum(row.lng) ??
    toNum(row.LON);

  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Fix map “tile offset / broken grid” after mode/layout changes */
function InvalidateSizeOnChange({ viewMode }: { viewMode: ViewMode }) {
  const map = useMap();

  useEffect(() => {
    // 第一次渲染后强制刷新
    const t1 = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // 再补一刀（防止 grid 动画延迟）
    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    map.invalidateSize();
  }, [map, viewMode]);

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

  return null;
}


/** Optional: expose map in console as __fireMap for debugging */
function ExposeMapForDebug() {
  const map = useMap();
  useEffect(() => {
    (window as any).__fireMap = map;
    return () => {
      if ((window as any).__fireMap === map) delete (window as any).__fireMap;
    };
  }, [map]);
  return null;
}

/** Heat layer created once and updated via setLatLngs */
function HeatLayer({ enabled, rows }: { enabled: boolean; rows: AnyObj[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  const heatPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (const r of rows) {
      const ll = pickLatLng(r);
      if (!ll) continue;
      pts.push([ll.lat, ll.lng, 1]);
    }
    return pts;
  }, [rows]);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
      return;
    }

    if (!layerRef.current) {
      layerRef.current = (L as any).heatLayer([], {
        radius: 18,
        blur: 16,
        maxZoom: 10,
      });
    }

    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map);

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
    };
  }, [enabled, map]);

  useEffect(() => {
    if (!enabled) return;
    if (!layerRef.current) return;
    layerRef.current.setLatLngs(heatPoints);
  }, [enabled, heatPoints]);

  return null;
}

/** Points layer: keep a layerGroup and just clear/add markers on updates */
function PointsLayer({ enabled, rows }: { enabled: boolean; rows: AnyObj[] }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
      return;
    }

    if (!layerRef.current) layerRef.current = L.layerGroup();
    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map);

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
    };
  }, [enabled, map]);

  useEffect(() => {
    if (!enabled) return;
    if (!layerRef.current) return;

    layerRef.current.clearLayers();

    for (const r of rows) {
      const ll = pickLatLng(r);
      if (!ll) continue;

      const m = L.circleMarker([ll.lat, ll.lng], {
        radius: 4,
        color: "#7f1d1d",
        fillColor: "#ff3b30",
        fillOpacity: 0.95,
        weight: 1,
      });

      const name = r.INCIDENT_NAME ?? r.IncidentName ?? r.name ?? "";
      if (name) m.bindPopup(String(name));

      m.addTo(layerRef.current);
    }
  }, [enabled, rows]);

  return null;
}

/** Cluster layer: markerClusterGroup + update markers on rows change */
function ClusterLayer({ enabled, rows }: { enabled: boolean; rows: AnyObj[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  // small red dot icon
  const icon = useMemo(() => {
    return L.divIcon({
      className: "",
      html: `<div style="
        width:10px;height:10px;border-radius:9999px;
        background:#ff3b30;border:2px solid #7f1d1d;
        box-shadow:0 0 6px rgba(255,59,48,.55);
      "></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
      return;
    }

    if (!layerRef.current) {
      layerRef.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 11,
        maxClusterRadius: 50,
      });
    }

    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map);

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) map.removeLayer(layerRef.current);
    };
  }, [enabled, map]);

  useEffect(() => {
    if (!enabled) return;
    if (!layerRef.current) return;

    layerRef.current.clearLayers();

    for (const r of rows) {
      const ll = pickLatLng(r);
      if (!ll) continue;

      const m = L.marker([ll.lat, ll.lng], { icon });

      const name = r.INCIDENT_NAME ?? r.IncidentName ?? r.name ?? "";
      if (name) m.bindPopup(String(name));

      layerRef.current.addLayer(m);
    }
  }, [enabled, rows, icon]);

  return null;
}

export default function FireMap({ viewMode = "points" }: { viewMode?: ViewMode }) {
  const [rows, setRows] = useState<AnyObj[]>([]);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem("mcp:last_result");
      const parsed = safeParseJSON(raw);
      setRows(pickRows(parsed));
    };

    load();
    window.addEventListener("mcp:updated", load);
    return () => window.removeEventListener("mcp:updated", load);
  }, []);

  return (
    <MapContainer
  className="h-full w-full"
  style={{ width: "100%", height: "100%" }}
  center={[64.8, -147.7]}
  zoom={4}
  scrollWheelZoom
>

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <InvalidateSizeOnChange viewMode={viewMode} />
      <ExposeMapForDebug />

      {/* Points */}
      <PointsLayer enabled={viewMode === "points"} rows={rows} />

      {/* Cluster */}
      <ClusterLayer enabled={viewMode === "cluster"} rows={rows} />

      {/* Heat */}
      <HeatLayer enabled={viewMode === "heat"} rows={rows} />
    </MapContainer>
  );
}
