"use client";

import dynamic from "next/dynamic";
import { TrendingUp } from "lucide-react";

const PredictionFireMap = dynamic(
  () => import("@/components/map/PredictionFireMap"),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-2xl bg-slate-100" /> }
);

export default function WildfirePredictionPage() {
  return (
    <div className="w-full min-h-screen bg-white flex flex-col items-center px-6 py-12">
      {/* Header */}
      <div className="w-full max-w-4xl mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500 text-white mb-4">
          <TrendingUp size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Wildfire Prediction</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
          Explore per-grid-cell fire probability across the Fairbanks region, powered by an XGBoost ML model trained on Alaska fire seasons 2000–2007.
        </p>
      </div>

      {/* Map card */}
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <PredictionFireMap />
      </div>

      {/* Footer note */}
      <p className="mt-6 text-xs text-slate-400 text-center max-w-xl">
        Select a year and month, click <span className="font-semibold text-slate-500">Load Map</span>, then click anywhere within the Fairbanks region to reveal the fire risk for that grid cell.
      </p>
    </div>
  );
}
