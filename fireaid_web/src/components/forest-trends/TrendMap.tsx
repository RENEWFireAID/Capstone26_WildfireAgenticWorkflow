"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { BASEMAPS, type Basemap, type Ring } from "./data";

export type DrawMode = "none" | "rectangle" | "polygon";


// Finishing a shape ends in a mouseup or click that must not also pick a point.
let lastDrawEnd = 0;

const ROI_STYLE: L.PathOptions = { color: "#111c4e", weight: 2, dashArray: "6 4", fill: false };
const DRAFT_STYLE: L.PathOptions = { color: "#236192", weight: 2, dashArray: "4 4", fillColor: "#236192", fillOpacity: 0.08 };

/** Rectangle: press, drag and release. Polygon: click each corner, then double-click or click the first corner. */
function DrawTool({ mode, onDone, onCancel }: { mode: DrawMode; onDone: (ring: Ring) => void; onCancel: () => void }) {
  const map = useMap();
  const draft = useRef<L.Layer | null>(null);
  const start = useRef<L.LatLng | null>(null);
  const corners = useRef<L.LatLng[]>([]);
  const lastClick = useRef<{ t: number; p: L.Point } | null>(null);

  const clearDraft = () => {
    if (draft.current) map.removeLayer(draft.current);
    draft.current = null;
  };

  useEffect(() => {
    const container = map.getContainer();
    if (mode === "none") return;
    container.style.cursor = "crosshair";
    map.doubleClickZoom.disable();
    if (mode === "rectangle") map.dragging.disable();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => {
      container.style.cursor = "";
      map.doubleClickZoom.enable();
      map.dragging.enable();
      window.removeEventListener("keydown", onKey);
      clearDraft();
      start.current = null;
      corners.current = [];
      lastClick.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mode]);

  const finishPolygon = () => {
    const pts = corners.current;
    if (pts.length >= 3) {
      lastDrawEnd = Date.now();
      onDone(pts.map((p) => [p.lng, p.lat]));
    }
  };

  const drawPolygonDraft = (cursor?: L.LatLng) => {
    clearDraft();
    const pts = cursor ? [...corners.current, cursor] : corners.current;
    if (pts.length >= 2) draft.current = L.polygon(pts, DRAFT_STYLE).addTo(map);
    else if (pts.length === 1) draft.current = L.circleMarker(pts[0], { radius: 3, color: "#236192" }).addTo(map);
  };

  useMapEvents({
    mousedown(e) {
      if (mode !== "rectangle") return;
      start.current = e.latlng;
    },
    mousemove(e) {
      if (mode === "rectangle" && start.current) {
        clearDraft();
        draft.current = L.rectangle(L.latLngBounds(start.current, e.latlng), DRAFT_STYLE).addTo(map);
      } else if (mode === "polygon" && corners.current.length) {
        drawPolygonDraft(e.latlng);
      }
    },
    mouseup(e) {
      if (mode !== "rectangle" || !start.current) return;
      const b = L.latLngBounds(start.current, e.latlng);
      start.current = null;
      if (b.getNorth() - b.getSouth() < 1e-4 || b.getEast() - b.getWest() < 1e-4) return;
      lastDrawEnd = Date.now();
      onDone([
        [b.getWest(), b.getSouth()],
        [b.getEast(), b.getSouth()],
        [b.getEast(), b.getNorth()],
        [b.getWest(), b.getNorth()],
      ]);
    },
    click(e) {
      if (mode !== "polygon") return;
      const pts = corners.current;
      const now = Date.now();
      const prev = lastClick.current;
      lastClick.current = { t: now, p: e.containerPoint };
      // A second click on the same spot is a double-click: its first click
      // already placed the last corner, so finish. Browsers do not reliably
      // fire dblclick on the map once double-click zoom is off, so detect it here.
      const isDouble = prev && now - prev.t < 400 && prev.p.distanceTo(e.containerPoint) < 6;
      // Clicking near the first corner also closes the shape.
      const onFirst = pts.length >= 3 && map.latLngToContainerPoint(pts[0]).distanceTo(e.containerPoint) < 12;
      if (isDouble || onFirst) {
        finishPolygon();
        return;
      }
      pts.push(e.latlng);
      drawPolygonDraft();
    },
  });

  return null;
}

/** A bare map click, when not drawing, picks a point for the time series. */
function PointPicker({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      if (enabled && Date.now() - lastDrawEnd > 400) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RegionOutline({ ring, fitKey }: { ring: Ring | null; fitKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (!ring) return;
    const layer = L.polygon(ring.map(([lon, lat]) => [lat, lon] as [number, number]), ROI_STYLE).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, ring]);
  // Zoom to the region once its trends arrive, as her app centres on the ROI.
  useEffect(() => {
    if (!ring || !fitKey) return;
    map.fitBounds(L.latLngBounds(ring.map(([lon, lat]) => [lat, lon] as [number, number])), { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

function PickedMarker({ point }: { point: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    const m = L.circleMarker([point.lat, point.lon], {
      radius: 8, color: "#ffcd00", weight: 3, fillColor: "#111c4e", fillOpacity: 0.6,
    }).addTo(map);
    return () => { map.removeLayer(m); };
  }, [map, point]);
  return null;
}

export type MapLayer = { key: string; url: string; opacity: number };

export default function TrendMap({
  basemap,
  mode,
  onDrawn,
  onCancelDraw,
  ring,
  fitKey,
  layers,
  picked,
  onPick,
}: {
  basemap: Basemap;
  mode: DrawMode;
  onDrawn: (ring: Ring) => void;
  onCancelDraw: () => void;
  ring: Ring | null;
  fitKey: number;
  layers: MapLayer[];
  picked: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
}) {
  const base = BASEMAPS[basemap];
  return (
    <MapContainer className="h-full w-full" center={[64.2, -149.5]} zoom={5} scrollWheelZoom>
      <TileLayer key={basemap} url={base.url} attribution={base.attribution} />
      {layers.map((l) => (
        <TileLayer key={`${l.key}:${l.url}`} url={l.url} opacity={l.opacity} attribution="Google Earth Engine" />
      ))}
      <RegionOutline ring={ring} fitKey={fitKey} />
      <PickedMarker point={picked} />
      <DrawTool mode={mode} onDone={onDrawn} onCancel={onCancelDraw} />
      <PointPicker enabled={mode === "none"} onPick={onPick} />
    </MapContainer>
  );
}
