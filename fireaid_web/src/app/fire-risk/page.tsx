"use client";

import { useState } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";
import FireRiskClassifier from "@/components/fire-risk/FireRiskClassifier";

const TABS = [
  { id: "classifier", label: "Classifier" },
  { id: "forecast", label: "Forecast" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function FireRiskPage() {
  const [tab, setTab] = useState<Tab>("classifier");

  return (
    <div className="flex w-full">
      <FireAIDSidebar />

      <main className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div role="tablist" className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-4 py-2 transition ${
                  tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Both tabs stay mounted so switching keeps the classifier's inputs. */}
          <div hidden={tab !== "forecast"}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
              Fire danger forecast coming next.
            </div>
          </div>
          <div hidden={tab !== "classifier"}>
            <FireRiskClassifier />
          </div>

          <FireRiskChat />

          <div className="flex items-start gap-2 px-1 text-[11px] text-slate-400">
          </div>
        </div>
      </main>
    </div>
  );
}
