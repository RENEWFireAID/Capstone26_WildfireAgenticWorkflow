import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const doc = {
      name: body.name || "Anonymous",
      email: body.email || "",
      overallRating: body.overallRating,
      uiClarity: body.uiClarity,
      dataEase: body.dataEase,
      feedback: body.feedback || "",
      suggestions: body.suggestions || "",
      createdAt: new Date(),
    };
    const db = await getDb();
    await db.collection("feedback").insertOne(doc);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = await getDb();
    const feedbacks = await db.collection("feedback").find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(feedbacks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}