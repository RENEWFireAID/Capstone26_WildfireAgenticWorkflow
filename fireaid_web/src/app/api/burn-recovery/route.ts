import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";

// The Burn Severity Recovery page reads everything through FireMCP's
// burn_recovery_* tools, which verify the saved study before answering.
const TOOLS = {
  overview: { tool: "burn_recovery_overview", params: ["fire"] },
  imagery: { tool: "burn_recovery_imagery", params: ["fire", "layer", "year", "contrast"] },
  samples: { tool: "burn_recovery_samples", params: ["fire", "period", "model"] },
  diagnostic: { tool: "burn_recovery_diagnostic", params: ["figure"] },
} as const;

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const kind = query.get("kind") as keyof typeof TOOLS | null;
  if (!kind || !(kind in TOOLS)) {
    return NextResponse.json({ error: `kind must be one of ${Object.keys(TOOLS).join(", ")}` }, { status: 400 });
  }

  const { tool, params } = TOOLS[kind];
  const args: Record<string, string> = {};
  for (const p of params) {
    const value = query.get(p);
    if (value) args[p] = value;
  }

  try {
    const result = await callFireTool(tool, args);
    // A tool error comes back as plain text rather than JSON, e.g. an unknown fire.
    if (typeof result === "string") return NextResponse.json({ error: result }, { status: 400 });
    return NextResponse.json(result, {
      // The study is a fixed, saved run, so responses can be cached.
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    console.error("burn-recovery failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "The burn recovery service is unavailable" }, { status: 502 });
  }
}
