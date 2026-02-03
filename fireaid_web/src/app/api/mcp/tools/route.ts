import { NextResponse } from "next/server";

const MCP_HTTP_BASE = process.env.MCP_HTTP_BASE || "http://firemcp:8081";

export async function GET() {
  try {
    const r = await fetch(`${MCP_HTTP_BASE}/mcp/tools`, {
      cache: "no-store",
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: text }, { status: r.status });
    }

    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("MCP /mcp/tools fetch failed:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to fetch tools" },
      { status: 500 }
    );
  }
}
