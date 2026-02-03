import { NextResponse } from "next/server";

const MCP_HTTP_BASE = process.env.MCP_HTTP_BASE || "http://firemcp:8081";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path"); // e.g. "/mcp/search?year=2024..."
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const target = `${MCP_HTTP_BASE}${path}`;
    const r = await fetch(target, { cache: "no-store" });

    const text = await r.text();
    if (!r.ok) return NextResponse.json({ error: text }, { status: r.status });

    // FireMCP 返回 json 字符串
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "fetch failed" },
      { status: 500 }
    );
  }
}
