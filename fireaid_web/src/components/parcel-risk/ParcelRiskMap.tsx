"use client";

import { useEffect, type ComponentProps } from "react";
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type ParcelGeometry = ComponentProps<typeof GeoJSON>["data"];

export type MapPoint = { latitude: number; longitude: number };
export type RiskLayer = { name: string; shown: boolean; url: string; opacity?: number };
export type LegendEntry = { name: string; color: string };
export type MapView = { center: [number, number]; zoom: number };

function ClickToPick({ onPick }: { onPick: (point: MapPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function SetView({ view }: { view: MapView }) {
  const map = useMap();
  useEffect(() => {
    map.setView(view.center, view.zoom);
  }, [view, map]);
  return null;
}

export default function ParcelRiskMap({
  layers,
  legend,
  view,
  parcel,
  onPick,
}: {
  layers: RiskLayer[];
  legend: LegendEntry[];
  view: MapView;
  parcel: ParcelGeometry | null;
  onPick: (point: MapPoint) => void;
}) {
  return (
    <div className="relative h-full w-full">
      <MapContainer center={view.center} zoom={view.zoom} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />
        <LayersControl position="topright">
          {layers.map((layer, i) => (
            <LayersControl.Overlay key={layer.url} checked={layer.shown} name={layer.name}>
              {/* zIndex keeps the notebook's stacking when a day's layers are swapped in. */}
              <TileLayer url={layer.url} opacity={layer.opacity ?? 1} zIndex={i + 2} attribution="Google Earth Engine" maxZoom={19} />
            </LayersControl.Overlay>
          ))}
        </LayersControl>
        {parcel && <GeoJSON key={JSON.stringify(parcel)} data={parcel} style={{ color: "#00FFFF", weight: 3, fill: false }} />}
        <SetView view={view} />
        <ClickToPick onPick={onPick} />
      </MapContainer>

      {legend.length > 0 && (
        <div className="absolute bottom-6 right-3 z-[1000] rounded-md bg-white/90 px-2 py-1.5 text-[10px] leading-tight shadow">
          <div className="mb-1 font-semibold text-slate-900">Fire risk</div>
          <ul className="space-y-0.5">
            {legend.map((entry) => (
              <li key={entry.name} className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2 w-2 shrink-0 rounded-sm border border-slate-300" style={{ background: entry.color }} />
                {entry.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
