import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { callFireTool } from "@/lib/mcpClient";

export const maxDuration = 300;

/**
 * GET ?years=2023,2024   -> { url } satellite embedding tiles
 * GET ?start&end         -> { strikes, points } between two dates (YYYY-MM-DD)
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    if (params.has("years")) {
      const years = params.get("years")!.split(",").map(Number);
      return NextResponse.json(await callFireTool("lightning_embedding_layer", { years }));
    }

    const start = Date.parse(params.get("start") ?? "");
    const range = { $gte: start, $lt: Date.parse(params.get("end") ?? "") + 86_400_000 };
    const db = await getDb();

    const [strikes, points] = await Promise.all([
      db.collection("lightning_strikes").find({ LOCALDATET: range }, { projection: { _id: 0, LAT: 1, LON: 1 } }).toArray(),
      db.collection("lightning_fire_points").find(
        { DISCOVERYDATETIME: range },
        { projection: { _id: 0, NAME: 1, FIRESEASON: 1, GENERALCAUSE: 1, ESTIMATEDTOTALACRES: 1, geometry: 1 } },
      ).toArray(),
    ]);

    return NextResponse.json({
      strikes: strikes.map((s) => [s.LAT, s.LON]),
      points: {
        type: "FeatureCollection",
        features: points.map(({ geometry, ...properties }) => ({ type: "Feature", properties, geometry })),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}
