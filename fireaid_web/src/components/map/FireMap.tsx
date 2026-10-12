"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet.markercluster";

type ViewMode = "points" | "cluster" | "heat" | "smoke";
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

function DrawBoxLayer() {
  const map = useMap();
  const rectRef = useRef<L.Rectangle | null>(null);
  const startRef = useRef<L.LatLng | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    function startDraw() {
      // Change cursor
      map.getContainer().style.cursor = "crosshair";
      map.dragging.disable();
      drawingRef.current = true;

      // Clean up previous rectangle
      if (rectRef.current) { map.removeLayer(rectRef.current); rectRef.current = null; }

      function onMouseDown(e: L.LeafletMouseEvent) {
        if (!drawingRef.current) return;
        startRef.current = e.latlng;

        if (rectRef.current) map.removeLayer(rectRef.current);
        rectRef.current = L.rectangle([e.latlng, e.latlng], {
          color: "#f97316", weight: 2, fillColor: "#f97316", fillOpacity: 0.1, dashArray: "6,4"
        }).addTo(map);
      }

      function onMouseMove(e: L.LeafletMouseEvent) {
        if (!startRef.current || !rectRef.current) return;
        rectRef.current.setBounds(L.latLngBounds(startRef.current, e.latlng));
      }

      function onMouseUp(e: L.LeafletMouseEvent) {
        if (!startRef.current || !rectRef.current) return;
        drawingRef.current = false;
        map.getContainer().style.cursor = "";
        map.dragging.enable();

        const bounds = L.latLngBounds(startRef.current, e.latlng);
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // Dispatch result so mcp-tools page can use it
        window.dispatchEvent(new CustomEvent("mcp:boxselected", {
          detail: {
            lat_min: sw.lat, lat_max: ne.lat,
            lng_min: sw.lng, lng_max: ne.lng,
          }
        }));

        map.off("mousedown", onMouseDown);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
        startRef.current = null;
      }

      map.on("mousedown", onMouseDown);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
    }

    function clearSelection() {
      if (rectRef.current) { map.removeLayer(rectRef.current); rectRef.current = null; }
      map.getContainer().style.cursor = "";
      map.dragging.enable();
      drawingRef.current = false;
      startRef.current = null;
      window.dispatchEvent(new CustomEvent("mcp:boxselected", { detail: null }));
    }

    window.addEventListener("mcp:drawbox", startDraw);
    window.addEventListener("mcp:clearselection", clearSelection);
    return () => {
      window.removeEventListener("mcp:drawbox", startDraw);
      window.removeEventListener("mcp:clearselection", clearSelection);
    };
  }, [map]);

  return null;
}

function MapLegend({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div style={{
      position: "absolute", bottom: 32, left: 12, zIndex: 1000,
      background: "rgba(255,255,255,0.95)", borderRadius: 10,
      border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      padding: "8px 12px", fontSize: 10, minWidth: 180,
    }}>
      {viewMode === "heat" && (<>
        <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4, fontSize: 11 }}>
          Fire Incident Density
        </div>
        <div style={{
          height: 10, borderRadius: 5, marginBottom: 4,
          background: "linear-gradient(to right, #0000ff, #00ff00, #ffff00, #ff0000)",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 6 }}>
          <span>Few fires</span>
          <span>Many fires</span>
        </div>
        <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
          Color = fire incident count per area<br />
          Not intensity or temperature<br />
          Source: MongoDB · 33,596 records
        </div>
      </>)}

      {viewMode === "smoke" && (<>
        <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4, fontSize: 11 }}>
          PM2.5 Air Quality
        </div>
        <div style={{
          height: 10, borderRadius: 5, marginBottom: 4,
          background: "linear-gradient(to right, #00e400, #ffff00, #ff7e00, #ff0000, #8f3f97)",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 6 }}>
          <span>Good</span>
          <span>Hazardous</span>
        </div>
        <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
          Source: Open-Meteo · NOAA GFS<br />
          Updates hourly<br />
          Grid: 1.5°lat × 2.5°lon<br />
          Each circle = 120km radius<br />
          Opacity ∝ PM2.5 concentration<br />
          AQI ≤50 Good · ≤100 Moderate<br />
          ≤150 Unhealthy · ≤200 Very Unhealthy<br />
          &gt;200 Hazardous
        </div>
      </>)}

      {(viewMode === "points" || viewMode === "cluster") && (<>
        <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4, fontSize: 11 }}>
          {viewMode === "cluster" ? "Fire Count (Clustered)" : "Fire Size (Acres)"}
        </div>
        <div style={{
          height: 10, borderRadius: 5, marginBottom: 4,
          background: "linear-gradient(to right, #3b82f6, #22c55e, #eab308, #ea580c, #dc2626)",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 6 }}>
          <span>&lt; 10 ac</span>
          <span>≥ 10K ac</span>
        </div>
        {viewMode === "cluster" && (
          <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
            Number = fires in area<br />
            Expands at zoom 11
          </div>
        )}
        <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
          Source: MongoDB · 33,596 records
        </div>
      </>)}
    </div>
  );
}


function SmokeLayer({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!enabled) return;

    layerRef.current = L.layerGroup().addTo(map);

    // Grid of points across Alaska
    const points: [number, number][] = [];
    for (let lat = 54; lat <= 72; lat += 1.5) {
      for (let lon = -170; lon <= -130; lon += 2.5) {
        points.push([lat, lon]);
      }
    }

    Promise.all(
      points.map(([lat, lon]) =>
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,us_aqi`)
          .then(r => r.json())
          .then(data => ({ lat, lon, pm25: data.current?.pm2_5 ?? 0, aqi: data.current?.us_aqi ?? 0 }))
          .catch(() => ({ lat, lon, pm25: 0, aqi: 0 }))
      )
    ).then(results => {
      if (!layerRef.current) return;
      results.forEach(({ lat, lon, pm25, aqi }) => {
        if (pm25 === 0) return;
        const color = aqi <= 50 ? "#00e400"
                    : aqi <= 100 ? "#ffff00"
                    : aqi <= 150 ? "#ff7e00"
                    : aqi <= 200 ? "#ff0000"
                    : "#8f3f97";
        const opacity = Math.min(0.15 + (pm25 / 60) * 0.55, 0.7);
        L.circle([lat, lon], {
          radius: 120000,
          color: "transparent",
          fillColor: color,
          fillOpacity: opacity,
        }).bindTooltip(
          `<div style="font-family:monospace;font-size:11px;background:#111;color:#fff;padding:6px 10px;border-radius:6px;border:1px solid #333">
            <div style="color:#aaa;margin-bottom:2px">${lat.toFixed(1)}°N ${Math.abs(lon).toFixed(1)}°W</div>
            <div>PM2.5: <b style="color:#ffbb00">${pm25} μg/m³</b></div>
            <div>AQI: <b style="color:${color}">${aqi}</b></div>
          </div>`,
          { sticky: true, opacity: 1, className: "leaflet-tooltip-raw" }
        ).addTo(layerRef.current!);
      });
    });

    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [enabled, map]);

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

        <DrawBoxLayer />
        <PointsLayer enabled={viewMode === "points"} rows={rows} />
        <ClusterLayer enabled={viewMode === "cluster"} rows={rows} />
        <HeatLayer enabled={viewMode === "heat"} rows={rows} />
        <SmokeLayer enabled={viewMode === "smoke"} />
      </MapContainer>

      {/* Legend overlay — outside MapContainer so React renders it normally */}
      <div className="absolute bottom-6 left-2 z-[1000] pointer-events-none">
        <MapLegend viewMode={viewMode} />
      </div>
    </div>
  );
}
