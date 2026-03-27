"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const ARCGIS_URL = "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0/query";

function FireLayer({ onFireCount }: { onFireCount?: (n: number) => void }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map);

    async function loadFires() {
      try {
        const params = new URLSearchParams({
          where: "POOState='US-AK'",
          outFields: "*",
          f: "geojson",
          resultRecordCount: "2000",
        });

        const res = await fetch(`${ARCGIS_URL}?${params}`);
        const data = await res.json();
        const features = data?.features ?? [];
        onFireCount?.(features.length);

        features.forEach((f: any) => {
          const coords = f.geometry?.coordinates;
          if (!coords) return;

          let lat: number, lng: number;
          if (f.geometry.type === "Point") {
            [lng, lat] = coords;
          } else if (f.geometry.type === "Polygon") {
            [lng, lat] = coords[0][0];
          } else return;

          const acres = Number(f.properties?.DailyAcres ?? f.properties?.CalculatedAcres ?? 0);
          const name  = f.properties?.IncidentName ?? "Active Fire";
          const pct   = f.properties?.PercentContained ?? "N/A";
          const state = f.properties?.POOState ?? "";
          const cause = f.properties?.FireCause ?? "Unknown";

          // Size tiers
          //radius 14 = massive fire areas
          //radius 10 = large fires
          //radius 7 = medium fires
          //others are smaller fires
          const radius = acres >= 10000 ? 14 : acres >= 1000 ? 10 : acres >= 100 ? 7 : 5;


          /*************** Effect of glowing spot *************** */
          // Outer glow ring
          // For very large fires, use a more intense red and larger glow; for smaller fires, use a softer orange glow
          L.circleMarker([lat, lng], {
            radius: radius + 6,
            color: acres >= 10000 ? "rgba(255,60,0,0.25)" : "rgba(255,120,0,0.2)",
            weight: 0,
            fillColor: acres >= 10000 ? "rgba(255,60,0,0.12)" : "rgba(255,140,0,0.1)",
            fillOpacity: 1,
          }).addTo(layerRef.current!);

          // Mid glow ring
          L.circleMarker([lat, lng], {
            radius: radius + 3,
            color: acres >= 10000 ? "rgba(255,80,0,0.4)" : "rgba(255,150,0,0.3)",
            weight: 1,
            fillColor: "transparent",
            fillOpacity: 0,
          }).addTo(layerRef.current!);

          // Core dot
          const core = L.circleMarker([lat, lng], {
            radius,
            color: acres >= 10000 ? "#ff2200" : acres >= 1000 ? "#ff6600" : "#ff9900",
            weight: 1.5,
            fillColor: acres >= 10000 ? "#ff4400" : acres >= 1000 ? "#ff8800" : "#ffbb00",
            fillOpacity: 0.95,
          });
        /*************** Effect of POPUP cards  *************** */
        /*************** Info of fire spots *************** */
          core.bindPopup(`
            <div style="
              background:#0d0d0d;
              border:1px solid #ff4400;
              border-radius:8px;
              padding:12px;
              font-family:monospace;
              font-size:11px;
              color:#fff;
              min-width:200px;
              box-shadow:0 0 20px rgba(255,60,0,0.4);
            ">
              <div style="color:#ff4400;font-weight:700;font-size:13px;margin-bottom:8px;letter-spacing:1px">
                🔥 ${name.toUpperCase()}
              </div>
              <div style="color:#888;margin-bottom:4px">───────────────</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="color:#666">STATE</span>
                <span style="color:#ff9900">${state}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="color:#666">ACRES</span>
                <span style="color:#ff6600;font-weight:700">${acres.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="color:#666">CONTAINED</span>
                <span style="color:${pct === 100 ? '#00ff88' : '#ff4400'}">${pct}%</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="color:#666">CAUSE</span>
                <span style="color:#ffbb00">${cause}</span>
              </div>
            </div>
          `);

          core.addTo(layerRef.current!);

          // Pulse animation for large fires
          if (acres >= 1000) {
            let animFrame: number;
            let startTime: number | null = null;
            const baseRadius = radius;
            const pulseAmp = acres >= 10000 ? 3.5 : 2;
            const speed = acres >= 10000 ? 0.0018 : 0.0014;

            function animate(ts: number) {
              if (!startTime) startTime = ts;
              const t = (ts - startTime) * speed;
              const r = baseRadius + Math.sin(t) * pulseAmp;
              core.setRadius(r);
              animFrame = requestAnimationFrame(animate);
            }
            animFrame = requestAnimationFrame(animate);
            (core as any)._pulseFrame = animFrame;
          }
        });
      } catch (e) {
        console.error("Failed to load ArcGIS fire data", e);
        onFireCount?.(0);
      }
    }

    loadFires();
    return () => {
      if (layerRef.current) {
        layerRef.current.eachLayer((layer: any) => {
          if (layer._pulseFrame) cancelAnimationFrame(layer._pulseFrame);
        });
        map.removeLayer(layerRef.current);
      }
    };
  }, [map]);

  return null;
}

export default function LiveFireMap({ onFireCount }: { onFireCount?: (n: number) => void }) {
  return (
    <>



      <style>{`
        /* CartoDB dark tile — boost coastline glow */
        .fire-map-dark .leaflet-tile {
          filter: brightness(1.1) saturate(1.2) contrast(1.1) sepia(0.15) hue-rotate(5deg);
        }
        /* Corner vignette — black to deep red from all 4 corners */
        .fire-map-dark::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 80% at 0% 0%,   rgba(120,0,0,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 80% 80% at 100% 0%,  rgba(120,0,0,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 80% 80% at 0% 100%,  rgba(120,0,0,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 80% 80% at 100% 100%,rgba(120,0,0,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 60% at 50% 50%,  transparent 40%, rgba(0,0,0,0.5) 100%);
          pointer-events: none;
          z-index: 500;
        }
        /* Scan lines tech effect */
        .fire-map-dark::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.12) 3px,
            rgba(0,0,0,0.12) 4px
          );
          pointer-events: none;
          z-index: 501;
        }
        .fire-map-dark .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .fire-map-dark .leaflet-popup-tip {
          background: #ff4400 !important;
        }
        .fire-map-dark .leaflet-popup-close-button {
          color: #ff4400 !important;
        }
      `}</style>
      <MapContainer
        className="fire-map-dark h-full w-full"
        style={{ width: "100%", height: "100%", background: "#0a0400" }}
        center={[64, -153]}
        zoom={5}
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FireLayer onFireCount={onFireCount} />
      </MapContainer>
    </>
  );
}