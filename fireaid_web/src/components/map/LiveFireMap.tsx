"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const ARCGIS_URL = "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0/query";

// Alaska from the Aleutians to the panhandle. The map cannot be dragged far
// past it, and cannot zoom out further than the view that shows all of it.
const ALASKA = L.latLngBounds([51, -179], [71.6, -129]);

function LockToAlaska() {
  const map = useMap();

  useEffect(() => {
    // The zoom that fits Alaska depends on the window size, so recompute it on resize.
    const fit = () => map.setMinZoom(map.getBoundsZoom(ALASKA));
    fit();
    map.on("resize", fit);
    return () => {
      map.off("resize", fit);
    };
  }, [map]);

  return null;
}

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
              background:rgba(8,15,30,0.94);
              border:1px solid rgba(148,197,255,0.22);
              border-radius:10px;
              padding:12px 14px;
              font-family:ui-sans-serif,system-ui,sans-serif;
              font-size:11px;
              color:#e2e8f0;
              min-width:200px;
              box-shadow:0 8px 28px rgba(0,0,0,0.5);
            ">
              <div style="color:#fb923c;font-weight:700;font-size:13px;margin-bottom:8px">
                ${name}
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="color:#94a3b8">State</span>
                <span>${state}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="color:#94a3b8">Acres</span>
                <span style="color:#fdba74;font-weight:600">${acres.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="color:#94a3b8">Contained</span>
                <span style="color:${pct === 100 ? '#6ee7b7' : '#fdba74'}">${pct}%</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="color:#94a3b8">Cause</span>
                <span>${cause}</span>
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
        /* Arctic night: tint Esri's grey canvas toward deep blue, so the
           fires are the only warm colour on the map. */
        .fire-map-dark .leaflet-tile {
          filter: sepia(1) hue-rotate(178deg) saturate(2.4) brightness(0.72) contrast(1.12);
        }
        /* A faint aurora along the top edge and a dark vignette at the sides. */
        .fire-map-dark::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 38% at 62% -6%, rgba(52,211,153,0.26) 0%, transparent 70%),
            radial-gradient(ellipse 55% 30% at 28% -4%, rgba(56,189,248,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 85% 85% at 50% 50%, transparent 55%, rgba(2,6,16,0.7) 100%);
          pointer-events: none;
          z-index: 500;
        }
        .fire-map-dark .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .fire-map-dark .leaflet-popup-tip {
          background: rgba(8,15,30,0.94) !important;
        }
        .fire-map-dark .leaflet-popup-close-button {
          color: #94a3b8 !important;
        }
      `}</style>
      <MapContainer
        className="fire-map-dark h-full w-full"
        style={{ width: "100%", height: "100%", background: "#050b18" }}
        bounds={ALASKA}
        maxBounds={ALASKA.pad(0.15)}
        maxBoundsViscosity={1}
        scrollWheelZoom
        zoomControl={false}
      >
        <LockToAlaska />
        {/* CARTO basemaps now require an API key and stamp unauthenticated
            tiles with an "API KEY REQUIRED" watermark. Esri's dark canvas is
            keyless and matches the dark theme. Note the {z}/{y}/{x} order. */}
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <FireLayer onFireCount={onFireCount} />
      </MapContainer>
    </>
  );
}