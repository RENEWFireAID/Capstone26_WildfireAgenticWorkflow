"use client";

import dynamic from "next/dynamic";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";

const PredictionFireMap = dynamic(
  () => import("@/components/map/PredictionFireMap"),
  { ssr: false, loading: () => <div className="h-[500px] animate-pulse rounded-xl bg-slate-100" /> }
);

export default function WildfirePredictionPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="Apps · Machine learning"
          title="Wildfire Prediction"
          description="Fire probability for each grid cell around Fairbanks, from an XGBoost model trained on Alaska fire seasons 2000–2007."
          meta={["XGBoost classifier", "Fairbanks region grid", "Fire seasons 2000–2007"]}
        />

        <div className="flex-1 px-6 py-6 md:px-10">
          <div className="max-w-5xl rounded-xl border border-slate-200 bg-white p-5">
            <PredictionFireMap />
          </div>
          <p className="mt-4 max-w-5xl text-xs leading-relaxed text-slate-500">
            Choose a year and month, select <span className="font-semibold text-slate-700">Load Map</span>, then click anywhere in the Fairbanks region to see the fire risk for that grid cell.
          </p>
        </div>
      </main>
    </div>
  );
}
