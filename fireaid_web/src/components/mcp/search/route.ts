import { NextResponse } from "next/server";

const MCP_HTTP_BASE = process.env.MCP_HTTP_BASE || "http://firemcp:8081";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qs = url.searchParams.toString();

    const upstream = `${MCP_HTTP_BASE}/mcp/search${qs ? `?${qs}` : ""}`;
    const r = await fetch(upstream, { cache: "no-store" });

    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json({ error: text }, { status: r.status });
    }

    // upstream 返回 json
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
