import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";
import { MODELS, buildFeatures, type FireInputs, type WeatherInputs } from "@/lib/fireRiskScores";

const WEATHER_FIELDS = ["maxTemp", "minTemp", "precip", "wind"] as const;

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

const STRING_FIELDS = ["slope", "aspect", "elevation", "cause"] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const input = isRecord(body) ? body : {};
  const model = input.model;
  if (!MODELS.some((m) => m.id === model)) return badRequest(`Unknown model: ${model}`);

  if (!isRecord(input.fire)) return badRequest("fire is required");
  const fire = input.fire as FireInputs;
  const weather = (isRecord(input.weather) ? input.weather : {}) as WeatherInputs;
  if (!Number.isFinite(fire.month)) return badRequest("month must be a number");
  // Weather fields may be left out; the tool fills them with the month's median.
  for (const field of WEATHER_FIELDS) {
    if (weather[field] !== undefined && !Number.isFinite(weather[field])) {
      return badRequest(`${field} must be a number`);
    }
  }
  for (const field of STRING_FIELDS) {
    if (typeof fire[field] !== "string") return badRequest(`${field} must be a string`);
  }

  let features: Record<string, number>;
  try {
    features = buildFeatures(fire, weather);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : String(e));
  }

  try {
    const result = await callFireTool("predict_fire_risk", { features, model, month: fire.month });
    if (!result?.ok) throw new Error(result?.error ?? "prediction failed");
    return NextResponse.json({
      ok: true,
      model: result.model,
      category: result.category,
      confidence: result.confidence,
      probabilities: result.probabilities,
      defaulted: result.defaulted,
    });
  } catch (e) {
    console.error("fire-risk prediction failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Prediction service unavailable" }, { status: 502 });
  }
}
