"use client";

import { useEffect, useRef } from "react";
import { LayerGroup, LayersControl, MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "./folium-heat.js";

export type LightningData = {
  strikes: [number, number][];
  points: { type: "FeatureCollection"; features: { properties: Record<string, any>; geometry: unknown }[] };
};

const escape = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const localize = (v: unknown) => (typeof v === "number" ? v.toLocaleString() : v);

/** A tooltip table of label: value rows. */
function table(rows: [string, unknown][]) {
  return `<table>${rows.map(([k, v]) => `<tr><th style="text-align:left;padding-right:6px">${k}</th><td>${escape(localize(v))}</td></tr>`).join("")}</table>`;
}

function Heat({ strikes }: { strikes: [number, number][] }) {
  const group = useRef<L.LayerGroup>(null);
  useEffect(() => {
    // The options folium writes for HeatMap(radius=15, blur=12, max_opacity=0.8).
    const heat = (L as any).foliumHeatLayer(strikes, { minOpacity: 0.5, maxZoom: 18, radius: 15, blur: 12, maxOpacity: 0.8 });
    const g = group.current;
    g?.addLayer(heat);
    return () => void g?.removeLayer(heat);
  }, [strikes]);
  return <LayerGroup ref={group} />;
}

function FirePoints({ points }: { points: LightningData["points"] }) {
  const group = useRef<L.LayerGroup>(null);
  useEffect(() => {
    const layer = L.geoJSON(points, {
      pointToLayer: (_: unknown, latlng: L.LatLng) =>
        // The heatmap's canvas sits in the overlay pane; draw points above it, as folium does.
        L.circleMarker(latlng, { pane: "markerPane", radius: 6, color: "#ff7800", fill: true, fillColor: "#ff5500", fillOpacity: 0.7, weight: 1 }),
      onEachFeature: (f: any, l: any) =>
        l.bindTooltip(
          table([
            ["Fire Name:", f.properties.NAME],
            ["Season:", f.properties.FIRESEASON],
            ["Cause:", f.properties.GENERALCAUSE],
            ["Est. Acres:", f.properties.ESTIMATEDTOTALACRES],
          ]),
          { sticky: true },
        ),
    });
    const g = group.current;
    g?.addLayer(layer);
    return () => void g?.removeLayer(layer);
  }, [points]);
  return <LayerGroup ref={group} />;
}

export default function LightningMap({ data, embeddingUrl, embeddingLabel }: { data: LightningData | null; embeddingUrl: string | null; embeddingLabel: string }) {
  return (
    <MapContainer
      center={[64, -152]}
      zoom={4}
      className="h-full w-full"
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
      <LayersControl position="topright">
        {embeddingUrl && (
          <LayersControl.Overlay checked name={`Satellite Embeddings (${embeddingLabel})`}>
            <TileLayer key={embeddingUrl} url={embeddingUrl} attribution="Google Earth Engine" />
          </LayersControl.Overlay>
        )}
        {data && data.strikes.length > 0 && (
          <LayersControl.Overlay checked name="Lightning Strike Density">
            <Heat strikes={data.strikes} />
          </LayersControl.Overlay>
        )}
        {data && data.points.features.length > 0 && (
          <LayersControl.Overlay checked name="Historical Fire Points">
            <FirePoints points={data.points} />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  );
}
