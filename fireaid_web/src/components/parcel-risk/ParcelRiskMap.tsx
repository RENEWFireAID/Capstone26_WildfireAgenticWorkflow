"use client";

import { useEffect, useRef, type ComponentProps, type ComponentRef } from "react";
import { CircleMarker, GeoJSON, LayersControl, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export type ParcelGeometry = ComponentProps<typeof GeoJSON>["data"];

export type MapPoint = { latitude: number; longitude: number };
export type RiskLayer = { name: string; shown: boolean; url: string };
export type LegendEntry = { name: string; color: string };

const FNSB_BOUNDS: [[number, number], [number, number]] = [[64.0, -149.2], [65.5, -143.5]];

function ClickToPick({ onPick }: { onPick: (point: MapPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: Number(e.latlng.lat.toFixed(5)), longitude: Number(e.latlng.lng.toFixed(5)) });
    },
  });
  return null;
}

function ParcelOutline({ data }: { data: ParcelGeometry }) {
  const map = useMap();
  const ref = useRef<ComponentRef<typeof GeoJSON>>(null);
  useEffect(() => {
    const bounds = ref.current?.getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds, { maxZoom: 16, padding: [40, 40] });
  }, [data, map]);
  return <GeoJSON ref={ref} data={data} style={{ color: "#38bdf8", weight: 3, fillOpacity: 0.15 }} />;
}

export default function ParcelRiskMap({
  layers,
  legend,
  selected,
  parcel,
  onPick,
}: {
  layers: RiskLayer[];
  legend: LegendEntry[];
  selected: MapPoint | null;
  parcel: ParcelGeometry | null;
  onPick: (point: MapPoint) => void;
}) {
  return (
    <div className="relative h-full w-full">
      <MapContainer bounds={FNSB_BOUNDS} minZoom={7} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />
        <LayersControl position="topright">
          {layers.map((layer) => (
            <LayersControl.Overlay key={layer.name} checked={layer.shown} name={layer.name}>
              <TileLayer url={layer.url} attribution="Vegetation &amp; parcels: Google Earth Engine" maxZoom={19} />
            </LayersControl.Overlay>
          ))}
        </LayersControl>
        {parcel && <ParcelOutline key={JSON.stringify(parcel)} data={parcel} />}
        {selected && (
          <CircleMarker
            center={[selected.latitude, selected.longitude]}
            radius={7}
            pathOptions={{ color: "#0f172a", weight: 2, fillColor: "#ffffff", fillOpacity: 1 }}
          >
            <Tooltip>Selected spot</Tooltip>
          </CircleMarker>
        )}
        <ClickToPick onPick={onPick} />
      </MapContainer>

      {legend.length > 0 && (
        <div className="absolute bottom-6 right-3 z-[1000] max-w-[210px] rounded-md bg-white/90 px-2 py-1.5 text-[10px] leading-tight shadow">
          <div className="mb-1 font-semibold text-slate-900">Fire Risk Classes</div>
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
