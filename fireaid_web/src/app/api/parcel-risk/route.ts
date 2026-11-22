import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

// The first map load builds every Earth Engine map id and fetches 13 stations live.
export const maxDuration = 120;

async function respond(tool: string, args: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  try {
    const result = await callFireTool(tool, args);
    if (result && result.ok === false) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ...result, ...extra });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}

const validDate = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);

export async function GET(req: Request) {
  const date = validDate(new URL(req.url).searchParams.get("date"));
  return respond("parcel_risk_layers", date ? { date } : {});
}

// The notebook's geocoder: Nominatim, adding ", Fairbanks, AK" unless the text mentions "ak".
async function geocode(q: string) {
  const query = q.toLowerCase().includes("ak") ? q : `${q}, Fairbanks, AK`;
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: "json", limit: "1" })}`;
  const res = await fetch(url, { headers: { "User-Agent": "fnsb_fireaid_app" }, signal: AbortSignal.timeout(10000) });
  const hits = res.ok ? await res.json() : [];
  return hits[0] ? { lat: Number(hits[0].lat), lon: Number(hits[0].lon), address: String(hits[0].display_name) } : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const date = validDate(body?.date);
  const num = (v: unknown) => (v == null || v === "" ? NaN : Number(v));
  const [lat, lon] = [num(body?.lat), num(body?.lon)];
  const args = { date, include_geometry: true };

  if (Number.isFinite(lat) && Number.isFinite(lon)) return respond("parcel_vegetation_at", { lat, lon, ...args });

  const q = typeof body?.query === "string" ? body.query.trim() : "";
  if (!q) return NextResponse.json({ error: "Send lat and lon, or a query" }, { status: 400 });
  if (/^\d+$/.test(q.replace(/-/g, ""))) return respond("parcel_fire_risk", { pan: q, ...args });

  const loc = await geocode(q).catch(() => null);
  if (!loc) return NextResponse.json({ geocoded: false });
  const address = loc.address.split(",")[0];
  return respond("parcel_vegetation_at", { lat: loc.lat, lon: loc.lon, ...args }, { address, point: [loc.lat, loc.lon] });
}
