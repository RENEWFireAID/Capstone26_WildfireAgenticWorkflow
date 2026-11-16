"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Download, Search } from "lucide-react";
import { AppPage, FIELD, Notice, Panel, Placeholder, SHADOW, Stat, buttonClass } from "@/components/ui/app";
import type { GridPoint } from "@/components/data/WeatherGridMap";

const WeatherGridMap = dynamic(() => import("@/components/data/WeatherGridMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

type Station = GridPoint & { first_date: string; last_date: string; days: number };

// Column names as they appear in the files, with their units.
const COLUMNS: [string, string, string][] = [
  ["Date", "", "Day of the record (YYYY-MM-DD)."],
  ["Longitude, Latitude", "decimal degrees", "Centre of the grid cell."],
  ["Elevation", "m", "Elevation of the grid cell."],
  ["Max Temperature", "°C", "Daily maximum air temperature."],
  ["Min Temperature", "°C", "Daily minimum air temperature."],
  ["Precipitation", "mm", "Total precipitation for the day."],
  ["Wind", "m/s", "Mean wind speed."],
  ["Relative Humidity", "fraction, 0–1", "Mean relative humidity."],
  ["Solar", "MJ/m²", "Solar radiation received over the day."],
];

const day = (iso: string) => iso.slice(0, 10);
const dms = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`;

export default function WeatherDataPage() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/weather")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
        if (!j.stations.length) throw new Error("no grid points were found");
        setStations(j.stations);
        setSelected(j.stations[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const current = stations?.find((s) => s.id === selected) ?? null;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stations ?? []).filter((s) =>
      !q || s.id.includes(q) || String(s.lat).includes(q) || String(s.lon).includes(q) || String(s.elevation_m).includes(q));
  }, [stations, search]);
  const totalDays = stations?.reduce((n, s) => n + s.days, 0) ?? 0;

  return (
    <AppPage
      eyebrow="Data · Weather"
      title="Weather grid"
      description="Daily weather from 1979 to 2014 at 35 grid points across the Brooks Range and the North Slope, the weather the Alaska Fire Risk models were trained on."
      meta={["35 grid points", "68.2–70.1° N, 147.8–149.1° W", "Daily, Jan 1979 – Jul 2014", "Temperature, precipitation, wind, humidity, solar"]}
      actions={
        <Link href="/fire-risk" className={buttonClass("secondary")}>
          See Alaska Fire Risk <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      {error && (
        <Notice tone="error">
          The weather grid could not be loaded: {error}. If this says no grid points were found, the data still needs to
          be imported on the server (FireMCP/scripts/import_weather.py).
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`min-w-0 bg-white ${SHADOW}`}>
          <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
            Click a grid point to choose it. Each is one cell of a gridded weather product, not a weather station.
          </div>
          <div className="h-[460px]">
            {stations ? (
              <WeatherGridMap points={stations} selected={selected} onSelect={setSelected} />
            ) : (
              <div className="h-full w-full animate-pulse bg-slate-100" />
            )}
          </div>
        </section>

        <Panel accent title="Selected grid point" className="self-start">
          {current ? (
            <div className="space-y-4">
              <p className="font-mono text-2xl font-semibold text-navy-deep">{current.id}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Stat label="Latitude" value={dms(current.lat, "N", "S")} />
                <Stat label="Longitude" value={dms(current.lon, "E", "W")} />
                <Stat label="Elevation" value={`${current.elevation_m ?? "—"} m`} />
                <Stat label="Days" value={current.days.toLocaleString("en-US")} />
              </dl>
              <p className="text-sm text-slate-600">{day(current.first_date)} to {day(current.last_date)}</p>
              <a href={`/api/weather?station=${current.id}`} className={buttonClass("primary", "w-full py-2.5")}>
                <Download size={15} aria-hidden="true" /> Download CSV
              </a>
            </div>
          ) : (
            <Placeholder height="py-8">{error ? "No grid points loaded." : "Loading grid points…"}</Placeholder>
          )}
        </Panel>
      </div>

      <Panel title="All grid points"
        subtitle={stations ? `${stations.length} points · ${totalDays.toLocaleString("en-US")} daily records in all` : undefined}
        aside={
          <label className="relative block w-56">
            <span className="sr-only">Filter grid points</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input className={`${FIELD} pl-8`} placeholder="Filter by id, lat, lon…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        }>
        {!stations ? (
          <Placeholder>{error ? "No grid points loaded." : "Loading…"}</Placeholder>
        ) : rows.length === 0 ? (
          <Placeholder>No grid points match “{search}”.</Placeholder>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-navy text-left font-mono text-xs uppercase tracking-wide text-slate-600">
                  <th className="py-2 pr-4 font-semibold">Grid point</th>
                  <th className="py-2 pr-4 font-semibold">Latitude</th>
                  <th className="py-2 pr-4 font-semibold">Longitude</th>
                  <th className="py-2 pr-4 text-right font-semibold">Elevation</th>
                  <th className="py-2 pr-4 font-semibold">Period</th>
                  <th className="py-2 text-right font-semibold"><span className="sr-only">Download</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => setSelected(s.id)}
                    className={`cursor-pointer border-b border-slate-200 transition ${s.id === selected ? "bg-navy-soft" : "hover:bg-slate-50"}`}>
                    <td className="py-2 pr-4 font-mono font-semibold text-navy-deep">{s.id}</td>
                    <td className="py-2 pr-4 font-mono tabular">{s.lat.toFixed(3)}</td>
                    <td className="py-2 pr-4 font-mono tabular">{s.lon.toFixed(3)}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular">{s.elevation_m ?? "—"} m</td>
                    <td className="py-2 pr-4 font-mono tabular text-slate-600">{day(s.first_date)} – {day(s.last_date)}</td>
                    <td className="py-2 text-right">
                      <a href={`/api/weather?station=${s.id}`} onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase tracking-wide text-navy underline-offset-2 hover:underline">
                        <Download size={12} aria-hidden="true" /> CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Columns" subtitle="Every file has the same columns, one row per day.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-navy text-left font-mono text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-4 font-semibold">Column</th>
                <th className="py-2 pr-4 font-semibold">Unit</th>
                <th className="py-2 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map(([name, unit, meaning]) => (
                <tr key={name} className="border-b border-slate-200 align-top">
                  <td className="py-2 pr-4 font-mono text-[13px] font-semibold text-navy-deep">{name}</td>
                  <td className="py-2 pr-4 font-mono text-[13px] text-slate-600">{unit || "—"}</td>
                  <td className="py-2 text-slate-700">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppPage>
  );
}
