"use client";

import { useState } from "react";
import { AppPage, Panel, SHADOW, Segmented } from "@/components/ui/app";
import { FIRES, pct, useBurnRecovery, type FireName, type ModelKey, type Overview } from "@/components/burn-recovery/data";
import { GreennessTab, ImageryTab, ModelsTab, ValidationTab } from "@/components/burn-recovery/tabs";
import { LoadError, Loading, Metrics, Note } from "@/components/burn-recovery/ui";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";

const TABS = ["Imagery", "Greenness", "Models", "Validation"] as const;
type Tab = (typeof TABS)[number];

const CHAT_SUGGESTIONS = [
  "How fast did the most severely burned areas of Swan Lake green up?",
  "How well do the models predict recovery on Shovel Creek?",
  "Chart mean NDVI by severity group for Swan Lake.",
];

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
    <AppPage
      eyebrow="Apps · Fire effects research"
      title="Burn Severity Recovery"
      description="Burn-related spectral change and post-fire greenness in three 2019 Alaska fires, and whether a model trained on two fires can predict recovery on the third."
      meta={["NASA HLS satellite imagery", "MTBS and field CBI checks", "Observations 2018–2024"]}
    >
      <Panel accent>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Segmented options={FIRES} value={fire} onChange={setFire} label="Fire" />
          <p className="text-xs text-slate-500">Research prototype by Muhammad Saffiullah (UAA), served from saved, verified notebook results.</p>
        </div>
        {summary && (
          <div className="mt-4">
            <Metrics items={[
              ["Sampled locations", summary.sampled_locations.toLocaleString("en-US")],
              ["Complete input coverage", pct(summary.complete_input_coverage)],
              ["Recovery period", "2020–2024"],
            ]} />
          </div>
        )}
      </Panel>

      {error ? (
        <LoadError message={error} />
      ) : !overview || !summary ? (
        <Loading label="Verifying and loading the saved study…" />
      ) : (
        <section className={`min-w-0 bg-white ${SHADOW}`}>
          <div role="tablist" aria-label="Views" className="flex overflow-x-auto border-b border-slate-200 px-2">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => open(t)}
                className={`-mb-px whitespace-nowrap border-b-[3px] px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wide transition ${
                  tab === t ? "border-navy text-navy-deep" : "border-transparent text-slate-500 hover:text-navy"
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-5">
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
          </div>
        </section>
      )}

      <FireRiskChat
        endpoint="/api/burn-recovery/chat"
        title="Ask about burn severity and recovery"
        subtitle="The study's saved results for Shovel Creek, Swan Lake and Nugget Creek"
        suggestions={CHAT_SUGGESTIONS}
        chartSource="the Burn Severity Recovery study (M. Saffiullah, UAA)"
        modelFeature="fireHistory"
      />

      {!overview && !error && (
        <Note>The first visit after a restart takes a few seconds while FireMCP checks every saved file against its fingerprint.</Note>
      )}
    </AppPage>
  );
}
