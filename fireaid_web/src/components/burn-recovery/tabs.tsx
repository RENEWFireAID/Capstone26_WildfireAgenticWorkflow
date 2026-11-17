"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DNBR_RAMP, MODELS, NDVI_RAMP, RD_BU_R, RD_YL_GN, pct, useBurnRecovery,
  type Diagnostic, type FireName, type FireOverview, type Imagery, type ModelKey, type Samples,
} from "./data";
import { ObservedPredicted, RmseBars, SampleMap, TrajectoryChart, type Scale } from "./charts";
import { buttonClass } from "@/components/ui/app";
import { Caption, Details, LoadError, Loading, Metrics, Note, SectionTitle, Select, Table } from "./ui";

/* ------------------------------------------------------------------ Imagery */

const LAYERS = [
  { value: "rgb_2018", label: "Before fire (2018)" },
  { value: "rgb_2020", label: "After fire (2020)" },
  { value: "rgb_2024", label: "Later landscape (2024)" },
  { value: "dnbr", label: "Burn-related change (dNBR)" },
  { value: "ndvi", label: "Summer greenness (NDVI)" },
  { value: "observations", label: "Usable image inputs" },
];
const SUMMERS = ["2018", "2020", "2021", "2022", "2023", "2024"] as const;
const CONTRASTS = [
  { value: "percentile", label: "Shared 2-98% stretch" },
  { value: "brighter", label: "Brighter fixed stretch" },
  { value: "original", label: "Original fixed stretch" },
];

export function ImageryTab({ fire }: { fire: FireName }) {
  const [layer, setLayer] = useState("dnbr");
  const [year, setYear] = useState<(typeof SUMMERS)[number]>("2024");
  const [contrast, setContrast] = useState("percentile");
  const seasonal = layer === "ndvi" || layer === "observations";
  const rgb = layer.startsWith("rgb_");
  const params: Record<string, string> = { kind: "imagery", fire, layer, contrast };
  if (seasonal) params.year = year;
  const { data, error, loading } = useBurnRecovery<Imagery>(params);

  return (
    <div className="space-y-4">
      <SectionTitle title="Landscape and satellite observations" subtitle="Compare the fire scar and annual greenness using the saved HLS imagery." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select id="br-layer" label="Layer" value={layer} options={LAYERS} onChange={setLayer} />
        {seasonal && <Select id="br-summer" label="Summer" value={year} options={SUMMERS} onChange={setYear} />}
        {rgb && <Select id="br-contrast" label="Natural-color contrast" value={contrast} options={CONTRASTS} onChange={setContrast} />}
      </div>
      {rgb && (
        <Note>
          Contrast changes the picture only. The percentile option clips the darkest and brightest sampled RGB values using one range
          across all fires and years. NDVI, dNBR and model values are unchanged.
        </Note>
      )}
      {error ? <LoadError message={error} /> : loading || !data ? <Loading label="Loading imagery…" /> : (
        <>
          <figure className="border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.url} alt={`${fire}: ${data.description}`} width={data.width} height={data.height}
              className="mx-auto h-auto max-h-[490px] w-auto max-w-full object-contain" />
            {data.legend && (
              <div className="mx-auto mt-4 w-full max-w-md text-xs text-slate-600">
                <div className="h-3" style={{ background: `linear-gradient(to right, ${data.legend.palette.join(", ")})` }} />
                <div className="mt-1 flex justify-between font-mono tabular">
                  <span>{data.legend.min}</span><span className="font-sans">{data.legend.unit}</span><span>{data.legend.max}</span>
                </div>
              </div>
            )}
          </figure>
          <div className="space-y-1.5">
            <p className="text-sm text-slate-700">{data.description}</p>
            <Caption>
              Grid north is up. Every preview uses the same extent for this fire. Pictures are display-resampled; statistics use the 30 m grid.
              Blank areas are masked or outside the boundary.
            </Caption>
            <Caption>{data.extent}</Caption>
          </div>
          <Details title="Imagery support by summer">
            <Table
              columns={["Summer", "Median image inputs", "No inputs", "1-2 inputs", "Valid NDVI"]}
              numeric={[1, 2, 3, 4]}
              rows={data.support_by_summer.map((s) => [s.summer, s.median_image_inputs.toFixed(1), pct(s.no_inputs), pct(s.one_or_two_inputs), pct(s.valid_ndvi)])}
            />
            <Caption>
              Counts are QA-screened image inputs with jointly available red, NIR and SWIR2 bands. They are not unique dates or independent
              observations. Counts include zeros; the low-count flag is descriptive.
            </Caption>
          </Details>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Greenness */

const COLOR_BY = ["Burn-related change", "Greenness in 2024", "Observed NDVI slope", "Prediction error"] as const;
type ColorBy = (typeof COLOR_BY)[number];

export function GreennessTab({ fire, period, model }: { fire: FireName; period: string; model: ModelKey }) {
  const [colorBy, setColorBy] = useState<ColorBy>("Burn-related change");
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [fire]);
  const { data, error, loading } = useBurnRecovery<Samples>({ kind: "samples", fire, period, model });

  const layer = useMemo(() => {
    if (!data) return null;
    const scales: Record<ColorBy, [number[], Scale]> = {
      "Burn-related change": [data.dnbr, { stops: DNBR_RAMP, low: -100, high: 800, title: "dNBR x1000", digits: 1 }],
      "Greenness in 2024": [data.ndvi.map((v) => v[4]), { stops: NDVI_RAMP, low: -0.2, high: 1, title: "NDVI", digits: 4 }],
      "Observed NDVI slope": [data.observed_slope, { stops: RD_YL_GN, low: -0.08, high: 0.08, title: "NDVI/year", digits: 4 }],
      "Prediction error": [data.predicted_slope.map((p, i) => p - data.observed_slope[i]), { stops: RD_BU_R, low: -0.08, high: 0.08, title: "NDVI/year", digits: 4 }],
    };
    return scales[colorBy];
  }, [data, colorBy]);

  return (
    <div className="space-y-4">
      <SectionTitle title="Annual greenness" subtitle="Select a sampled location to compare its NDVI with the severity-group curves." />
      <Caption>Observed slopes use {period}-2024. Prediction errors use {MODELS[model].toLowerCase()}, selected in Models.</Caption>
      {error ? <LoadError message={error} /> : loading || !data || !layer ? <Loading label="Loading samples…" /> : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <Select id="br-color-by" label="Color locations by" value={colorBy} options={COLOR_BY} onChange={setColorBy} />
            <SampleMap x={data.x_km} y={data.y_km} values={layer[0]} scale={layer[1]} selected={selected} onSelect={setSelected} />
            <Caption>
              {data.crs}. Points are sampled values at nominal 200 m scale. Prediction error is predicted minus observed. Color limits stay
              fixed across fires.
            </Caption>
          </div>
          <div className="min-w-0 space-y-3">
            <TrajectoryChart years={data.years} trajectory={data.trajectory}
              selected={selected === null ? null : { index: selected, values: data.ndvi[selected] }} />
            <button type="button" onClick={() => setSelected(null)} disabled={selected === null}
              className={buttonClass("secondary", "px-3 py-1.5")}>
              Clear selected sample
            </button>
            {selected !== null && (
              <Note>Sample {selected}: fitted {period}-2024 slope is {data.observed_slope[selected] >= 0 ? "+" : ""}{data.observed_slope[selected].toFixed(4)} NDVI/year.</Note>
            )}
          </div>
        </div>
      )}
      <Note>
        Curves are sample means within provisional dNBR bins, using the same locations every year. They are not area-weighted fire averages.
        Increasing NDVI indicates spectral greening; it does not establish tree recovery or restored forest structure.
      </Note>
    </div>
  );
}

/* ------------------------------------------------------------------- Models */

export function ModelsTab({ fire, period, setPeriod, model, setModel }: {
  fire: FireName;
  period: string;
  setPeriod: (p: string) => void;
  model: ModelKey;
  setModel: (m: ModelKey) => void;
}) {
  const { data, error, loading } = useBurnRecovery<Samples>({ kind: "samples", fire, period, model });
  return (
    <div className="space-y-4">
      <SectionTitle title="Can a model trained on two fires predict the third?" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select id="br-period" label="NDVI slope period" value={period} options={["2020", "2021"]} onChange={setPeriod} />
        <Select id="br-model" label="Predictors" value={model}
          options={(Object.keys(MODELS) as ModelKey[]).map((k) => ({ value: k, label: MODELS[k] }))} onChange={setModel} />
      </div>
      {error ? <LoadError message={error} /> : loading || !data ? <Loading label="Loading model results…" /> : (
        <>
          <Caption>Target: annual NDVI slope from {period} through 2024. Trained on {data.training_fires}.</Caption>
          <Metrics items={[
            ["Held-out-fire R²", data.r2.toFixed(3)],
            ["Model RMSE (NDVI/year)", data.rmse.toFixed(4)],
            ["Baseline RMSE (NDVI/year)", data.baseline_rmse.toFixed(4)],
          ]} />
          <Note tone={data.beats_baseline ? "info" : "warning"}>
            {data.beats_baseline
              ? "This model has lower error than the training-mean baseline."
              : "This model has higher error than the training-mean baseline on this fire."}{" "}
            Negative R² means worse squared error than predicting the held-out fire&apos;s mean. R² is not percent accuracy.
          </Note>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ObservedPredicted observed={data.observed_slope} predicted={data.predicted_slope} />
            <RmseBars model={data.rmse} baseline={data.baseline_rmse} />
          </div>
          <Caption>Each point is a held-out sample location; the dashed line is perfect prediction.</Caption>
          <Note>
            {(100 * data.outside_training_range_fraction).toFixed(1)}% of test samples have at least one predictor outside its training range.
            Marginal ranges can miss gaps in joint predictor combinations. All fits remain spatially dependent. Climate describes the completed
            recovery period; these models are retrospective.
          </Note>
          {model !== "full" && (
            <Note tone="warning">
              Initial NDVI comes from 2020. It is also part of the 2020-2024 slope calculation. Compare the later window to inspect this
              shared-year sensitivity; a higher earlier score does not establish independent forecasting skill.
            </Note>
          )}
        </>
      )}
      <Details title="Environmental predictors">
        <p>
          dNBR, elevation, terrain slope, northness, pre-fire tree-class probability, temperature anomaly and precipitation anomaly. Tree
          probability is not tree-cover percentage. Coarse climate values are not independent 30 m observations.
        </p>
      </Details>
    </div>
  );
}

/* --------------------------------------------------------------- Validation */

export function ValidationTab({ fire, overview, runCompleted }: { fire: FireName; overview: FireOverview; runCompleted: string }) {
  const [figure, setFigure] = useState("residual_maps");
  const diagnostics = overview.diagnostics;
  const { data: image, error, loading } = useBurnRecovery<Diagnostic>(diagnostics.length ? { kind: "diagnostic", figure } : null);
  const ref = overview.mtbs_comparison;
  const plot = overview.field_cbi.find((r) => r.footprint === "plot_15m");

  return (
    <div className="space-y-4">
      <SectionTitle title="Severity comparison with MTBS" subtitle="Agreement between satellite products, evaluated on the same valid pixels." />
      <Table
        columns={["HLS imagery", "High cutoff", "High vs other agreement", "High-severity IoU"]}
        numeric={[1, 2, 3]}
        rows={ref.rows.map((r) => [r.hls_imagery, r.high_cutoff, pct(r.high_vs_other_agreement), r.high_severity_iou === null ? "Undefined" : pct(r.high_severity_iou)])}
      />
      <Caption>
        Common support covers {pct(ref.common_support_fraction)} of the boundary intersection. Reference dates: {ref.reference_dates[0]} to{" "}
        {ref.reference_dates[1]}. IoU is the intersection divided by the union of high-severity areas.
      </Caption>
      <Note>
        MTBS and HLS share satellite inputs. Date matching does not reproduce identical processing or establish field accuracy. Swan Lake also
        changes the reference baseline from 2018 to 2017.
      </Note>

      <SectionTitle title="What the diagnostics show" />
      {diagnostics.length ? (
        <>
          <Note tone="warning">
            Shovel transfer failure is reproducible. About 79% of its sample locations lie outside the training fires&apos; joint climate hull.
            Training climate predictors are strongly correlated. Errors remain spatially structured, and slopes change with the recovery window.
            These are diagnostic leads, not a proven ecological cause.
          </Note>
          <div className="max-w-sm">
            <Select id="br-diagnostic" label="Diagnostic figure" value={figure}
              options={diagnostics.map((d) => ({ value: d.key, label: d.title }))} onChange={setFigure} />
          </div>
          {error ? <LoadError message={error} /> : loading || !image ? <Loading label="Loading figure…" /> : (
            <figure className="border border-slate-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={`Shovel Creek diagnostic: ${image.title}`} className="mx-auto h-auto w-full max-w-5xl" />
            </figure>
          )}
          <Caption>
            Saved diagnostics use the environmental model and the periods printed in each figure; they do not change with the Models selectors.
            Residuals use observed minus predicted, the opposite sign from the greenness-tab error layer.
          </Caption>
        </>
      ) : (
        <Note>
          Full environmental models outperform the training-mean baseline in both windows for this fire, but all test locations have climate
          predictors outside training ranges. Residual spatial dependence remains. This does not establish reliable statewide prediction.
        </Note>
      )}

      <SectionTitle title="Field burn-severity check" />
      {plot ? (
        <>
          <Table
            columns={["Survey plots", "CBI vs dNBR rank correlation", "Fixed-class agreement", "High-CBI plots detected"]}
            numeric={[0, 1, 2]}
            rows={[[plot.survey_plots, plot.cbi_dnbr_rank_correlation.toFixed(3), pct(plot.fixed_class_agreement, 1), `${plot.high_cbi_plots_detected} of ${plot.high_cbi_plots}`]]}
          />
          <Note tone="warning">
            Santosh&apos;s summer 2020 CBI scores are compared with HLS means within a 15 m radius, matching the reported 30 m plot diameter.
            Correlations include unburned controls and describe ordering, not accuracy. Existing dNBR thresholds miss many high-CBI plots and
            remain uncalibrated.
          </Note>
          <Caption>
            Plots were selected for access and severity coverage. Exact survey dates are unavailable. This checks severity at selected plots, not
            fire-wide accuracy or later ecological recovery. Only aggregate statistics are included; raw field records stay local.
          </Caption>
          <Details title="Plot-footprint sensitivity">
            <Table
              columns={["Footprint", "Rank correlation", "Fixed-class agreement"]}
              numeric={[1, 2]}
              rows={overview.field_cbi.map((r) => [r.footprint, r.cbi_dnbr_rank_correlation.toFixed(3), pct(r.fixed_class_agreement, 1)])}
            />
          </Details>
        </>
      ) : (
        <Note>The supplied field surveys cover Shovel Creek and Nugget Creek. No Swan Lake field-reference comparison is included.</Note>
      )}

      <Details title="Sources and interpretation">
        <ul className="list-disc space-y-1 pl-5">
          <li><a className="text-navy underline" href="https://hls.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA HLS L30/S30 v002</a>: 30 m reflectance, QA-screened summer composites, dNBR and NDVI.</li>
          <li><a className="text-navy underline" href="https://fire.ak.blm.gov/predsvcs/maps.php" target="_blank" rel="noopener noreferrer">Alaska Fire History</a>: saved fire boundaries through the shared Earth Engine asset. Swan&apos;s boundary incorporates MTBS.</li>
          <li><a className="text-navy underline" href="https://www.mtbs.gov/" target="_blank" rel="noopener noreferrer">USFS/USGS MTBS</a>: severity reference and event metadata.</li>
          <li><a className="text-navy underline" href="https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1" target="_blank" rel="noopener noreferrer">Dynamic World</a>: pre-fire class probabilities.</li>
          <li><a className="text-navy underline" href="https://developers.google.com/earth-engine/datasets/catalog/USGS_3DEP_10m_collection" target="_blank" rel="noopener noreferrer">USGS 3DEP</a> and <a className="text-navy underline" href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1" target="_blank" rel="noopener noreferrer">Copernicus GLO-30</a>: terrain.</li>
          <li><a className="text-navy underline" href="https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE" target="_blank" rel="noopener noreferrer">TerraClimate</a>: summer climate anomalies versus 1991-2020.</li>
        </ul>
        <p>
          Summer imagery uses June 15 inclusive to August 15 exclusive. Severity compares 2018 and 2020; recovery uses NDVI from 2020 through
          2024. Coverage measures availability, not accuracy. Ordinary OLS significance, ecological recovery and Alaska-wide accuracy remain
          unestablished.
        </p>
        <Caption>
          Copernicus DEM © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union
          and ESA; all rights reserved.
        </Caption>
        <Caption>
          Notebook run completed {runCompleted}. FireMCP checks the saved files for source and sample fingerprints, slopes, displayed metrics and
          raster integrity when it loads them. No model refit or new imagery is requested.
        </Caption>
      </Details>
    </div>
  );
}
