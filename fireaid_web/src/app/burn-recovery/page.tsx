"use client";

import { useState } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";
import { FIRES, pct, useBurnRecovery, type FireName, type ModelKey, type Overview } from "@/components/burn-recovery/data";
import { GreennessTab, ImageryTab, ModelsTab, ValidationTab } from "@/components/burn-recovery/tabs";
import { LoadError, Loading, Metrics, Note } from "@/components/burn-recovery/ui";

const TABS = ["Imagery", "Greenness", "Models", "Validation"] as const;
type Tab = (typeof TABS)[number];

export default function BurnRecoveryPage() {
  const [fire, setFire] = useState<FireName>("Shovel Creek");
  const [period, setPeriod] = useState("2020");
  const [model, setModel] = useState<ModelKey>("full");
  const [tab, setTab] = useState<Tab>("Imagery");
  // Panels mount on first visit and then stay mounted, so selections survive tab changes.
  const [visited, setVisited] = useState<Set<Tab>>(new Set(["Imagery"]));
  const { data: overview, error } = useBurnRecovery<Overview>({ kind: "overview" });
  const summary = overview?.fires[fire];

  const open = (t: Tab) => {
    setTab(t);
    setVisited((v) => new Set(v).add(t));
  };

  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="Apps · Fire effects research"
          title="Burn Severity Recovery"
          description="Burn-related spectral change and post-fire greenness in three 2019 Alaska fires, and whether a model trained on two fires can predict recovery on the third."
          meta={["NASA HLS satellite imagery", "MTBS and field CBI checks", "Observations 2018–2024"]}
        />

        <div className="flex-1 space-y-5 px-6 py-6 md:px-10">
          <div className="flex max-w-6xl flex-wrap items-end justify-between gap-4">
            <div role="radiogroup" aria-label="Fire" className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
              {FIRES.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={fire === f} onClick={() => setFire(f)}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${fire === f ? "bg-navy text-white" : "text-slate-600 hover:text-navy"}`}>
                  {f}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Research prototype by Muhammad Saffiullah (UAA), served from saved, verified notebook results.</p>
          </div>

          <div className="max-w-6xl space-y-5">
            {error ? (
              <LoadError message={error} />
            ) : !overview || !summary ? (
              <Loading label="Verifying and loading the saved study…" />
            ) : (
              <>
                <Metrics items={[
                  ["Sampled locations", summary.sampled_locations.toLocaleString("en-US")],
                  ["Complete input coverage", pct(summary.complete_input_coverage)],
                  ["Recovery period", "2020–2024"],
                ]} />

                <div role="tablist" aria-label="Views" className="flex gap-1 overflow-x-auto border-b border-slate-200">
                  {TABS.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => open(t)}
                      className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                        tab === t ? "border-navy text-navy" : "border-transparent text-slate-500 hover:text-navy"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>

                <div role="tabpanel" hidden={tab !== "Imagery"}>{visited.has("Imagery") && <ImageryTab fire={fire} />}</div>
                <div role="tabpanel" hidden={tab !== "Greenness"}>
                  {visited.has("Greenness") && <GreennessTab fire={fire} period={period} model={model} />}
                </div>
                <div role="tabpanel" hidden={tab !== "Models"}>
                  {visited.has("Models") && <ModelsTab fire={fire} period={period} setPeriod={setPeriod} model={model} setModel={setModel} />}
                </div>
                <div role="tabpanel" hidden={tab !== "Validation"}>
                  {visited.has("Validation") && <ValidationTab fire={fire} overview={summary} runCompleted={overview.run_completed_utc} />}
                </div>
              </>
            )}
          </div>

          {!overview && !error && (
            <Note>The first visit after a restart takes a few seconds while FireMCP checks every saved file against its fingerprint.</Note>
          )}
        </div>
      </main>
    </div>
  );
}
