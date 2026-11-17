"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { FIELD, Field, Notice, Panel, Placeholder } from "@/components/ui/app";
import {
  ASPECT_SCORES,
  CAUSE_SCORES,
  DEFAULT_FIRE,
  ELEVATION_SCORES,
  MODELS,
  MONTH_NAMES,
  SCORE_LIMITS,
  SLOPE_SCORES,
  WEATHER_FEATURES,
  deriveScores,
  riskBand,
  totalScore,
  type FireInputs,
  type ModelId,
  type ScoreName,
  type WeatherInputs,
} from "@/lib/fireRiskScores";

type Result = {
  category: string;
  confidence: number;
  probabilities: Record<string, number>;
  defaulted: Record<string, number>;
};

// Every field is kept as the text the user typed so number inputs can be
// cleared mid-edit; toInputs() parses it. Blank weather fields use the
// month's typical value.
type Form = Record<keyof FireInputs | keyof WeatherInputs, string>;

const DEFAULT_FORM = {
  ...Object.fromEntries(Object.entries(DEFAULT_FIRE).map(([k, v]) => [k, String(v)])),
  maxTemp: "",
  minTemp: "",
  precip: "",
  wind: "",
} as Form;

const SCORE_LABELS: Record<ScoreName, string> = {
  IGNITION_WEATHER_SCORE: "Ignition (cause)",
  SEASONAL_SCORE: "Seasonal (month)",
  ASPECT_SCORE: "Aspect",
  ELEVATION_SCORE: "Elevation",
  SLOPE_WIND_SCORE: "Slope-wind",
  SPREAD_RATE_SCORE: "Spread rate",
};

const WEATHER_FIELDS: { key: keyof WeatherInputs; label: string; unit: string; step: number }[] = [
  { key: "maxTemp", label: "Max temp", unit: "°C, avg daily high, past 7 days", step: 0.5 },
  { key: "minTemp", label: "Min temp", unit: "°C, avg daily low, past 7 days", step: 0.5 },
  { key: "precip", label: "Precipitation", unit: "mm, total, past 7 days", step: 1 },
  { key: "wind", label: "Wind", unit: "m/s, max, past 7 days", step: 0.5 },
];

// Encodes the predicted risk level, so it keeps its hazard colours.
const CATEGORY_STYLE: Record<string, string> = {
  High: "bg-red-50 border-red-200 text-red-700",
  Moderate: "bg-orange-50 border-orange-200 text-orange-700",
  Low: "bg-yellow-50 border-yellow-200 text-yellow-700",
  "Very Low": "bg-green-50 border-green-200 text-green-700",
};


function toInputs(form: Form): { fire: FireInputs; weather: WeatherInputs } | null {
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const fire: FireInputs = {
    slope: form.slope,
    aspect: form.aspect,
    elevation: form.elevation,
    cause: form.cause,
    month: num(form.month),
  };
  const weather: WeatherInputs = {};
  for (const key of Object.keys(WEATHER_FEATURES) as (keyof WeatherInputs)[]) {
    if (form[key].trim() === "") continue;
    weather[key] = num(form[key]);
  }
  if (![fire.month, ...Object.values(weather)].every(Number.isFinite)) return null;
  return { fire, weather };
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="space-y-3">{children}</div>
    </Panel>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
function typicalWeather(result: Result | null, key: keyof WeatherInputs): string {
  const value = result?.defaulted?.[WEATHER_FEATURES[key]];
  return value === undefined ? "typical for month" : `typical: ${value.toFixed(1)}`;
}

const optionsOf = (table: Record<string, number>, suffix = "") =>
  Object.keys(table).map((k) => ({ value: k, label: k === "Unknown" ? k : `${k}${suffix}` }));

export default function FireRiskClassifier() {
  const [model, setModel] = useState<ModelId>("random_forest");
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const inputs = useMemo(() => toInputs(form), [form]);
  const derived = useMemo(() => (inputs ? deriveScores(inputs.fire) : null), [inputs]);

  const spread = result?.defaulted?.SPREAD_RATE_SCORE;
  const scores: Partial<Record<ScoreName, number>> | null = derived && { ...derived, SPREAD_RATE_SCORE: spread };
  const total = derived && spread !== undefined ? totalScore({ ...derived, SPREAD_RATE_SCORE: spread }) : null;

  // Re-predict 400 ms after the last edit; a newer edit cancels the older request.
  useEffect(() => {
    if (!inputs) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/fire-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, ...inputs }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setResult(data);
        setError(null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Prediction failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [model, inputs]);

  return (
    <div className="space-y-4">
      <Panel accent title="Fire Risk Classifier" subtitle="Different models trained on thousands of Alaskan Fires">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <Select
            label="Model"
            value={model}
            options={MODELS.map((m) => ({ value: m.id, label: m.label }))}
            onChange={(v) => setModel(v as ModelId)}
          />

          <div className="min-w-0">
            {!inputs ? (
              <Placeholder height="py-4">Fill in every field to see a prediction.</Placeholder>
            ) : error ? (
              <Notice tone="error">{error}</Notice>
            ) : result ? (
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className={`border px-4 py-3 ${
                    CATEGORY_STYLE[result.category] ?? "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-2xl font-semibold uppercase tracking-wide">
                    {result.category}
                    {loading && <RefreshCw size={14} className="animate-spin opacity-60" />}
                  </div>
                  <div className="font-mono text-xs opacity-80">
                    confidence {(result.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  {Object.entries(result.probabilities)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, p]) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-xs text-slate-600">{label}</span>
                        <div className="h-2 flex-1 overflow-hidden bg-slate-100">
                          <div className="h-full bg-navy" style={{ width: `${p * 100}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-slate-500">
                          {(p * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <Placeholder height="py-4">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Predicting...
                </span>
              </Placeholder>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Column title="Derived inputs">
          {(Object.keys(SCORE_LABELS) as ScoreName[]).map((name) => (
            <div key={name} className="flex items-baseline justify-between gap-3 border-b border-slate-200 px-1 py-2">
              <span className="text-xs text-slate-600">
                {SCORE_LABELS[name]}
                {name === "SPREAD_RATE_SCORE" && <span className="text-slate-500"> (typical for month)</span>}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-navy-deep">
                {scores?.[name] ?? "-"}
                <span className="font-normal text-slate-500"> / {SCORE_LIMITS[name]}</span>
              </span>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-l-4 border-navy bg-navy-soft px-3 py-2">
            <span className="text-xs font-semibold text-navy-deep">Total</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-navy-deep">
              {total ?? "-"}
              <span className="font-normal text-navy"> / 100</span>
              {total !== null && (
                <span className="ml-2 text-xs font-normal text-navy">{riskBand(total)} band</span>
              )}
            </span>
          </div>
        </Column>

        <Column title="Weather data inputs">
          {WEATHER_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.unit}>
              <input
                type="number"
                step={f.step}
                value={form[f.key]}
                placeholder={typicalWeather(result, f.key)}
                onChange={(e) => set(f.key)(e.target.value)}
                className={FIELD}
              />
            </Field>
          ))}
        </Column>

        <Column title="Historic fire inputs">
          <Select label="Slope" value={form.slope} options={optionsOf(SLOPE_SCORES, " %")} onChange={set("slope")} />
          <Select label="Aspect" value={form.aspect} options={optionsOf(ASPECT_SCORES)} onChange={set("aspect")} />
          <Select
            label="Elevation"
            value={form.elevation}
            options={optionsOf(ELEVATION_SCORES, " ft")}
            onChange={set("elevation")}
          />
          <Select label="Cause" value={form.cause} options={optionsOf(CAUSE_SCORES)} onChange={set("cause")} />
          <Select
            label="Discovery month"
            value={form.month}
            options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
            onChange={set("month")}
          />
        </Column>
      </div>
    </div>
  );
}
