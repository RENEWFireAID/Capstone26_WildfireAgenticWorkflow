import { NextResponse } from "next/server";

const MCP_HTTP_BASE = process.env.MCP_HTTP_BASE || "http://mcp-api:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { toolId, args }

    const r = await fetch(`${MCP_HTTP_BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: text }, { status: r.status });
    }

    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("MCP /run fetch failed:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to run tool" },
      { status: 500 }
    );
  }
}
