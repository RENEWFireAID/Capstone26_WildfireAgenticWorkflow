"use client";

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

export default function SelectedPointCard({
  lat,
  lon,
  fire,
  onClear,
}: {
  lat: number;
  lon: number;
  /** Set when a fire marker was clicked; absent for a bare map click. */
  fire?: AnyObj | null;
  onClear: () => void;
}) {
  const fireYear = fire ? toNum(fire.year ?? fire.FIRESEASON) : null;
  const acres = fire ? toNum(fire.ESTIMATEDTOTALACRES ?? fire.acres) : null;
  const name = fire
    ? String(fire.NAME ?? fire.INCIDENT_NAME ?? fire.name ?? "Unnamed fire")
    : "Custom location";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            {fire ? "Fire Point" : "Map Point"}
          </div>
          <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
        </div>
        <button
          className="shrink-0 text-[11px] text-slate-400 hover:text-slate-600"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        <Row label="Location" value={`${lat.toFixed(4)}, ${lon.toFixed(4)}`} />
        {fireYear != null && <Row label="Fire year" value={String(fireYear)} />}
        {acres != null && <Row label="Acres" value={acres.toLocaleString()} />}
        {fire?.GENERALCAUSE && (
          <Row label="Cause" value={String(fire.GENERALCAUSE)} />
        )}
        {fire?.PRIMARYFUELTYPE && (
          <Row label="Fuel type" value={String(fire.PRIMARYFUELTYPE)} />
        )}
        {fire?.PRESCRIBEDFIRE && (
          <Row
            label="Prescribed"
            value={fire.PRESCRIBEDFIRE === "Y" ? "Yes" : "No"}
          />
        )}
      </div>

      {!fire && (
        <div className="mt-3 text-[11px] leading-relaxed text-slate-400">
          No fire record at this point, so the chart has no fire-year marker.
        </div>
      )}
    </div>
  );
}
