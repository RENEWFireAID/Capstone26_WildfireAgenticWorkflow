"use client";

import { useSyncExternalStore } from "react";
import { CloudSun, SlidersHorizontal } from "lucide-react";
import { AppPage, Segmented } from "@/components/ui/app";
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
    <AppPage
      eyebrow="Apps · Fire danger"
      title="Alaska Fire Risk"
      description="Rate a fire's conditions with our ML models, or check the daily fire danger forecast for any place in Alaska."
      meta={[
        "Random Forest · XGBoost · SVM classifiers",
        "Trained on Alaska fire history and weather",
        "Canadian FWI with AICC danger ratings",
        "Weather: Open-Meteo",
      ]}
      actions={
        <Segmented
          label="Fire risk tools"
          options={TABS.map(({ id, label, icon: Icon }) => ({
            value: id,
            label: (
              <span className="flex items-center gap-2">
                <Icon size={16} aria-hidden />
                {label}
              </span>
            ),
          }))}
          value={tab}
          onChange={(id) => window.location.replace(`#${id}`)}
        />
      }
    >
      {/* Both tabs stay mounted so switching keeps the classifier's inputs. */}
      <div hidden={tab !== "classifier"}>
        <FireRiskClassifier />
      </div>
      <div hidden={tab !== "forecast"}>
        <FireDangerForecast />
      </div>

      <FireRiskChat />
    </AppPage>
  );
}
