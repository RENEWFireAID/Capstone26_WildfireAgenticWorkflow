"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

const center: LatLngExpression = [64.84, -147.72]; // Fairbanks 附近

export default function FireMap() {
  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={7}
        scrollWheelZoom={false}
        className="h-full w-full rounded-xl"
      >
        {/* 底图：OpenStreetMap */}
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 标注一个 10-mile 区域中心点（用圆点代替） */}
        <CircleMarker
          center={center}
          radius={10}
          pathOptions={{ color: "#f97316", weight: 2, fillOpacity: 0.3 }}
        >
          <Tooltip direction="top" offset={[0, -4]} permanent={false}>
            10-mile radius center
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
