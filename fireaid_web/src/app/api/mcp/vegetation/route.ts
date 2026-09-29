import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

// A cold Earth Engine query takes 5-60s; cached ones return immediately.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { error: "lat and lon are required numbers" },
        { status: 400 }
      );
    }

    const args: Record<string, unknown> = { lat, lon };
    if (body?.startYear != null) args.start_year = Number(body.startYear);
    if (body?.endYear   != null) args.end_year   = Number(body.endYear);

    const result = await callFireTool("get_vegetation_timeseries", args);

    // The tool reports its own failures in the payload rather than throwing,
    // so surface that message instead of a generic 500.
    if (result && result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
