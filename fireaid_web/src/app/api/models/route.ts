import { NextResponse } from "next/server";
import { modelsFor } from "@/lib/models";

export async function GET() {
  return NextResponse.json({
    agent: modelsFor("agent"),
    fireHistory: modelsFor("fireHistory"),
    fireRisk: modelsFor("fireRisk"),
  });
}
