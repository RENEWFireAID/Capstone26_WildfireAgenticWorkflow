"use client";

import { useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";
import type { LegendEntry, MapPoint, ParcelGeometry, RiskLayer } from "@/components/parcel-risk/ParcelRiskMap";

const ParcelRiskMap = dynamic(() => import("@/components/parcel-risk/ParcelRiskMap"), { ssr: false });

// The card style the other app pages use.
const CARD = "bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]";

const SUGGESTIONS = [
  "What's the fire risk for parcel 622476?",
  "Which vegetation types carry the most fire risk?",
  "Why does black spruce rank so high?",
];

type Parcel = {
  PAN: number;
  PARCEL_SUB?: string;
  PARCEL_BLO?: string;
  PARCEL_LOT?: string;
  PARCEL_TYP?: string;
  risk_score: number | null;
  geometry?: ParcelGeometry;
};

type SpotInfo = {
  no_data?: boolean;
  vegetation?: string;
  vegetation_class?: number;
  risk_level?: number;
  risk_name?: string;
  risk_color?: string;
  parcels: Parcel[];
};

async function lookup(body: object) {
  const res = await fetch("/api/parcel-risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Lookup failed");
  return data;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ParcelRiskPage() {
  const [parcelId, setParcelId] = useState("");
  const [layers, setLayers] = useState<RiskLayer[]>([]);
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const [status, setStatus] = useState<string | null>("Loading the fire risk layers…");
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [spot, setSpot] = useState<SpotInfo | string | null>(null);
  const [found, setFound] = useState<Parcel[] | string | null>(null);

  useEffect(() => {
    fetch("/api/parcel-risk")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !Array.isArray(data?.layers)) throw new Error(data?.error ?? "Could not load the map layers");
        setLayers(data.layers);
        setLegend(data.legends?.fire_risk ?? []);
        setStatus(null);
      })
      .catch((e) => setStatus(errorText(e)));
  }, []);

  async function pick(point: MapPoint) {
    setSelected(point);
    setSpot("Looking up this spot…");
    setSpot(await lookup({ lat: point.latitude, lon: point.longitude }).catch(errorText));
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setFound("Searching…");
    setFound(await lookup({ pan: parcelId.trim() }).then((d) => d.parcels, errorText));
  }

  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="Apps · Property risk"
          title="Parcel Fire Risk"
          description="The vegetation fire risk of every property in the Fairbanks North Star Borough. Click the map for the risk at that spot, or look up a parcel number for its 0-100 score."
          meta={["AVIRIS-NG / Sentinel-2 vegetation classification", "FNSB tax parcels", "Google Earth Engine"]}
        />

        <div className="grid flex-1 grid-cols-1 gap-5 bg-slate-50 px-6 py-6 md:px-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 space-y-5">
            <div className={`relative h-[640px] overflow-hidden ${CARD}`}>
              <ParcelRiskMap layers={layers} legend={legend} selected={selected} parcel={parcelShape(found)} onPick={pick} />
              {status && (
                <div role="status" className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 bg-white px-4 py-2 text-sm text-slate-700 shadow-md">
                  {status}
                </div>
              )}
            </div>

            <section className={`p-5 ${CARD}`}>
              <h2 className="flex items-center gap-2 text-xl font-bold text-navy-deep">
                <MapPin size={18} aria-hidden /> Selected spot
              </h2>
              {selected && spot && typeof spot === "object" ? (
                <SpotDetails point={selected} spot={spot} />
              ) : (
                <p className="mt-2 text-sm text-slate-600">{typeof spot === "string" ? spot : "Click the map to identify the fire risk level."}</p>
              )}
            </section>
          </div>

          <div className="min-w-0 space-y-5">
            <form onSubmit={search} className={`space-y-3 border-t-4 border-gold p-5 ${CARD}`}>
              <label className="block">
                <span className="mb-2 block text-xl font-bold text-navy-deep">Find a parcel by ID (PAN)</span>
                <input
                  value={parcelId}
                  onChange={(e) => setParcelId(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 622476"
                  className="h-9 w-full border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-navy"
                />
              </label>
              <button
                type="submit"
                disabled={!parcelId.trim()}
                className="flex w-full items-center justify-center gap-2 bg-gold px-5 py-2.5 font-mono text-sm font-semibold uppercase tracking-wide text-navy-deep transition hover:bg-[#ffd94d] disabled:opacity-40"
              >
                <Search size={14} aria-hidden /> Search
              </button>
              {typeof found === "string" && <p className="text-xs text-slate-600">{found}</p>}
              {Array.isArray(found) && found.map((p, i) => <ParcelRow key={i} parcel={p} />)}
            </form>

            <FireRiskChat
              endpoint="/api/parcel-risk/chat"
              title="Ask about parcel fire risk"
              subtitle="Vegetation, fire risk and parcel scores"
              suggestions={SUGGESTIONS}
              chartSource="the FNSB parcel fire risk data"
              modelFeature="parcelRisk"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function parcelShape(found: Parcel[] | string | null): ParcelGeometry | null {
  if (!Array.isArray(found)) return null;
  const features = found.filter((p) => p.geometry).map((p) => ({ type: "Feature", properties: {}, geometry: p.geometry }));
  return features.length ? ({ type: "FeatureCollection", features } as unknown as ParcelGeometry) : null;
}

function SpotDetails({ point, spot }: { point: MapPoint; spot: SpotInfo }) {
  const color = spot.no_data ? "#000000" : spot.risk_color;
  return (
    <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto">
      <div className="border-l-4 bg-slate-50 p-3 text-sm text-slate-700" style={{ borderColor: color }}>
        <div className="font-semibold text-navy-deep">{spot.no_data ? "Water / No Data" : spot.risk_name}</div>
        {spot.no_data ? (
          <p className="mt-1">This area contains no vegetation data.</p>
        ) : (
          <>
            <p className="mt-1"><b>Risk Level:</b> {spot.risk_level} of 4</p>
            <p className="mt-1"><b>Source Vegetation:</b> {spot.vegetation} (Class {spot.vegetation_class})</p>
          </>
        )}
        <p className="mt-1">
          <b>Location:</b> {point.latitude.toFixed(5)}°N, {Math.abs(point.longitude).toFixed(5)}°W
        </p>
      </div>
      {spot.parcels.length ? spot.parcels.map((p, i) => <ParcelRow key={i} parcel={p} />) : <p className="text-xs text-slate-600">No tax parcel at this spot.</p>}
    </div>
  );
}

function ParcelRow({ parcel }: { parcel: Parcel }) {
  const legal = [parcel.PARCEL_SUB, parcel.PARCEL_BLO && `Block ${parcel.PARCEL_BLO}`, parcel.PARCEL_LOT && `Lot ${parcel.PARCEL_LOT}`]
    .filter(Boolean)
    .join(" · ");
  const stats = [
    ["Parcel (PAN)", String(parcel.PAN)],
    ["Risk score (0-100)", parcel.risk_score == null ? "No score" : parcel.risk_score.toFixed(1)],
    ["Type", parcel.PARCEL_TYP || "—"],
    ["Legal description", legal || "—"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 bg-slate-50 p-3 text-sm">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
          <dd className="mt-1 font-semibold text-navy-deep">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
