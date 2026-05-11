import { NextResponse } from "next/server";

const RAG_BASE =
  (process.env.RAG_API_URL ?? "http://host.docker.internal:8000/api/retrieve")
    .replace(/\/api\/retrieve$/, "");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const month = searchParams.get("month");

  if (!year || !month) {
    return NextResponse.json(
      { error: "year and month query params are required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${RAG_BASE}/api/future-predictions?year=${year}&month=${month}`
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `ML service error: ${text}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to reach ML service" },
      { status: 500 }
    );
  }
}
