"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Download, Loader2, MousePointerClick, Pentagon, Square, Trash2 } from "lucide-react";

import { AppPage, Check, FIELD, Field, SHADOW, Stat, buttonClass } from "@/components/ui/app";
import PointPanel from "@/components/forest-trends/PointPanel";
import type { DrawMode, MapLayer } from "@/components/forest-trends/TrendMap";
import {
  BASEMAPS, INDICES, MAX_AREA_KM2, MAX_DOWNLOAD_AREA_KM2, REDUCERS, SLOPE_PALETTE, TAU_PALETTE,
  fmtArea, pct, polygon, postJson, ringAreaKm2,
  type Basemap, type Reducer, type Ring, type TrendResult, type TrendSettings, type VegIndex,
} from "@/components/forest-trends/data";

const TrendMap = dynamic(() => import("@/components/forest-trends/TrendMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

const THIS_YEAR = new Date().getFullYear();



function Legend({ title, palette, min, max }: { title: string; palette: string[]; min: number; max: number }) {
  return (
    <div className="min-w-[180px] flex-1">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <div className="mt-1 h-2.5 border border-slate-300" style={{ background: `linear-gradient(to right, ${palette.join(", ")})` }} />
      <div className="mt-0.5 flex justify-between font-mono text-xs text-slate-500">
        <span>{min}</span><span>0</span><span>{max}</span>
      </div>
    </div>
  );
}


export default function ForestTrendsPage() {
  const [settings, setSettings] = useState<TrendSettings>({ startYear: 2000, endYear: 2024, index: "NDVI", reducer: "median" });
  const [significant, setSignificant] = useState(false);
  const [showMtbs, setShowMtbs] = useState(false);
  const [showAk, setShowAk] = useState(true);
  const [view, setView] = useState<"tau" | "slope">("tau");
  const [opacity, setOpacity] = useState(0.85);
  const [basemap, setBasemap] = useState<Basemap>("Street");

  const [mode, setMode] = useState<DrawMode>("none");
  const [ring, setRing] = useState<Ring | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrendResult | null>(null);
  const [resultRing, setResultRing] = useState<Ring | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [downloads, setDownloads] = useState<Record<string, string> | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);

  const area = ring ? ringAreaKm2(ring) : null;
  const tooLarge = area != null && area > MAX_AREA_KM2;
  const set = (patch: Partial<TrendSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const yearsValid = settings.startYear >= 1984 && settings.endYear <= THIS_YEAR && settings.endYear - settings.startYear >= 4;

  // The map shows the last calculation; say so when the inputs have moved on.
  const stale = result != null && (
    ring !== resultRing || result.start_year !== settings.startYear || result.end_year !== settings.endYear
    || result.index !== settings.index || result.reducer !== settings.reducer
  );

  async function calculate() {
    if (!ring) return;
    setRunning(true);
    setError(null);
    setDownloads(null);
    setDownloadError(null);
    try {
      const r = await postJson<TrendResult>("/api/forest-trends", {
        kind: "map",
        region: polygon(ring),
        start_year: settings.startYear,
        end_year: settings.endYear,
        index: settings.index,
        reducer: settings.reducer,
      });
      setResult(r);
      setResultRing(ring);
      setFitKey((k) => k + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function generateDownloads() {
    if (!result || !resultRing) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const r = await postJson<{ downloads: Record<string, string> }>("/api/forest-trends", {
        kind: "downloads",
        region: polygon(resultRing),
        start_year: result.start_year,
        end_year: result.end_year,
        index: result.index,
        reducer: result.reducer,
        significant_only: significant,
      });
      setDownloads(r.downloads);
    } catch (e: any) {
      setDownloadError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  const layers = useMemo<MapLayer[]>(() => {
    if (!result) return [];
    const L = result.layers;
    const trend = view === "tau" ? (significant ? L.sig_tau : L.tau) : (significant ? L.sig_slope : L.slope);
    const out: MapLayer[] = [{ key: "trend", url: trend, opacity }];
    if (showMtbs) out.push({ key: "mtbs", url: L.mtbs, opacity: 1 });
    if (showAk && L.ak_fire) out.push({ key: "ak", url: L.ak_fire, opacity: 1 });
    return out;
  }, [result, view, significant, opacity, showMtbs, showAk]);

  const startDraw = (m: DrawMode) => {
    setMode((cur) => (cur === m ? "none" : m));
    setError(null);
  };

  return (
    <AppPage
          eyebrow="Apps · Vegetation change"
          title="Forest Trends"
          description="Where interior Alaska's boreal forest has been greening or browning, and how fire history and climate shape it. Draw an area to map its trends, or click any point for its year-by-year record."
          meta={["Landsat 5/7/8/9 summer composites", "TerraClimate", "MTBS and Alaska fire perimeters", "Google Earth Engine"]}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* Controls */}
            <aside className="space-y-4">
              <section className={`space-y-4 border-t-4 border-gold bg-white p-5 ${SHADOW}`}>
                <div>
                  <h2 className="text-xl font-bold text-navy-deep">Map trends</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Draw a region of interest on the map, choose the years and index, then calculate.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start year">
                    <input type="number" min={1984} max={THIS_YEAR} value={settings.startYear} className={FIELD}
                      onChange={(e) => set({ startYear: Number(e.target.value) })} />
                  </Field>
                  <Field label="End year">
                    <input type="number" min={1984} max={THIS_YEAR} value={settings.endYear} className={FIELD}
                      onChange={(e) => set({ endYear: Number(e.target.value) })} />
                  </Field>
                  <Field label="Map index">
                    <select value={settings.index} className={FIELD} onChange={(e) => set({ index: e.target.value as VegIndex })}>
                      {INDICES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </Field>
                  <Field label="Composite">
                    <select value={settings.reducer} className={FIELD} onChange={(e) => set({ reducer: e.target.value as Reducer })}>
                      {REDUCERS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>
                {!yearsValid && (
                  <p className="text-xs text-amber-800">Use years from 1984 to {THIS_YEAR}, at least five years apart.</p>
                )}

                <Check label="Apply significance masking (p ≤ 0.05)" checked={significant} onChange={setSignificant} />

                <div>
                  <p className="text-xs font-semibold text-slate-600">Fire overlays</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                    <Check label="MTBS (USA)" checked={showMtbs} onChange={setShowMtbs} />
                    <Check label="AK fire history" checked={showAk} onChange={setShowAk}
                      disabled={result != null && !result.layers.ak_fire} />
                  </div>
                </div>

                <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  {ring ? (
                    <span className={tooLarge ? "text-amber-800" : "text-slate-700"}>
                      Region: <b className="font-mono">{fmtArea(area!)}</b>
                      {tooLarge && ` · draw one under ${MAX_AREA_KM2.toLocaleString("en-US")} km²`}
                    </span>
                  ) : (
                    <span className="text-slate-500">No region yet. Use the draw tools above the map.</span>
                  )}
                </div>

                {error && <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

                <button type="button" className={buttonClass("primary", "w-full py-2.5")} onClick={calculate}
                  disabled={!ring || tooLarge || running || !yearsValid}>
                  {running ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Calculating…</> : "Calculate trends"}
                </button>
                {running && (
                  <p className="text-xs text-slate-500">Earth Engine is fitting a trend to every 30 m pixel; this usually takes 20–60 seconds.</p>
                )}
              </section>

              {result && (
                <section className={`space-y-3 bg-white p-5 ${SHADOW}`}>
                  <div>
                    <h2 className="text-xl font-bold text-navy-deep">Region summary</h2>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {result.index} · {result.reducer} · {result.start_year}–{result.end_year}
                    </p>
                  </div>
                  {stale && (
                    <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      The settings or region have changed since this calculation. Calculate again to update the map.
                    </p>
                  )}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Stat label="Area" value={fmtArea(result.region_area_km2)} />
                    <Stat label="Fires (MTBS · AK)" value={`${result.fires_in_region.mtbs} · ${result.fires_in_region.ak ?? "—"}`} />
                    <Stat label="Significantly greening" value={pct(result.summary?.share_significant_greening)} />
                    <Stat label="Significantly browning" value={pct(result.summary?.share_significant_browning)} />
                    <Stat label="Median Kendall τ" value={result.summary?.median_tau?.toFixed(3) ?? "—"} />
                    <Stat label={`Median slope (${result.index}/yr)`} value={result.summary?.median_slope_per_year?.toFixed(4) ?? "—"} />
                  </dl>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Shares are of pixels with a trend, at p ≤ 0.05, sampled on a {result.summary?.sample_scale_m ?? 120} m grid.
                  </p>
                  {result.notes.map((n) => <p key={n} className="text-xs text-amber-800">{n}</p>)}

                  <div className="border-t border-slate-200 pt-3">
                    <h3 className="text-base font-bold text-navy-deep">Export map layers</h3>
                    {downloads ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {Object.entries(downloads).map(([name, url]) => (
                          <li key={name}>
                            <a href={url} className="inline-flex items-center gap-1.5 font-semibold text-navy underline underline-offset-2 hover:text-navy-deep">
                              <Download size={13} aria-hidden="true" /> {name} (GeoTIFF)
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          GeoTIFFs at 30 m clipped to the region, for QGIS or ArcGIS. Direct downloads work for regions under{" "}
                          {MAX_DOWNLOAD_AREA_KM2.toLocaleString("en-US")} km².
                        </p>
                        <button type="button" onClick={generateDownloads} disabled={downloading || stale}
                          className="mt-2 flex items-center gap-2 border border-navy bg-white px-3 py-1.5 font-mono text-sm font-semibold uppercase tracking-wide text-navy transition hover:bg-navy-soft disabled:opacity-40">
                          {downloading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                          Generate download links
                        </button>
                      </>
                    )}
                    {downloadError && <p className="mt-2 text-xs text-red-800">{downloadError}</p>}
                  </div>
                </section>
              )}
            </aside>

            {/* Map */}
            <section className={`min-w-0 self-start bg-white ${SHADOW}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Draw a region">
                  {([
                    ["rectangle", Square, "Rectangle"],
                    ["polygon", Pentagon, "Polygon"],
                  ] as const).map(([m, Icon, label]) => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => startDraw(m)}
                      className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm font-semibold transition ${
                        mode === m ? "border-navy bg-navy text-white" : "border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy"
                      }`}>
                      <Icon size={14} aria-hidden="true" /> {label}
                    </button>
                  ))}
                  <button type="button" disabled={!ring} onClick={() => { setRing(null); setMode("none"); }}
                    className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy disabled:opacity-40">
                    <Trash2 size={14} aria-hidden="true" /> Clear region
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Basemap
                  <select value={basemap} onChange={(e) => setBasemap(e.target.value as Basemap)}
                    className="h-8 border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-navy">
                    {(Object.keys(BASEMAPS) as Basemap[]).map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>

              <div className="border-b border-slate-200 bg-navy-soft px-3 py-1.5 text-xs text-navy-deep">
                <MousePointerClick size={13} className="mr-1.5 inline -translate-y-px" aria-hidden="true" />
                {mode === "rectangle" ? "Press and drag to draw a rectangle. Esc cancels."
                  : mode === "polygon" ? "Click each corner; double-click, or click the first corner, to finish. Esc cancels."
                  : "Click anywhere on the map for that point's yearly vegetation and climate record."}
              </div>

              <div className="relative h-[560px]">
                <TrendMap
                  basemap={basemap}
                  mode={mode}
                  onDrawn={(r) => { setRing(r); setMode("none"); }}
                  onCancelDraw={() => setMode("none")}
                  ring={ring}
                  fitKey={fitKey}
                  layers={layers}
                  picked={picked}
                  onPick={(lat, lon) => setPicked({ lat, lon })}
                />
              </div>

              {result && (
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-slate-200 px-4 py-3">
                  <div className="flex gap-1" role="radiogroup" aria-label="Trend layer">
                    {([["tau", "Trend (Kendall τ)"], ["slope", "Rate of change (Sen slope)"]] as const).map(([v, label]) => (
                      <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
                        className={`border px-3 py-1.5 text-sm font-semibold transition ${
                          view === v ? "border-navy bg-navy text-white" : "border-slate-300 text-slate-700 hover:border-navy hover:text-navy"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    Opacity
                    <input type="range" min={0.2} max={1} step={0.05} value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))} className="w-28 accent-[#236192]" />
                  </label>
                  {view === "tau"
                    ? <Legend title="Trend (Kendall τ): browning to greening" palette={TAU_PALETTE} min={-1} max={1} />
                    : <Legend title={`Rate of change (${result.index}/year)`} palette={SLOPE_PALETTE} min={-0.01} max={0.01} />}
                </div>
              )}
            </section>
          </div>

          {picked ? (
            <PointPanel lat={picked.lat} lon={picked.lon} settings={settings} onClear={() => setPicked(null)} />
          ) : (
            <p className="border border-dashed border-slate-300 bg-white px-5 py-6 text-center text-sm text-slate-500">
              Click a point on the map to see its NDVI, NBR and NDMI each summer, the fires that burned there, and how the index tracks climate.
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className={`bg-white p-6 ${SHADOW}`}>
              <h2 className="text-xl font-bold text-navy-deep">About the method</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
                <p>Non-parametric statistics detect vegetation change, so results are robust against outliers and sensor noise.</p>
                <p><b>Kendall&apos;s tau (τ)</b> measures the ordinal association between year and the vegetation index. A positive τ is an increasing trend (greening); a negative τ is a decreasing trend (browning). It counts concordant against discordant pairs of years.</p>
                <p><b>Theil–Sen slope</b> is the median rate of change per year: the median of the slopes between every pair of years. Unlike a linear regression, a few bad years or extreme events barely move it.</p>
                <p><b>Significance masking</b> keeps only pixels whose trend is significant at p ≤ 0.05, from a Z-score of τ.</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><b>NDVI</b> = (NIR − Red) / (NIR + Red): vegetation vigour and density.</li>
                  <li><b>NBR</b> = (NIR − SWIR2) / (NIR + SWIR2): burn severity and regrowth.</li>
                  <li><b>NDMI</b> = (NIR − SWIR1) / (NIR + SWIR1): moisture in vegetation.</li>
                </ul>
                <p>Each year is a June–August composite of cloud-, shadow-, snow- and water-masked Landsat 5, 7, 8 and 9 surface reflectance.</p>
              </div>
            </section>

            <section className={`bg-white p-6 ${SHADOW}`}>
              <h2 className="text-xl font-bold text-navy-deep">Data sources and credit</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                <li><a className="font-semibold text-navy underline underline-offset-2" href="https://developers.google.com/earth-engine/datasets/catalog/landsat" target="_blank" rel="noopener noreferrer">Landsat Collection 2 surface reflectance</a> (USGS)</li>
                <li><a className="font-semibold text-navy underline underline-offset-2" href="https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE" target="_blank" rel="noopener noreferrer">TerraClimate</a>: monthly climate and climatic water balance</li>
                <li><a className="font-semibold text-navy underline underline-offset-2" href="https://developers.google.com/earth-engine/datasets/catalog/USFS_GTAC_MTBS_burned_area_boundaries_v1" target="_blank" rel="noopener noreferrer">MTBS</a>: national perimeters for large fires</li>
                <li><a className="font-semibold text-navy underline underline-offset-2" href="https://fire.ak.blm.gov/predsvcs/maps.php" target="_blank" rel="noopener noreferrer">AICC Alaska fire history</a>: regional perimeters, including smaller fires national programs miss</li>
              </ul>
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-700">
                <p>
                  Built from <b>Sumana Sahoo</b>&apos;s <a className="font-semibold text-navy underline underline-offset-2" href="https://github.com/Sumana18/Forest-trend-mapper" target="_blank" rel="noopener noreferrer">Forest Trend Mapper</a> (UAF, MIT licence).
                </p>
                <p className="text-xs text-slate-600">
                  Sahoo, S., et al. (2025). Interplay of Topography, Fire History, and Climate on Interior Alaska Boreal Forest Vegetation Dynamics.{" "}
                  <i>Forests</i>, 16(5), 777. <a className="text-navy underline" href="https://doi.org/10.3390/f16050777" target="_blank" rel="noopener noreferrer">doi:10.3390/f16050777</a>
                  <br />
                  Sahoo, S. (2026). Forest Trend Mapper (v1.0.0). Zenodo.{" "}
                  <a className="text-navy underline" href="https://doi.org/10.5281/zenodo.19860349" target="_blank" rel="noopener noreferrer">doi:10.5281/zenodo.19860349</a>
                </p>
                <p className="text-xs text-slate-600">
                  The research was funded by the USDA National Institute of Food and Agriculture, McIntire Stennis project (Accession
                  Number 1026801), with support from the Troth Yeddha&apos; University of Alaska Fairbanks PhD Fellowship.
                </p>
              </div>
            </section>
          </div>
    </AppPage>
  );
}
