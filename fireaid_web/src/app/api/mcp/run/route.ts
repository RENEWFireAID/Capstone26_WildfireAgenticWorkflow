import { NextResponse } from "next/server";
import { callFireTool, listFireTools } from "@/lib/mcpClient";
import { getDb } from "@/lib/mongo";

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
    const limit = Number(body?.limit ?? 500);

    // If bbox provided, query MongoDB directly with geo filter
    if (body?.bbox) {
      const { lat_min, lat_max, lng_min, lng_max } = body.bbox;
      const db = await getDb();
      const query: Record<string, any> = {
        LATITUDE:  { $gte: lat_min,  $lte: lat_max },
        LONGITUDE: { $gte: lng_min, $lte: lng_max },
      };
      if (body.yearStart) query.year = { $gte: Number(body.yearStart) };
      if (body.yearEnd)   query.year = { ...query.year, $lte: Number(body.yearEnd) };
      if (body.prescribed === "Y") query.prescribed = "Y";
      if (body.prescribed === "N") query.prescribed = "N";

      const results = await db.collection("fire_points")
        .find(query, { projection: { _id: 0 } })
        .limit(limit)
        .toArray();

      return NextResponse.json({ ok: true, results, count: results.length });
    }

    // Direct MongoDB query (reliable year filtering)
    const db = await getDb();
    const query: Record<string, any> = { year: { $type: "number" } };
    if (body?.yearStart != null) query.year = { ...query.year, $gte: Number(body.yearStart) };
    if (body?.yearEnd   != null) query.year = { ...query.year, $lte: Number(body.yearEnd) };
    const p = body?.prescribed;
    if (p === "Y") query.PRESCRIBEDFIRE = "Y";
    else if (p === "N") query.PRESCRIBEDFIRE = "N";
    const results = await db.collection("fire_points")
      .find(query, { projection: { _id: 0 } })
      .limit(limit)
      .toArray();
    return NextResponse.json({ ok: true, results, count: results.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}