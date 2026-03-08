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

function getFireColor(row: AnyObj): { fill: string; stroke: string } {
  const acres = toNum(row.ESTIMATEDTOTALACRES ?? row.acres ?? row.TOTALACRES ?? null) ?? 0;
  if (acres >= 10000) return { fill: "#dc2626", stroke: "#7f1d1d" };   // red    > 10,000
  if (acres >= 1000)  return { fill: "#ea580c", stroke: "#9a3412" };   // orange 1,000-10,000
  if (acres >= 100)   return { fill: "#eab308", stroke: "#854d0e" };   // yellow 100-1,000
  if (acres >= 10)    return { fill: "#22c55e", stroke: "#14532d" };   // green  10-100
  return                     { fill: "#3b82f6", stroke: "#1e3a8a" };   // blue   < 10
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
    // 
    const t1 = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // 
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

      const { fill, stroke } = getFireColor(r);
      const m = L.circleMarker([ll.lat, ll.lng], {
        radius: 5,
        color: stroke,
        fillColor: fill,
        fillOpacity: 0.9,
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

      const { fill, stroke } = getFireColor(r);
      const coloredIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:10px;height:10px;border-radius:9999px;
          background:${fill};border:2px solid ${stroke};
          box-shadow:0 0 6px ${fill}88;
        "></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const m = L.marker([ll.lat, ll.lng], { icon: coloredIcon });

      const name = r.INCIDENT_NAME ?? r.IncidentName ?? r.name ?? "";
      if (name) m.bindPopup(String(name));

      layerRef.current.addLayer(m);
    }
  }, [enabled, rows, icon]);

  return null;
}

function MapLegend({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div style={{
      position: "absolute", bottom: 24, right: 8, zIndex: 1000,
      background: "rgba(255,255,255,0.97)", borderRadius: 12,
      border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      padding: "10px 14px", minWidth: 160, fontSize: 11
    }}>
      <div style={{ fontWeight: 700, color: "#334155", marginBottom: 6 }}>Legend</div>

      {viewMode === "points" && (<>
        <div style={{ fontWeight: 600, color: "#94a3b8", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Fire Size (Estimated Acres)
        </div>
        {[
          { fill: "#dc2626", label: "≥ 10,000 acres", sub: "Major fire" },
          { fill: "#ea580c", label: "1,000 – 9,999 acres", sub: "Large fire" },
          { fill: "#eab308", label: "100 – 999 acres", sub: "Medium fire" },
          { fill: "#22c55e", label: "10 – 99 acres", sub: "Small fire" },
          { fill: "#3b82f6", label: "< 10 acres", sub: "Minor fire" },
        ].map(({ fill, label, sub }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: fill, flexShrink: 0 }} />
            <div>
              <div style={{ color: "#1e293b", fontWeight: 500 }}>{label}</div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{sub}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 10 }}>
          Each dot = 1 fire incident<br />
          Color by ESTIMATEDTOTALACRES<br />
          Query limit: 500 records<br />
          Total in DB: 33,596 records<br />
          Source: WFIGS via local MongoDB
        </div>
      </>)}

      {viewMode === "cluster" && (<>
        <div style={{ fontWeight: 600, color: "#94a3b8", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Cluster — Fire Count
        </div>
        <div style={{ color: "#1e293b", marginBottom: 8, lineHeight: 1.6 }}>
          Each number = total fire incidents in that area.
          Individual dots are colored by fire size (acres).
        </div>
        {[
          { fill: "#dc2626", label: "≥ 10,000 acres", sub: "Major fire" },
          { fill: "#ea580c", label: "1,000 – 9,999 acres", sub: "Large fire" },
          { fill: "#eab308", label: "100 – 999 acres", sub: "Medium fire" },
          { fill: "#22c55e", label: "10 – 99 acres", sub: "Small fire" },
          { fill: "#3b82f6", label: "< 10 acres", sub: "Minor fire" },
        ].map(({ fill, label, sub }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: fill, flexShrink: 0 }} />
            <div>
              <div style={{ color: "#1e293b", fontWeight: 500 }}>{label}</div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{sub}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 10 }}>
          Cluster radius: 50px<br />
          Expands at zoom level 11<br />
          Query limit: 500 records<br />
          Total in DB: 33,596 records<br />
          Source: WFIGS via local MongoDB
        </div>
      </>)}

      {viewMode === "heat" && (<>
        <div style={{ fontWeight: 600, color: "#94a3b8", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Fire Incident Density
        </div>
        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8, lineHeight: 1.6 }}>
          Color reflects the number of recorded fire incidents per geographic area — not fire intensity or temperature.
        </div>
        {[
          { fill: "#ff0000", label: "Highest concentration", sub: "Most fire incidents recorded" },
          { fill: "#ffff00", label: "High concentration", sub: "Frequent fire incidents" },
          { fill: "#00ff00", label: "Moderate concentration", sub: "Occasional fire incidents" },
          { fill: "#0000ff", label: "Low concentration", sub: "Few fire incidents recorded" },
        ].map(({ fill, label, sub }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <div style={{ width: 12, height: 8, borderRadius: 2, background: fill, flexShrink: 0 }} />
            <div>
              <div style={{ color: "#1e293b", fontWeight: 500 }}>{label}</div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{sub}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 10 }}>
          Kernel radius: 18px · Blur: 16px<br />
          Query limit: 500 records<br />
          Total in DB: 33,596 records<br />
          Source: WFIGS via local MongoDB
        </div>
      </>)}
    </div>
  );
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
    <div className="relative h-full w-full">
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

        <PointsLayer enabled={viewMode === "points"} rows={rows} />
        <ClusterLayer enabled={viewMode === "cluster"} rows={rows} />
        <HeatLayer enabled={viewMode === "heat"} rows={rows} />
      </MapContainer>

      {/* Legend overlay — outside MapContainer so React renders it normally */}
      <div className="absolute bottom-6 right-2 z-[1000] pointer-events-none">
        <MapLegend viewMode={viewMode} />
      </div>
    </div>
  );
}
