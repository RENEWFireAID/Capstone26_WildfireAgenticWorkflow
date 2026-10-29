"use client";

import { useSyncExternalStore } from "react";
import { CloudSun, SlidersHorizontal } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";
import FireRiskClassifier from "@/components/fire-risk/FireRiskClassifier";
import FireDangerForecast from "@/components/fire-risk/FireDangerForecast";

const TABS = [
  { id: "classifier", label: "Classifier", icon: SlidersHorizontal },
  { id: "forecast", label: "Forecast", icon: CloudSun },
] as const;

type Tab = (typeof TABS)[number]["id"];

// The open tab lives in the URL hash, so reloads and shared links keep it.
const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const tabFromHash = (): Tab => (window.location.hash === "#forecast" ? "forecast" : "classifier");

export default function FireRiskPage() {
  const tab = useSyncExternalStore(subscribe, tabFromHash, () => "classifier" as Tab);

  return (
    <div className="flex w-full">
      <FireAIDSidebar />

      <main className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Alaska Fire Risk</h1>
              <p className="mt-1 text-sm text-slate-600">
                Rate a fire&apos;s conditions with our ML models, or check the daily fire danger forecast.
              </p>
            </div>
            <div role="tablist" aria-label="Fire risk tools" className="flex gap-1 rounded-xl bg-slate-200/70 p-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => window.location.replace(`#${id}`)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
                    tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </header>

          {/* Both tabs stay mounted so switching keeps the classifier's inputs. */}
          <div hidden={tab !== "classifier"}>
            <FireRiskClassifier />
          </div>
          <div hidden={tab !== "forecast"}>
            <FireDangerForecast />
          </div>

          <FireRiskChat />
        </div>
      </main>
    </div>
  );
}
