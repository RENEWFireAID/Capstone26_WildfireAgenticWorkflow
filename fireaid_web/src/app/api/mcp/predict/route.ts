import { NextResponse } from "next/server";
import { callFireTool } from "@/lib/mcpClient";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const body = await req.json();
    let targetYears: number[] = body.targetYears ?? [2025, 2026, 2027];
    let focus: string = body.focus ?? "general";
    const message: string = body.message ?? "";

    // Parse natural language if provided
    if (message.trim()) {
      const parseRes = await openai.chat.completions.create({
        model: "google/gemini-flash-1.5",
        messages: [
          {
            role: "system",
            content: `Parse this wildfire prediction request and return ONLY JSON:
{
  "targetYears": [2025] or [2025,2026] or [2025,2026,2027],
  "focus": "general" | "lightning" | "prescribed" | "large"
}
Examples:
- "predict 2025-2027" -> {"targetYears":[2025,2026,2027],"focus":"general"}
- "lightning fires next year" -> {"targetYears":[2025],"focus":"lightning"}
- "prescribed burns forecast" -> {"targetYears":[2025,2026],"focus":"prescribed"}
Return only JSON.`
          },
          { role: "user", content: message }
        ]
      });
      try {
        const parsed = JSON.parse(parseRes.choices[0]?.message?.content?.replace(/```json|```/g,"").trim() ?? "{}");
        if (parsed.targetYears) targetYears = parsed.targetYears;
        if (parsed.focus) focus = parsed.focus;
      } catch {}
    }

    // Fetch historical data (2010-2024)
    const result = await callFireTool("query_fire_points", {
      year_start: 2010,
      year_end: 2024,
      limit: 2000,
    });
    const rows: any[] = result?.results ?? result?.items ?? (Array.isArray(result) ? result : []);

    // Group by year
    const yearCounts: Record<number, number> = {};
    const yearAcres: Record<number, number> = {};
    const causeCounts: Record<string, number> = {};
    const fuelCounts: Record<string, number> = {};

    rows.forEach((r: any) => {
      const y = Number(r.year ?? r.FIRESEASON ?? 0);
      if (!y) return;
      yearCounts[y] = (yearCounts[y] || 0) + 1;
      yearAcres[y] = (yearAcres[y] || 0) + Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0);
      const c = r.GENERALCAUSE ?? r.FIRECAUSE ?? "Unknown";
      causeCounts[c] = (causeCounts[c] || 0) + 1;
      const f = r.PRIMARYFUELTYPE ?? "Unknown";
      fuelCounts[f] = (fuelCounts[f] || 0) + 1;
    });

    // Historical trend data
    const historicalYears = Object.keys(yearCounts).map(Number).sort();
    const historicalData = historicalYears.map(y => ({
      year: y,
      count: yearCounts[y],
      acres: Math.round(yearAcres[y] ?? 0),
    }));

    // Linear regression on fire counts
    const countPoints = historicalData.map(d => ({ x: d.year, y: d.count }));
    const countReg = linearRegression(countPoints);

    const acresPoints = historicalData.map(d => ({ x: d.year, y: d.acres }));
    const acresReg = linearRegression(acresPoints);

    // Predictions
    const predictions = targetYears.map(y => ({
      year: y,
      predictedCount: Math.max(0, Math.round(countReg.slope * y + countReg.intercept)),
      predictedAcres: Math.max(0, Math.round(acresReg.slope * y + acresReg.intercept)),
    }));

    // Top causes and fuels
    const topCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topFuels  = Object.entries(fuelCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // LLM analysis
    const context = `
Historical wildfire data (Alaska, 2010-2024):
- Total records analyzed: ${rows.length}
- Year range: ${historicalYears[0]} to ${historicalYears[historicalYears.length - 1]}
- Fire count trend: slope = ${countReg.slope.toFixed(2)} fires/year (R²=${countReg.r2.toFixed(2)})
- Acres trend: slope = ${acresReg.slope.toFixed(0)} acres/year
- Top causes: ${topCauses.map(([k,v]) => `${k}(${v})`).join(", ")}
- Top fuel types: ${topFuels.map(([k,v]) => `${k}(${v})`).join(", ")}
- Predictions: ${predictions.map(p => `${p.year}: ~${p.predictedCount} fires, ~${(p.predictedAcres/1000).toFixed(1)}K acres`).join("; ")}
- Focus area: ${focus}
`;

    const aiRes = await openai.chat.completions.create({
      model: "google/gemini-flash-1.5",
      messages: [
        {
          role: "system",
          content: `You are a wildfire risk analyst. Based on historical data and statistical trends, provide:
1. A 3-4 sentence overall trend analysis
2. Key risk factors for the predicted years
3. Specific recommendations for fire management
Be data-driven, specific, and actionable. Mention the R² value to indicate prediction confidence.`,
        },
        { role: "user", content: context },
      ],
    });

    const analysis = aiRes.choices[0]?.message?.content ?? "Analysis unavailable.";

    return NextResponse.json({
      ok: true,
      historical: historicalData,
      predictions,
      regression: {
        count: { slope: countReg.slope, intercept: countReg.intercept, r2: countReg.r2 },
        acres: { slope: acresReg.slope, intercept: acresReg.intercept, r2: acresReg.r2 },
      },
      topCauses: topCauses.map(([label, value]) => ({ label, value })),
      topFuels:  topFuels.map(([label, value])  => ({ label, value  })),
      analysis,
      totalRecords: rows.length,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}