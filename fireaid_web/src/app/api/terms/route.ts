import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

export async function GET() {
  try {
    const db = await getDb();
    const terms = await db.collection("terms").find({}).sort({ term: 1 }).toArray();
    return NextResponse.json(terms);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { term } = await req.json();
    const db = await getDb();
    const result = await db.collection("terms").findOne({ term });
    if (!result) return NextResponse.json({ error: "Term not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}