import { NextResponse } from "next/server";

// ✅ Docker 内：用服务名 mcp-api
// ✅ 本机 pnpm dev：你可以在 .env.local 里设 MCP_HTTP_BASE=http://localhost:8000
const MCP_HTTP_BASE = process.env.MCP_HTTP_BASE || "http://mcp-api:8000";

export async function GET() {
  try {
    const r = await fetch(`${MCP_HTTP_BASE}/tools`, { cache: "no-store" });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: text }, { status: r.status });
    }

    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("MCP /tools fetch failed:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to fetch tools" },
      { status: 500 }
    );
  }
}
