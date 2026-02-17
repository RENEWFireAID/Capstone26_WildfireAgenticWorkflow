import { NextResponse } from "next/server";

const MCP_HTTP_BASE =
  process.env.MCP_HTTP_BASE || "http://firemcp:8081";

/* ---------------- GET（旧工具调用） ---------------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        { error: "Missing path" },
        { status: 400 }
      );
    }

    const target = `${MCP_HTTP_BASE}${path}`;
    const r = await fetch(target, { cache: "no-store" });
    const text = await r.text();

    if (!r.ok) {
      return NextResponse.json(
        { error: text },
        { status: r.status }
      );
    }

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

/* ---------------- POST（支持自然语言 + Query Builder） ---------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ 允许 query 为空（Query Builder 会用）
    const query: string =
      typeof body?.query === "string" ? body.query : "";

    // ✅ 透传 spec（Query Builder 核心）
    const spec = body?.spec ?? null;

    // ✅ 保持兼容其它字段（tool / args）
    const payload: any = { query };
    if (spec) payload.spec = spec;
    if (body?.tool) payload.tool = body.tool;
    if (body?.args) payload.args = body.args;

    const r = await fetch(`${MCP_HTTP_BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await r.text();

    if (!r.ok) {
      return NextResponse.json(
        { error: text },
        { status: r.status }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "MCP run failed" },
      { status: 500 }
    );
  }
}
