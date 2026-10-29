export type ModelId = "random_forest" | "xgboost" | "svm";

export const MODELS: readonly { id: ModelId; label: string }[] = [
  { id: "random_forest", label: "Random Forest" },
  { id: "xgboost", label: "XGBoost" },
  { id: "svm", label: "SVM" },
];

// Keys are the dropdown options, in display order.
export const SLOPE_SCORES: Record<string, number> = {
  "0-25": 2, "26-40": 4, "41-55": 6, "56-75": 8, "76+": 10, Unknown: 3,
};

export const ASPECT_SCORES: Record<string, number> = {
  Flat: 8, North: 3, Northeast: 4, East: 9, Southeast: 13,
  South: 15, Southwest: 14, West: 10, Northwest: 5, Unknown: 7,
};

export const ELEVATION_SCORES: Record<string, number> = {
  "0-500": 5, "501-1500": 10, "1501-2500": 15, "2501-3500": 12, "3501-4500": 8,
  "4501-5500": 5, "5501-6500": 3, "6501-7500": 2, "7501-8500": 1, "8501+": 1, Unknown: 7,
};

export const CAUSE_SCORES: Record<string, number> = {
  Lightning: 15, Natural: 12, Human: 4, Undetermined: 6, Prescribed: 0,
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_SCORES = [1, 1, 3, 9, 17, 20, 20, 15, 7, 3, 1, 1];

export const SCORE_LIMITS = {
  IGNITION_WEATHER_SCORE: 15,
  SEASONAL_SCORE: 20,
  ASPECT_SCORE: 15,
  ELEVATION_SCORE: 15,
  SLOPE_WIND_SCORE: 10,
  SPREAD_RATE_SCORE: 25,
};

export type ScoreName = keyof typeof SCORE_LIMITS;
export type Scores = Record<ScoreName, number>;

export type DerivedScores = Omit<Scores, "SPREAD_RATE_SCORE">;

export type FireInputs = {
  slope: string;
  aspect: string;
  elevation: string;
  cause: string;
  month: number;
};

export type WeatherInputs = Partial<Record<"maxTemp" | "minTemp" | "precip" | "wind", number>>;

export const WEATHER_FEATURES: Record<keyof WeatherInputs, string> = {
  maxTemp: "avg_max_temp_7d",
  minTemp: "avg_min_temp_7d",
  precip: "total_precip_7d",
  wind: "max_wind_7d",
};

export const DEFAULT_FIRE: FireInputs = {
  slope: "0-25",
  aspect: "Flat",
  elevation: "0-500",
  cause: "Lightning",
  month: 7,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function lookup(table: Record<string, number>, field: string, value: string): number {
  if (!Object.hasOwn(table, value)) throw new Error(`Unknown ${field}: ${value}`);
  return table[value];
}

export function deriveScores(fire: FireInputs): DerivedScores {
  const seasonal = MONTH_SCORES[fire.month - 1];
  if (seasonal === undefined) throw new Error(`Unknown month: ${fire.month}`);
  return {
    IGNITION_WEATHER_SCORE: lookup(CAUSE_SCORES, "cause", fire.cause),
    SEASONAL_SCORE: seasonal,
    ASPECT_SCORE: lookup(ASPECT_SCORES, "aspect", fire.aspect),
    ELEVATION_SCORE: lookup(ELEVATION_SCORES, "elevation", fire.elevation),
    SLOPE_WIND_SCORE: lookup(SLOPE_SCORES, "slope", fire.slope),
  };
}

export function totalScore(scores: Partial<Scores>): number {
  return round2(Object.values(scores).reduce((sum, s) => sum + s, 0));
}

export function riskBand(total: number): string {
  if (total <= 20) return "Very Low";
  if (total <= 40) return "Low";
  if (total <= 60) return "Moderate";
  if (total <= 80) return "High";
  return "Extreme";
}

export function buildFeatures(fire: FireInputs, weather: WeatherInputs): Record<string, number> {
  const features: Record<string, number> = { ...deriveScores(fire) };
  for (const [key, value] of Object.entries(weather)) {
    if (value !== undefined) features[WEATHER_FEATURES[key as keyof WeatherInputs]] = value;
  }
  return features;
}