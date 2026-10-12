"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";

import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import SelectedPointCard from "@/components/forest-trends/SelectedPointCard";
import VegetationRecoveryPanel from "@/components/forest-trends/VegetationRecoveryPanel";
import type { PickedPoint } from "@/components/forest-trends/TrendPickerMap";

const TrendPickerMap = dynamic(
  () => import("@/components/forest-trends/TrendPickerMap"),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
  }
);

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export default function ForestTrendsPage() {
  const [picked, setPicked] = useState<PickedPoint | null>(null);

  // Stable identity so the map's layer effects do not re-run on every render.
  const handlePick = useCallback((p: PickedPoint) => setPicked(p), []);

  const fireYear = picked?.fire
    ? toNum(picked.fire.year ?? picked.fire.FIRESEASON)
    : null;

  return (
    <div className="flex w-full min-h-screen">
      <FireAIDSidebar />

      <main className="flex-1 flex flex-col">
        <div className="bg-slate-50 px-12 py-8 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
            FireAID · Apps
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Forest Trends
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Post-fire vegetation recovery from annual summer Landsat composites
          </p>
        </div>

        <div className="flex-1 bg-slate-50 px-12 py-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* Map */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-[540px]">
                <TrendPickerMap picked={picked} onPick={handlePick} />
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {picked ? (
                <>
                  <SelectedPointCard
                    lat={picked.lat}
                    lon={picked.lon}
                    fire={picked.fire}
                    onClear={() => setPicked(null)}
                  />
                  <VegetationRecoveryPanel
                    // Remount on a new point so the query restarts cleanly.
                    key={`${picked.lat},${picked.lon}`}
                    lat={picked.lat}
                    lon={picked.lon}
                    fireYear={fireYear}
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                  Click a point on the map to load its vegetation time series.
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-slate-400">
            NDVI, NBR and NDMI are June–August medians from cloud-masked Landsat
            5/7/8/9 surface reflectance, with TerraClimate summer climate
            variables. Earth Engine queries are slow on first request and cached
            afterwards.
          </p>
        </div>
      </main>
    </div>
  );
}
