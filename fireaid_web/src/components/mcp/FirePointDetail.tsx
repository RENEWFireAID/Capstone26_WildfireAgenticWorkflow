"use client";

import VegetationRecoveryPanel from "@/components/mcp/VegetationRecoveryPanel";

type AnyObj = Record<string, any>;

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

export default function FirePointDetail({
  row,
  onClose,
}: {
  row: AnyObj;
  onClose: () => void;
}) {
  const lat = toNum(row.LATITUDE ?? row.latitude ?? row.lat);
  const lon = toNum(row.LONGITUDE ?? row.longitude ?? row.lon ?? row.lng);
  const fireYear = toNum(row.year ?? row.FIRESEASON);
  const acres = toNum(row.ESTIMATEDTOTALACRES ?? row.acres);
  const name = String(row.NAME ?? row.INCIDENT_NAME ?? row.name ?? "Unnamed fire");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-slate-400">
              Fire Point
            </div>
            <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
          </div>
          <button
            className="shrink-0 text-[11px] text-slate-400 hover:text-slate-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {fireYear != null && <Row label="Year" value={String(fireYear)} />}
          {acres != null && (
            <Row label="Acres" value={acres.toLocaleString()} />
          )}
          {row.GENERALCAUSE && (
            <Row label="Cause" value={String(row.GENERALCAUSE)} />
          )}
          {row.PRIMARYFUELTYPE && (
            <Row label="Fuel type" value={String(row.PRIMARYFUELTYPE)} />
          )}
          {row.PRESCRIBEDFIRE && (
            <Row
              label="Prescribed"
              value={row.PRESCRIBEDFIRE === "Y" ? "Yes" : "No"}
            />
          )}
          {lat != null && lon != null && (
            <Row label="Location" value={`${lat.toFixed(4)}, ${lon.toFixed(4)}`} />
          )}
        </div>
      </div>

      {lat != null && lon != null ? (
        <VegetationRecoveryPanel
          // Remount on a new point so the query restarts cleanly.
          key={`${lat},${lon}`}
          lat={lat}
          lon={lon}
          fireYear={fireYear}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400 shadow-sm">
          This record has no coordinates, so vegetation trends are unavailable.
        </div>
      )}
    </div>
  );
}
