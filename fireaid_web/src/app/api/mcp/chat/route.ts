import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Step 1: LLM parses natural language into query spec
async function parseQuerySpec(userInput: string): Promise<Record<string, any>> {
  const res = await openai.chat.completions.create({
    model: "google/gemini-flash-1.5",
    messages: [
      {
        role: "system",
        content: `You are a wildfire data query parser. Convert natural language into a JSON query spec.
Return ONLY valid JSON with these optional fields:
{
  "year_start": number,
  "year_end": number,
  "prescribed": "Y" | "N" | null,
  "limit": number (default 200, max 1000),
  "general_cause": string | null,
  "fuel_type": string | null
}
Examples:
- "lightning fires in 2022" -> {"year_start": 2022, "year_end": 2022, "general_cause": "Lightning", "limit": 200}
- "prescribed burns last 5 years" -> {"year_start": 2020, "year_end": 2024, "prescribed": "Y", "limit": 200}
- "largest fires 2024" -> {"year_start": 2024, "year_end": 2024, "limit": 500}
Return only JSON, no explanation.`,
      },
      { role: "user", content: userInput },
    ],
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { year_start: 2020, year_end: 2024, limit: 200 };
  }
}

// Step 2: LLM summarizes results into conclusions
async function summarizeResults(
  userInput: string,
  spec: Record<string, any>,
  rows: any[]
): Promise<string> {
  if (rows.length === 0) {
    return "No fire records found matching your query. Try adjusting the filters.";
  }

  const totalAcres = rows.reduce((s: number, r: any) => {
    return s + Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0);
  }, 0);

  const causes: Record<string, number> = {};
  const fuels: Record<string, number> = {};
  const years: Record<string, number> = {};

  rows.forEach((r: any) => {
    const c = r.GENERALCAUSE ?? r.FIRECAUSE ?? "Unknown";
    causes[c] = (causes[c] || 0) + 1;
    const f = r.PRIMARYFUELTYPE ?? "Unknown";
    fuels[f] = (fuels[f] || 0) + 1;
    const y = String(r.year ?? r.FIRESEASON ?? "Unknown");
    years[y] = (years[y] || 0) + 1;
  });

  const topCause = Object.entries(causes).sort((a, b) => b[1] - a[1])[0];
  const topFuel  = Object.entries(fuels).sort((a, b) => b[1] - a[1])[0];
  const topYear  = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  const maxFire  = rows.reduce((m: any, r: any) => {
    return Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0) > Number(m.ESTIMATEDTOTALACRES ?? m.acres ?? 0) ? r : m;
  }, rows[0]);

  const context = `
User asked: "${userInput}"
Query filters: ${JSON.stringify(spec)}
Results summary:
- Total fires found: ${rows.length}
- Total acres burned: ${totalAcres.toLocaleString()}
- Top cause: ${topCause?.[0]} (${topCause?.[1]} fires)
- Top fuel type: ${topFuel?.[0]} (${topFuel?.[1]} fires)
- Most active year: ${topYear?.[0]} (${topYear?.[1]} fires)
- Largest fire: ${maxFire?.NAME ?? "Unknown"} (${Number(maxFire?.ESTIMATEDTOTALACRES ?? maxFire?.acres ?? 0).toLocaleString()} acres)
`;

  const res = await openai.chat.completions.create({
    model: "google/gemini-flash-1.5",
    messages: [
      {
        role: "system",
        content: "You are a wildfire data analyst. Give a concise, insightful summary (3-5 sentences) based on the data. Focus on patterns, notable findings, and answer the user's question directly.",
      },
      { role: "user", content: context },
    ],
  });

  return res.choices[0]?.message?.content ?? "Analysis complete.";
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const body = await req.json();
    const userInput: string = body.message ?? "";

    if (!userInput.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Step 1: Parse natural language -> spec
    const spec = await parseQuerySpec(userInput);

    // Step 2: Query MongoDB via MCP
    const args: Record<string, unknown> = {};
    if (spec.year_start != null) args.year_start = spec.year_start;
    if (spec.year_end   != null) args.year_end   = spec.year_end;
    if (spec.limit      != null) args.limit      = spec.limit;
    if (spec.prescribed != null) args.prescribed = spec.prescribed;

    const result = await callFireTool("query_fire_points", args);
    let rows: any[] = result?.results ?? result?.items ?? (Array.isArray(result) ? result : []);

    // Client-side filter for cause/fuel (MCP may not support these directly)
    if (spec.general_cause) {
      const q = spec.general_cause.toLowerCase();
      rows = rows.filter((r: any) =>
        (r.GENERALCAUSE ?? r.FIRECAUSE ?? "").toLowerCase().includes(q)
      );
    }
    if (spec.fuel_type) {
      const q = spec.fuel_type.toLowerCase();
      rows = rows.filter((r: any) =>
        (r.PRIMARYFUELTYPE ?? "").toLowerCase().includes(q)
      );
    }

    // Step 3: LLM summarizes results
    const summary = await summarizeResults(userInput, spec, rows);

    return NextResponse.json({
      ok: true,
      summary,
      spec,
      results: rows,
      count: rows.length,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}