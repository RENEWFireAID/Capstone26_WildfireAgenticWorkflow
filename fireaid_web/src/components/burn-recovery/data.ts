"use client";

import { useEffect, useState } from "react";

export const FIRES = ["Shovel Creek", "Swan Lake", "Nugget Creek"] as const;
export type FireName = (typeof FIRES)[number];

export const PERIODS = ["2020", "2021"] as const;
export const MODELS = {
  full: "Environmental predictors",
  initial_NDVI_only: "Initial NDVI only",
  full_plus_initial_NDVI: "Environmental predictors + initial NDVI",
} as const;
export type ModelKey = keyof typeof MODELS;

// dNBR bins and colours from the original app, indexed by severity class.
export const SEVERITY_COLORS = ["#357454", "#82964c", "#b4a047", "#ca873b", "#b4543b", "#793e44"];

export type CaseSummary = {
  r2: number;
  rmse: number;
  baseline_rmse: number;
  beats_baseline: boolean;
  outside_training_range_fraction: number;
  training_fires: string;
};

export type FireOverview = {
  sampled_locations: number;
  complete_input_coverage: number;
  crs: string;
  mtbs_comparison: {
    reference_dates: [string, string];
    common_support_fraction: number;
    rows: { hls_imagery: string; high_cutoff: number; high_vs_other_agreement: number; high_severity_iou: number | null }[];
  };
  field_cbi: {
    footprint: string;
    survey_plots: number;
    cbi_dnbr_rank_correlation: number;
    fixed_class_agreement: number;
    high_cbi_plots_detected: number;
    high_cbi_plots: number;
  }[];
  diagnostics: { key: string; title: string }[];
};

export type Overview = { run_completed_utc: string; years: number[]; fires: Record<FireName, FireOverview> };

export type Imagery = {
  url: string;
  width: number;
  height: number;
  description: string;
  legend: { min: number; max: number; palette: string[]; unit: string } | null;
  extent: string;
  support_by_summer: { summer: string; median_image_inputs: number; no_inputs: number; one_or_two_inputs: number; valid_ndvi: number }[];
};

export type Samples = CaseSummary & {
  years: number[];
  crs: string;
  x_km: number[];
  y_km: number[];
  dnbr: number[];
  ndvi: number[][];
  trajectory: { severity: number; label: string; n: number; mean: number[] }[];
  observed_slope: number[];
  predicted_slope: number[];
};

export type Diagnostic = { key: string; title: string; url: string };

// The study is a fixed, saved run, so each response is fetched once per visit.
const cache = new Map<string, Promise<unknown>>();

function load<T>(params: Record<string, string>): Promise<T> {
  const key = new URLSearchParams(params).toString();
  if (!cache.has(key)) {
    const request = fetch(`/api/burn-recovery?${key}`).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      return body;
    });
    request.catch(() => cache.delete(key));
    cache.set(key, request);
  }
  return cache.get(key) as Promise<T>;
}

export function useBurnRecovery<T>(params: Record<string, string> | null) {
  const key = params ? new URLSearchParams(params).toString() : "";
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  useEffect(() => {
    if (!params) return;
    let live = true;
    load<T>(params)
      .then((data) => live && setState({ key, data }))
      .catch((e) => live && setState({ key, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: !!params && !current };
}

/* ---------- colour scales, matching the original Plotly figures ---------- */

type Stop = [number, string];

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function evenStops(colors: string[]): Stop[] {
  return colors.map((c, i) => [i / (colors.length - 1), c]);
}

// Diverging ColorBrewer scales as Plotly defines them.
export const RD_YL_GN = evenStops(["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"]);
export const RD_BU_R = evenStops(["#053061", "#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b", "#67001f"]);
export const DNBR_RAMP = evenStops(["#006400", "#70a800", "#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026", "#7a0000"]);
export const NDVI_RAMP: Stop[] = [[0, "#e5d7b3"], [0.5, "#aed581"], [1, "#1b5e20"]];

/** Colour for value on a scale clamped to [low, high]. */
export function colorAt(stops: Stop[], value: number, low: number, high: number): string {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const a = hex(c0), b = hex(c1);
      return toHex(a.map((v, k) => v + (b[k] - v) * f));
    }
  }
  return stops[stops.length - 1][1];
}

export const gradientCss = (stops: Stop[]) =>
  `linear-gradient(to right, ${stops.map(([t, c]) => `${c} ${(t * 100).toFixed(1)}%`).join(", ")})`;

export const pct = (v: number, digits = 2) => `${(100 * v).toFixed(digits)}%`;
