"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";
import type { LightningData } from "@/components/lightning/LightningMap";

const LightningMap = dynamic(() => import("@/components/lightning/LightningMap"), { ssr: false });

// The card style the other app pages use.
const CARD = "bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]";
const FIELD = "h-9 w-full border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-navy";

// The first and last days of the lightning record.
const MIN_DATE = "1986-05-26";
const MAX_DATE = "2012-12-31";
const EMBEDDING_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

const SUGGESTIONS = [
  "Which year had the most lightning strikes?",
  "What were the largest fires of 2004?",
  "How many lightning strikes were there in July 2005?",
];

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function getJson(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.ok === false) throw new Error(data?.error ?? "Request failed");
  return data;
}

export default function LightningPage() {
  // One summer month, so the first load is quick; the full record is ~1.9 million strikes.
  const [start, setStart] = useState("2004-07-01");
  const [end, setEnd] = useState("2004-07-31");
  const [years, setYears] = useState<number[]>([2023]);
  const [data, setData] = useState<LightningData | null>(null);
  const [embeddingUrl, setEmbeddingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const badRange = start > end;

  useEffect(() => {
    if (badRange || !start || !end) return;
    let current = true;
    setStatus("Loading lightning strikes and fire points…");
    getJson(`/api/lightning?start=${start}&end=${end}`)
      .then((d) => current && (setData(d), setStatus(null)))
      .catch((e) => current && setStatus(errorText(e)));
    return () => void (current = false);
  }, [start, end, badRange]);

  useEffect(() => {
    setLayerError(null);
    if (!years.length) return setEmbeddingUrl(null);
    let current = true;
    getJson(`/api/lightning?years=${years.join(",")}`)
      .then((d) => current && setEmbeddingUrl(d.url))
      .catch((e) => current && setLayerError(`Failed to load GEE layer: ${errorText(e)}`));
    return () => void (current = false);
  }, [years]);

  const toggleYear = (y: number) => setYears((ys) => (ys.includes(y) ? ys.filter((v) => v !== y) : [...ys, y].sort()));

  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="Apps · Lightning history"
          title="Lightning and Fire History"
          description="Alaska's lightning strikes and fire records over the same dates. Pick a date range to see where lightning struck and which fires were discovered."
          meta={["AICC lightning, 1986–2012", "AICC fire history points", "Google satellite embeddings"]}
        />

        <div className="grid flex-1 grid-cols-1 content-start gap-5 bg-slate-50 px-6 py-6 md:px-10">
          <div className="min-w-0 space-y-5">
            <section className={`grid gap-4 border-t-4 border-gold p-5 sm:grid-cols-2 ${CARD}`}>
              <h2 className="text-xl font-bold text-navy-deep sm:col-span-2">Control Panel</h2>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">Start Date</span>
                <input type="date" value={start} min={MIN_DATE} max={MAX_DATE} onChange={(e) => setStart(e.target.value)} className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">End Date</span>
                <input type="date" value={end} min={MIN_DATE} max={MAX_DATE} onChange={(e) => setEnd(e.target.value)} className={FIELD} />
              </label>
              {badRange && <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">Error: Start date must be before or equal to the end date.</p>}
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-sm font-medium text-slate-600">Embedding Years</legend>
                <div className="flex flex-wrap gap-2">
                  {EMBEDDING_YEARS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      aria-pressed={years.includes(y)}
                      onClick={() => toggleYear(y)}
                      className={`px-3 py-1.5 font-mono text-sm font-semibold transition ${years.includes(y) ? "bg-gold text-navy-deep" : "border border-slate-300 bg-white text-slate-600 hover:border-navy"}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </fieldset>
              {layerError && <p role="alert" className="text-sm font-medium text-amber-700 sm:col-span-2">{layerError}</p>}
            </section>

            <div className={`relative h-[700px] min-w-0 overflow-hidden ${CARD}`}>
              <LightningMap data={badRange ? null : data} embeddingUrl={embeddingUrl} embeddingLabel={years.join(", ")} />
              {status && (
                <div role="status" className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 bg-white px-4 py-2 text-sm text-slate-700 shadow-md">
                  {status}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <FireRiskChat
              endpoint="/api/lightning/chat"
              title="Ask about lightning and fires"
              subtitle="Lightning strikes and fire records"
              suggestions={SUGGESTIONS}
              chartSource="AICC lightning and fire history data"
              modelFeature="fireHistory"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
