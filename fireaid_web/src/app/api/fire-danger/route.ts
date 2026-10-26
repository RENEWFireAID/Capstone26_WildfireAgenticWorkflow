import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const input = isRecord(body) ? body : {};
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "latitude and longitude are required" }, { status: 400 });
  }
  const date = typeof input.date === "string" && input.date ? input.date : undefined;

  try {
    const result = await callFireTool("fire_danger_forecast", { latitude, longitude, date });
    if (!result?.ok) return NextResponse.json({ error: result?.error ?? "Forecast failed" }, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("fire-danger forecast failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Forecast service unavailable" }, { status: 502 });
  }
}
