"use client";

import { useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";
import type { LegendEntry, MapPoint, ParcelGeometry, RiskLayer } from "@/components/parcel-risk/ParcelRiskMap";

const ParcelRiskMap = dynamic(() => import("@/components/parcel-risk/ParcelRiskMap"), { ssr: false });

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
    <div className="grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1.4fr)_minmax(0,0.9fr)]">
      <FireAIDSidebar />

      <div className="min-w-0 space-y-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Parcel Fire Risk</h1>
          <p className="mt-1 text-xs text-slate-500">
            Fairbanks North Star Borough · Source: AVIRIS-NG / Sentinel-2 vegetation classification
          </p>
        </div>

        <div className="relative h-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ParcelRiskMap layers={layers} legend={legend} selected={selected} parcel={parcelShape(found)} onPick={pick} />
          {status && (
            <div role="status" className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-md">
              {status}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPin size={16} aria-hidden /> Selected spot
          </div>
          {selected && spot && typeof spot === "object" ? (
            <SpotDetails point={selected} spot={spot} />
          ) : (
            <p className="mt-2 text-sm text-slate-600">{typeof spot === "string" ? spot : "Click the map to identify the fire risk level."}</p>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4 py-6 xl:pr-6">
        <form onSubmit={search} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-900">Find a parcel by ID (PAN)</span>
            <input
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 622476"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <button
            type="submit"
            disabled={!parcelId.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
        />
      </div>
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
      <div className="rounded-xl border-l-4 bg-slate-50 p-3 text-sm text-slate-700" style={{ borderColor: color }}>
        <div className="font-semibold text-slate-900">{spot.no_data ? "Water / No Data" : spot.risk_name}</div>
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
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
          <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
