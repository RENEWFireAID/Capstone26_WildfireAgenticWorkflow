"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

export type GridPoint = { id: string; lat: number; lon: number; elevation_m: number | null };

function FitTo({ points }: { points: GridPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/** The weather grid on a terrain basemap; click a point to choose it. */
export default function WeatherGridMap({ points, selected, onSelect }: {
  points: GridPoint[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <MapContainer className="h-full w-full" center={[69.1, -148.4]} zoom={7} scrollWheelZoom>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
      />
      <FitTo points={points} />
      {points.map((p) => {
        const on = p.id === selected;
        return (
          <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={on ? 10 : 7}
            pathOptions={{ color: on ? "#111c4e" : "#ffffff", weight: on ? 3 : 2, fillColor: on ? "#ffcd00" : "#236192", fillOpacity: 1 }}
            eventHandlers={{ click: () => onSelect(p.id) }}>
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="font-mono text-xs">{p.id} · {p.elevation_m ?? "?"} m</span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
