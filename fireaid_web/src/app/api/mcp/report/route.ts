import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY)
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });

    const { fires, query } = await req.json();
    if (!fires?.length) return NextResponse.json({ error: "No fire data" }, { status: 400 });

    const totalAcres = fires.reduce((s: number, r: any) => s + Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0), 0);
    const causes: Record<string, number> = {};
    const fuels: Record<string, number> = {};
    const years: Record<string, number> = {};
    fires.forEach((r: any) => {
      const c = r.GENERALCAUSE ?? r.FIRECAUSE ?? "Unknown";
      causes[c] = (causes[c] || 0) + 1;
      const f = r.PRIMARYFUELTYPE ?? "Unknown";
      fuels[f] = (fuels[f] || 0) + 1;
      const y = String(r.year ?? r.FIRESEASON ?? "Unknown");
      years[y] = (years[y] || 0) + 1;
    });
    const topCause = Object.entries(causes).sort((a,b) => b[1]-a[1])[0];
    const topFuel  = Object.entries(fuels).sort((a,b) => b[1]-a[1])[0];
    const topYear  = Object.entries(years).sort((a,b) => b[1]-a[1])[0];
    const largest  = fires.reduce((m: any, r: any) =>
      Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0) > Number(m.ESTIMATEDTOTALACRES ?? m.acres ?? 0) ? r : m, fires[0]);

    const context = `
Query: ${query || "General wildfire search"}
Total fires: ${fires.length}
Total acres: ${totalAcres.toLocaleString()}
Top cause: ${topCause?.[0]} (${topCause?.[1]} fires)
Top fuel: ${topFuel?.[0]} (${topFuel?.[1]} fires)
Most active year: ${topYear?.[0]} (${topYear?.[1]} fires)
Largest fire: ${largest?.NAME ?? "Unknown"} (${Number(largest?.ESTIMATEDTOTALACRES ?? 0).toLocaleString()} acres)
Prescribed: ${fires.filter((r: any) => (r.PRESCRIBEDFIRE ?? r.prescribed) === "Y").length}
Sample: ${fires.slice(0,5).map((r: any) => r.NAME).filter(Boolean).join(", ")}
`;

    const res = await openai.chat.completions.create({
      model: "google/gemini-flash-1.5",
      messages: [
        {
          role: "system",
          content: `Generate a professional wildfire incident report with these exact sections:

EXECUTIVE SUMMARY
KEY FINDINGS
CAUSE ANALYSIS
FUEL & TERRAIN ANALYSIS
TEMPORAL ANALYSIS
RISK ASSESSMENT
RECOMMENDATIONS

Be specific, data-driven, and professional.`,
        },
        { role: "user", content: context },
      ],
    });

    const report = res.choices[0]?.message?.content ?? "Report generation failed.";
    return NextResponse.json({
      ok: true, report,
      stats: { totalFires: fires.length, totalAcres, topCause: topCause?.[0], topFuel: topFuel?.[0], topYear: topYear?.[0] }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}