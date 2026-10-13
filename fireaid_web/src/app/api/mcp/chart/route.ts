import { NextRequest, NextResponse } from "next/server";
import { buildChart } from "@/lib/chartBuilder";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const result = await buildChart(message);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Chart API error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
