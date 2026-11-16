"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, FileCode2 } from "lucide-react";
import { AppPage, FIELD, Field, Notice, Panel, Segmented, Stat, buttonClass } from "@/components/ui/app";

type Summary = { records: number; firstYear: number | null; lastYear: number | null; totalAcres: number; columns: number };

const FIRST_YEAR = 1939;
const LAST_YEAR = 2024;

// Definitions are the publisher's own, from the FGDC metadata (BLM AFS, 2025).
const FIELDS: [string, string][] = [
  ["ID", "AICC identification number, unique. Joins fire perimeters (FIREID) to these fire points."],
  ["NAME", "The name assigned to the incident."],
  ["FIRESEASON", "The year in which the fire occurred (YYYY)."],
  ["LATITUDE, LONGITUDE", "Where the fire started, in decimal degrees. May change as more becomes known about the fire."],
  ["DISCOVERYDATETIME", "Date and time the fire was discovered (MM/DD/YYYY, 12-hour time)."],
  ["OUTDATE", "Date the fire was classified as out."],
  ["ESTIMATEDTOTALACRES", "Estimated total acres. The field to use when totalling acres."],
  ["GENERALCAUSE, SPECIFICCAUSE", "General and specific cause of the fire, if known."],
  ["FIRECAUSE", "Cause of fire (e.g. Natural, Human)."],
  ["PRESCRIBEDFIRE", "Whether the fire was a prescribed fire (a planned ignition), Y or N."],
  ["FALSEALARM", "Whether the report was classified as a false alarm, Y or N."],
  ["MGMTORGID", "Agency with primary protection responsibility at the point of origin."],
  ["MGMTOPTIONID", "Fire management option at the time of ignition (Critical, Full, Modified, Limited)."],
  ["PRIMARYFUELTYPE", "Primary fuel type, if known."],
  ["STRUCTURESBURNED", "Number of structures burned, if known."],
  ["ESTIMATEDTOTALCOST", "Estimated total cost, in US dollars."],
];

const fmtAcres = (a: number) =>
  a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : Math.round(a).toLocaleString("en-US");

export default function FireHistoryDataPage() {
  const [scope, setScope] = useState<"all" | "range">("all");
  const [from, setFrom] = useState(2015);
  const [to, setTo] = useState(LAST_YEAR);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = scope === "all" || (from >= FIRST_YEAR && to <= LAST_YEAR && from <= to);
  const query = scope === "range" ? `from=${from}&to=${to}` : "";

  useEffect(() => {
    if (!valid) return;
    const c = new AbortController();
    setSummary(null);
    setError(null);
    fetch(`/api/fire-history?${query}`, { signal: c.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
        setSummary(j);
      })
      .catch((e) => { if (e?.name !== "AbortError") setError(e.message); });
    return () => c.abort();
  }, [query, valid]);

  return (
    <AppPage
      eyebrow="Data · Fire records"
      title="Fire history"
      description="Every reported wildland fire in Alaska since 1939: where it started, when, how large it grew and what caused it. This is the copy FireAID's apps and assistant read."
      meta={["BLM Alaska Fire Service", "Alaska Fire Location Points", `${FIRST_YEAR}–${LAST_YEAR}`, "Metadata published Jan 29, 2025"]}
      actions={
        <Link href="/mcp-tools" className={buttonClass("secondary")}>
          Explore on the map <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <Panel accent title="Download records" subtitle="One row per fire, with all 78 source columns, as CSV.">
            <div className="space-y-4">
              <Notice tone="warning">
                <b className="font-semibold">About 2,000 fires are missing from this copy.</b> An error when the data was
                loaded dropped many records from 2001–2003 and 2009–2010, including every fire from 2002. Totals for those
                years are too low until the data is reloaded. The publisher&apos;s copy at fire.ak.blm.gov does not have
                this problem.
              </Notice>
              <Segmented<"all" | "range"> label="Years" value={scope} onChange={setScope}
                options={[{ value: "all", label: "All years" }, { value: "range", label: "Choose years" }]} />
              {scope === "range" && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From">
                    <input type="number" min={FIRST_YEAR} max={LAST_YEAR} value={from} className={FIELD}
                      onChange={(e) => setFrom(Number(e.target.value))} />
                  </Field>
                  <Field label="To">
                    <input type="number" min={FIRST_YEAR} max={LAST_YEAR} value={to} className={FIELD}
                      onChange={(e) => setTo(Number(e.target.value))} />
                  </Field>
                </div>
              )}
              {!valid && <Notice tone="warning">Choose years between {FIRST_YEAR} and {LAST_YEAR}, with From no later than To.</Notice>}
              {error && <Notice tone="error">{error}</Notice>}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Stat label="Records" value={summary ? summary.records.toLocaleString("en-US") : "…"} />
                <Stat label="Years" value={summary?.firstYear ? `${summary.firstYear}–${summary.lastYear}` : "…"} />
                <Stat label="Total acres" value={summary ? fmtAcres(summary.totalAcres) : "…"} />
                <Stat label="Columns" value={summary ? summary.columns : "…"} />
              </dl>

              <div className="flex flex-wrap gap-2">
                <a href={valid ? `/api/fire-history?download=1&${query}` : undefined} aria-disabled={!valid}
                  className={buttonClass("primary", valid ? "" : "pointer-events-none opacity-40")}>
                  <Download size={15} aria-hidden="true" /> Download CSV
                </a>
                <a href="/fire-history/AlaskaFireHistory_LocationPoints_FGDG_metadata.xml" download className={buttonClass("secondary")}>
                  <FileCode2 size={15} aria-hidden="true" /> Metadata (FGDC XML)
                </a>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Generated from FireAID&apos;s database when you click, so it always matches what the apps show. The full file is about 13 MB.
              </p>
            </div>
          </Panel>

          <Panel title="About the data">
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <p>
                Alaska Fire History Points is a time series of wildland fires reported each year across Alaska, ignited
                naturally (for example by lightning) or by people, including prescribed fires. It is published by the
                Bureau of Land Management&apos;s Alaska Fire Service.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>There is no lower size limit, so reported false alarms are included. Filter on FALSEALARM to drop them.</li>
                <li>Point accuracy varies, because latitude and longitude were recorded with different numbers of digits.</li>
                <li>Many fire reports from 1961 to 1968 are missing.</li>
                <li>The dataset includes some, but not all, historical fires, and is subject to revision.</li>
              </ul>
              <p>
                The publisher&apos;s own copy, with fire perimeters, is at{" "}
                <a className="font-semibold text-navy underline underline-offset-2" href="https://fire.ak.blm.gov/predsvcs/maps.php" target="_blank" rel="noopener noreferrer">
                  fire.ak.blm.gov
                </a>.
              </p>
            </div>
          </Panel>
        </div>

        <Panel title="Field reference" subtitle="The columns most analyses use, as the publisher defines them. The metadata file defines all 78.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-navy text-left">
                  <th className="py-2 pr-4 font-mono text-xs font-semibold uppercase tracking-wide text-slate-600">Column</th>
                  <th className="py-2 font-mono text-xs font-semibold uppercase tracking-wide text-slate-600">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(([name, meaning]) => (
                  <tr key={name} className="border-b border-slate-200 align-top">
                    <td className="py-2 pr-4 font-mono text-[13px] font-semibold text-navy-deep">{name}</td>
                    <td className="py-2 leading-relaxed text-slate-700">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
