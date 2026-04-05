/**
 * Wildfire Prediction API — Polynomial Regression (degree 2) with Linear fallback
 *
 * Linear Regression (OLS) baseline:
 *   ŷ = β₁x + β₀
 *   β₁ = (n·ΣxᵢYᵢ - Σxᵢ·ΣYᵢ) / (n·Σxᵢ² - (Σxᵢ)²)
 *   β₀ = (ΣYᵢ - β₁·Σxᵢ) / n
 *
 * Polynomial Regression (degree 2):
 *   ŷ = β₂x² + β₁x + β₀
 *   Solved via Normal Equations: (XᵀX)β = XᵀY
 *
 * Model selection: use polynomial if R² > 0.3, otherwise fall back to linear
 *
 * R² = 1 - SS_res / SS_tot
 */

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

function polynomialRegression(points: { x: number; y: number }[], degree = 2) {
  const n = points.length;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const size = degree + 1;
  const XtX: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const XtY: number[] = Array(size).fill(0);
  for (let i = 0; i < n; i++) {
    const row = Array.from({ length: size }, (_, k) => Math.pow(xs[i], k));
    for (let r = 0; r < size; r++) {
      XtY[r] += row[r] * ys[i];
      for (let c = 0; c < size; c++) XtX[r][c] += row[r] * row[c];
    }
  }
  const aug = XtX.map((row, i) => [...row, XtY[i]]);
  for (let col = 0; col < size; col++) {
    let maxRow = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    for (let row = col + 1; row < size; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let k = col; k <= size; k++) aug[row][k] -= factor * aug[col][k];
    }
  }
  const beta = Array(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    beta[i] = aug[i][size] / aug[i][i];
    for (let k = i - 1; k >= 0; k--) aug[k][size] -= aug[k][i] * beta[i];
  }
  const predict = (x: number) => beta.reduce((sum, b, k) => sum + b * Math.pow(x, k), 0);
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const ssTot = ys.reduce((s, y) => s + Math.pow(y - meanY, 2), 0);
  const ssRes = ys.reduce((s, y, i) => s + Math.pow(y - predict(xs[i]), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { predict, r2, beta };
}

const FIELD_SCHEMA = `
Available fields in fire_points collection:
- GENERALCAUSE (string): e.g. "Lightning", "Human", "Undetermined"
- SPECIFICCAUSE (string): e.g. "Campfire", "Smoking", "Equipment Use"
- PRESCRIBEDFIRE (string): "Y" or "N"
- PRIMARYFUELTYPE (string): e.g. "Tundra", "Mixed Trees", "Shrub"
- MGMTORGID (string): e.g. "DOF", "BLM", "NPS", "USFS"
- ESTIMATEDTOTALACRES (number): total burned acres
- OWNERKIND (string): e.g. "Federal", "State", "Private"
- ORIGINFUELTYPE (string): fuel type at origin
`;

type DynamicFilter = {
  field: string;
  operator: "equals" | "contains" | "gte" | "lte";
  value: string | number;
} | null;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const body = await req.json();
    let targetYears: number[] = body.targetYears ?? [2025, 2026, 2027];
    let focus: string = body.focus ?? "general";
    const message: string = body.message ?? "";
    let dynamicFilter: DynamicFilter = null;
    let filterDescription = "all fires";

    if (message.trim()) {
      const parseRes = await openai.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
        messages: [
          {
            role: "system",
            content: `You are a wildfire query parser. Parse the user's prediction request and return ONLY JSON:
{
  "targetYears": [2025] or [2025,2026] or [2025,2026,2027],
  "focus": "general" | "lightning" | "prescribed" | "large" | "custom",
  "filter": null | {
    "field": "GENERALCAUSE" | "SPECIFICCAUSE" | "PRESCRIBEDFIRE" | "PRIMARYFUELTYPE" | "MGMTORGID" | "ESTIMATEDTOTALACRES" | "OWNERKIND",
    "operator": "equals" | "contains" | "gte" | "lte",
    "value": "string or number"
  },
  "filterDescription": "human-readable description of the filter"
}

${FIELD_SCHEMA}

Examples:
- "predict lightning fires 2025-2027" -> {"targetYears":[2025,2026,2027],"focus":"lightning","filter":{"field":"GENERALCAUSE","operator":"contains","value":"Lightning"},"filterDescription":"lightning-caused fires"}
- "forecast campfire fires" -> {"targetYears":[2025,2026],"focus":"custom","filter":{"field":"SPECIFICCAUSE","operator":"contains","value":"Campfire"},"filterDescription":"campfire-caused fires"}
- "predict tundra fires" -> {"targetYears":[2025,2026,2027],"focus":"custom","filter":{"field":"PRIMARYFUELTYPE","operator":"contains","value":"Tundra"},"filterDescription":"tundra fuel fires"}
- "DOF managed fires prediction" -> {"targetYears":[2025,2026],"focus":"custom","filter":{"field":"MGMTORGID","operator":"equals","value":"DOF"},"filterDescription":"DOF-managed fires"}
- "fires over 500 acres" -> {"targetYears":[2025,2026,2027],"focus":"custom","filter":{"field":"ESTIMATEDTOTALACRES","operator":"gte","value":500},"filterDescription":"fires over 500 acres"}
- "predict all fires 2025" -> {"targetYears":[2025],"focus":"general","filter":null,"filterDescription":"all fires"}

Return ONLY valid JSON.`
          },
          { role: "user", content: message }
        ]
      });

      try {
        const parsed = JSON.parse(
          parseRes.choices[0]?.message?.content?.replace(/```json|```/g, "").trim() ?? "{}"
        );
        if (parsed.targetYears) targetYears = parsed.targetYears;
        if (parsed.focus) focus = parsed.focus;
        if (parsed.filter) dynamicFilter = parsed.filter;
        if (parsed.filterDescription) filterDescription = parsed.filterDescription;
      } catch {}
    } else {
      if (focus === "lightning")  { dynamicFilter = { field: "GENERALCAUSE", operator: "contains", value: "Lightning" }; filterDescription = "lightning-caused fires"; }
      if (focus === "prescribed") { dynamicFilter = { field: "PRESCRIBEDFIRE", operator: "equals", value: "Y" }; filterDescription = "prescribed burns"; }
      if (focus === "large")      { dynamicFilter = { field: "ESTIMATEDTOTALACRES", operator: "gte", value: 1000 }; filterDescription = "large fires (>1000 acres)"; }
    }

    const result = await callFireTool("query_fire_points", {
      year_start: 1939,
      year_end: 2024,
      limit: 33596,
    });
    const rows: any[] = result?.results ?? result?.items ?? (Array.isArray(result) ? result : []);

    const filteredRows = dynamicFilter ? rows.filter((r: any) => {
      const fieldVal = r[dynamicFilter!.field];
      if (fieldVal === undefined || fieldVal === null) return false;
      const strVal = String(fieldVal);
      const filterVal = dynamicFilter!.value;
      switch (dynamicFilter!.operator) {
        case "equals":   return strVal.toLowerCase() === String(filterVal).toLowerCase();
        case "contains": return strVal.toLowerCase().includes(String(filterVal).toLowerCase());
        case "gte":      return Number(fieldVal) >= Number(filterVal);
        case "lte":      return Number(fieldVal) <= Number(filterVal);
        default:         return true;
      }
    }) : rows;

    const yearCounts: Record<number, number> = {};
    const yearAcres: Record<number, number> = {};
    const causeCounts: Record<string, number> = {};
    const fuelCounts: Record<string, number> = {};

    filteredRows.forEach((r: any) => {
      const y = Number(r.year ?? r.FIRESEASON ?? 0);
      if (!y) return;
      yearCounts[y] = (yearCounts[y] || 0) + 1;
      yearAcres[y]  = (yearAcres[y]  || 0) + Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0);
      const c = r.GENERALCAUSE ?? r.FIRECAUSE ?? "Unknown";
      causeCounts[c] = (causeCounts[c] || 0) + 1;
      const f = r.PRIMARYFUELTYPE ?? "Unknown";
      fuelCounts[f] = (fuelCounts[f] || 0) + 1;
    });

    const historicalYears = Object.keys(yearCounts).map(Number).sort();
    const historicalData  = historicalYears.map(y => ({
      year: y,
      count: yearCounts[y],
      acres: Math.round(yearAcres[y] ?? 0),
    }));

    const countPoints = historicalData.map(d => ({ x: d.year, y: d.count }));
    const acresPoints = historicalData.map(d => ({ x: d.year, y: d.acres }));

    const countPoly = polynomialRegression(countPoints, 2);
    const acresPoly = polynomialRegression(acresPoints, 2);
    const countLin  = linearRegression(countPoints);
    const acresLin  = linearRegression(acresPoints);

    // Use polynomial if R² > 0.3, otherwise fall back to linear
    const usePolyCount = countPoly.r2 > 0.3;
    const usePolyAcres = acresPoly.r2 > 0.3;

    const predictions = targetYears.map(y => ({
      year: y,
      predictedCount: Math.max(0, Math.round(
        usePolyCount ? countPoly.predict(y) : countLin.slope * y + countLin.intercept
      )),
      predictedAcres: Math.max(0, Math.round(
        usePolyAcres ? acresPoly.predict(y) : acresLin.slope * y + acresLin.intercept
      )),
    }));

    const topCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topFuels  = Object.entries(fuelCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const bestR2 = Math.max(countPoly.r2, countLin.r2);

    const context = `
Historical wildfire data (Alaska, 1939-2024):
- Filter applied: ${filterDescription} (${filteredRows.length} matching records out of ${rows.length} total)
- Model used: ${usePolyCount ? "Polynomial (degree 2)" : "Linear"} regression
- Year range in filtered data: ${historicalYears[0]} to ${historicalYears[historicalYears.length - 1]}
- Fire count trend (linear slope): ${countLin.slope.toFixed(2)} fires/year
- Best model R²: ${bestR2.toFixed(2)} (fire count)
- Top causes: ${topCauses.map(([k,v]) => `${k}(${v})`).join(", ")}
- Top fuel types: ${topFuels.map(([k,v]) => `${k}(${v})`).join(", ")}
- Predictions for ${filterDescription}: ${predictions.map(p => `${p.year}: ~${p.predictedCount} fires, ~${(p.predictedAcres/1000).toFixed(1)}K acres`).join("; ")}
`;

    const aiRes = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "system",
          content: `You are a wildfire risk analyst for Alaska. Based on historical data and statistical trends, provide:
1. A 3-4 sentence overall trend analysis specific to the filter applied
2. Key risk factors for the predicted years
3. Specific recommendations for fire management
Be data-driven, specific, and actionable. Mention the R² value and whether polynomial or linear regression was used.`,
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
        count: { slope: countLin.slope, r2: bestR2 },
        acres: { slope: acresLin.slope, r2: usePolyAcres ? acresPoly.r2 : acresLin.r2 },
      },
      topCauses: topCauses.map(([label, value]) => ({ label, value })),
      topFuels:  topFuels.map(([label, value])  => ({ label, value })),
      analysis,
      totalRecords: filteredRows.length,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}