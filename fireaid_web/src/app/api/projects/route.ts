import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const projects = await db.collection("projects").find({}).sort({ updatedAt: -1 }).toArray();
    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, tag } = await req.json();
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    const db = await getDb();
    const doc = { title, description: description || "", tag: tag || "General", createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection("projects").insertOne(doc);
    return NextResponse.json({ ...doc, _id: result.insertedId });
  } catch {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const db = await getDb();
    await db.collection("projects").deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}