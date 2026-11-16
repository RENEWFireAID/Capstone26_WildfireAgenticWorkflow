// Shared types, options and helpers for the Forest Trends app, a port of
// Sumana Sahoo's Forest Trend Mapper (github.com/Sumana18/Forest-trend-mapper).

export const INDICES = ["NDVI", "NBR", "NDMI"] as const;
export type VegIndex = (typeof INDICES)[number];

export const REDUCERS = ["median", "mean", "max"] as const;
export type Reducer = (typeof REDUCERS)[number];

export const INDEX_LABEL: Record<VegIndex, string> = {
  NDVI: "NDVI (greenness)",
  NBR: "NBR (burn ratio)",
  NDMI: "NDMI (moisture)",
};

export const INDEX_COLOR: Record<VegIndex, string> = {
  NDVI: "#16a34a",
  NBR: "#dc2626",
  NDMI: "#2563eb",
};

// Her climate variables, labelled as in the original app.
export const CLIMATE_BANDS = {
  "Summer Max Temp (°C)": "Temp",
  "Summer Max Temp (°C)(1-yr Lag)": "Temp_Lag1",
  "Summer Total Precip (mm)": "Precip",
  "Summer Total Precip (mm)(1-yr Lag)": "Precip_Lag1",
  "Spring Snow Water Equiv (mm)": "SWE",
  "Summer Soil Moisture (mm)": "Soil",
} as const;
export type ClimateLabel = keyof typeof CLIMATE_BANDS;
export const CLIMATE_LABELS = Object.keys(CLIMATE_BANDS) as ClimateLabel[];

export const TAU_PALETTE = ["#8c2d04", "#cc4c02", "#ec7014", "#fe9929", "#fdd49e", "#d9f0d3", "#addd8e", "#78c679", "#31a354", "#006837"];
export const SLOPE_PALETTE = ["#67001f", "#b2182b", "#ef8a62", "#fddbc7", "#d1e5f0", "#67a9cf", "#2166ac", "#053061"];

export const MAX_AREA_KM2 = 25_000;
export const MAX_DOWNLOAD_AREA_KM2 = 6_500;

/** A closed lon/lat ring, as GeoJSON wants it. */
export type Ring = [number, number][];

export type TrendSettings = {
  startYear: number;
  endYear: number;
  index: VegIndex;
  reducer: Reducer;
};

export type TrendResult = {
  region_area_km2: number;
  start_year: number;
  end_year: number;
  index: VegIndex;
  reducer: Reducer;
  layers: {
    tau: string;
    slope: string;
    sig_tau: string;
    sig_slope: string;
    mtbs: string;
    ak_fire: string | null;
  };
  fires_in_region: { mtbs: number; ak: number | null };
  summary: {
    median_tau: number | null;
    median_slope_per_year: number | null;
    share_significant_greening: number | null;
    share_significant_browning: number | null;
    sample_scale_m: number;
  } | null;
  notes: string[];
};

export type VegRecord = { year: number } & Record<string, number | null>;

export type FireAtPoint = { name: string; source: "MTBS" | "AK Fire"; year: number | null };

export function polygon(ring: Ring) {
  const closed = ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ? [...ring, ring[0]]
    : ring;
  return { type: "Polygon" as const, coordinates: [closed] };
}

/** Spherical area of a lon/lat ring in km², matching FireMCP's check. */
export function ringAreaKm2(ring: Ring): number {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    total += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return (Math.abs(total) * R * R) / 2;
}

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

export const fmtArea = (km2: number) =>
  km2 >= 100 ? `${Math.round(km2).toLocaleString("en-US")} km²` : `${km2.toFixed(1)} km²`;

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

// Kept here, not in TrendMap, so the page can list them without loading Leaflet on the server.
export const BASEMAPS = {
  Street: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  Satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
  },
  Terrain: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  Dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
} as const;
export type Basemap = keyof typeof BASEMAPS;
