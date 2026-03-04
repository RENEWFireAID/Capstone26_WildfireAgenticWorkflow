import { NextResponse } from "next/server";
import { callFireTool, listFireTools } from "@/lib/mcpClient";

export async function GET() {
  try {
    const tools = await listFireTools();
    return NextResponse.json({ ok: true, tools });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const toolName = body?.tool ?? "query_fire_points";
    const args: Record<string, unknown> = {};
    if (body?.yearStart != null) args.year_start = Number(body.yearStart);
    if (body?.yearEnd   != null) args.year_end   = Number(body.yearEnd);
    if (body?.limit     != null) args.limit      = Number(body.limit);
    const p = body?.prescribed;
    if (p === "Y" || p === "yes") args.prescribed = "Y";
    else if (p === "N" || p === "no") args.prescribed = "N";
    if (body?.args && typeof body.args === "object") Object.assign(args, body.args);
    const result = await callFireTool(toolName, args);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
