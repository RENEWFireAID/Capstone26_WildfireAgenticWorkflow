import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

// Building the Earth Engine map ids can take a while the first time.
export const maxDuration = 120;

async function respond(tool: string, args: Record<string, unknown>) {
  try {
    const result = await callFireTool(tool, args);
    if (result && result.ok === false) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return respond("parcel_risk_layers", {});
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const num = (v: unknown) => (v == null || v === "" ? NaN : Number(v));
  const [lat, lon, pan] = [num(body?.lat), num(body?.lon), num(body?.pan)];

  if (Number.isFinite(lat) && Number.isFinite(lon)) return respond("parcel_vegetation_at", { lat, lon });
  if (Number.isInteger(pan)) return respond("parcel_fire_risk", { pan, include_geometry: true });
  return NextResponse.json({ error: "Send lat and lon, or a numeric pan" }, { status: 400 });
}
