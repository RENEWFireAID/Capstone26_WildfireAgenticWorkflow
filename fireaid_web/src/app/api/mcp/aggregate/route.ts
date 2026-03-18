import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

// Safety check: block any write operations
function isSafeAggregation(pipeline: any[]): boolean {
  const BLOCKED = ["$out", "$merge", "$indexStats", "$collStats", "$currentOp", "$listSessions"];
  return pipeline.every(stage =>
    !Object.keys(stage).some(k => BLOCKED.includes(k))
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pipeline = body?.pipeline;

    if (!Array.isArray(pipeline)) {
      return NextResponse.json({ error: "pipeline must be an array" }, { status: 400 });
    }

    if (!isSafeAggregation(pipeline)) {
      return NextResponse.json({ error: "Pipeline contains blocked operations" }, { status: 403 });
    }

    // Add a safety limit if not already present
    const hasLimit = pipeline.some(s => "$limit" in s);
    const safePipeline = hasLimit ? pipeline : [...pipeline, { $limit: 1000 }];

    const db = await getDb();
    const results = await db.collection("fire_points").aggregate(safePipeline).toArray();

    return NextResponse.json({ ok: true, results, count: results.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Aggregation failed" }, { status: 500 });
  }
}
