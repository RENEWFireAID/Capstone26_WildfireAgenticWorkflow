import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

// A cold Earth Engine trend query takes 20-60s; FireMCP gives up at 120s.
export const maxDuration = 300;
const TIMEOUT_MS = 180_000;

const TOOLS = {
  map: "forest_trend_map",
  downloads: "forest_trend_downloads",
  fires: "fire_history_at_point",
} as const;

type Kind = keyof typeof TOOLS;

/** POST { kind: "map" | "downloads" | "fires", ...tool arguments } */
export async function POST(req: Request) {
  try {
    const { kind, ...args } = await req.json();
    if (!(kind in TOOLS)) {
      return NextResponse.json({ error: `kind must be one of ${Object.keys(TOOLS).join(", ")}` }, { status: 400 });
    }

    const result = await callFireTool(TOOLS[kind as Kind], args, { timeoutMs: TIMEOUT_MS });

    // FireMCP reports bad input and Earth Engine failures in the payload.
    if (typeof result === "string") return NextResponse.json({ error: result }, { status: 400 });
    if (result?.ok === false) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
