import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

const MAP_TIMEOUT_MS = 120_000;

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") || undefined;
  try {
    const result = await callFireTool("fire_danger_map", { date }, { timeoutMs: MAP_TIMEOUT_MS });
    if (!result?.ok) return NextResponse.json({ error: result?.error ?? "Map failed" }, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("fire-danger map failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Map service unavailable" }, { status: 502 });
  }
}
