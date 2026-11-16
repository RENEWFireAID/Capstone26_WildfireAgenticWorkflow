// * Overrall Request Flow:
// 1. User sends a natrual language question
// 2. Claude (1st call) -> Coverts natrual language question into a MongoDB aggregation pipeline (check aggregation safety! No $out, $merge, etc. allowed)
// 3. Internal API call -> Executes the pipeline against MongoDB and returns real data 
// 4. Claude (2nd call) -> Analyzes the real data and answers the user's question in plain English
// 5. Return the final answer to the frontend, along with any relevant metadata about the tools used (e.g. record count)
//    and, when the results suit one, a chart drawn from the same rows the answer was written from
// * Note: MongoDB aggregation pipelines: Raw Data -> $match ->$group -> $sort -> $limit -> Final Results

import { NextResponse } from "next/server";
import { MODELS } from "@/lib/models";
import { clampData, toChartData, type ChartSpec } from "@/lib/chartBuilder";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = MODELS.fireHistory;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

type ChartPlan = { type: ChartSpec["type"]; labelField: string; valueField: string; title: string };

const CHART_TYPES = ["bar", "line", "pie", "scatter"];

// Draw the chart from every row the query returned, not just the 50 the model reads.
function buildChart(plan: ChartPlan | null, results: Record<string, any>[]): ChartSpec | null {
  if (!plan || !CHART_TYPES.includes(plan.type) || results.length < 2) return null;
  const data = toChartData(results, plan.labelField, plan.valueField);
  if (data.some((d) => !Number.isFinite(d.value))) return null;
  const clamped = clampData(plan.type, data, "");
  return {
    type: plan.type,
    title: plan.title,
    description: clamped.description.trim(),
    data: clamped.data,
    xKey: "label",
    yKey: "value",
  };
}

async function queryDatabase(userMessage: string): Promise<{ dbResults: string; chart: ChartSpec | null }> {

  // ============================================================
  // PART 2 — Claude (1st Call): Natural Language → MongoDB Pipeline
  // Ask Claude to generate a MongoDB aggregation pipeline based
  // on the user's question, plus a chart plan when a chart would
  // help. Returns ONLY a raw JSON object.
  // ============================================================
  const planRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 768,
      messages: [
        {
          role: "system",
          content: `You are a MongoDB query generator for an Alaska wildfire database.
Collection: fire_points
Fields: year (number), NAME (string), GENERALCAUSE (string), SPECIFICCAUSE (string), ESTIMATEDTOTALACRES (number), LATITUDE (number), LONGITUDE (number), PRESCRIBEDFIRE (string Y/N), MGMTORGID (string), ORIGINFUELTYPE (string), PRIMARYFUELTYPE (string), OWNERKIND (string), FIRESEASON (string).

Given a user question, return ONLY a JSON object, no explanation, no markdown:
{"pipeline": [...MongoDB aggregation pipeline...], "chart": null or {"type": "bar"|"line"|"pie"|"scatter", "labelField": "...", "valueField": "...", "title": "..."}}

Set "chart" when the user asks for a chart, graph, plot, trend or breakdown, or when the result is a series of several labelled numbers (counts or acres by year, cause, agency...). Use "line" for values over years, "bar" to compare categories, "pie" for shares of a whole. labelField and valueField must be fields in the pipeline output. Set "chart" to null for a single number or a list of individual fires.

Examples:
- "how many fires in 2004" -> {"pipeline":[{"$match":{"year":2004}},{"$count":"total"}],"chart":null}
- "fires by cause" -> {"pipeline":[{"$group":{"_id":"$GENERALCAUSE","count":{"$sum":1}}},{"$sort":{"count":-1}}],"chart":{"type":"bar","labelField":"_id","valueField":"count","title":"Fires by general cause"}}
- "acres burned per year since 2000" -> {"pipeline":[{"$match":{"year":{"$gte":2000}}},{"$group":{"_id":"$year","acres":{"$sum":"$ESTIMATEDTOTALACRES"}}},{"$sort":{"_id":1}}],"chart":{"type":"line","labelField":"_id","valueField":"acres","title":"Acres burned per year, 2000 onward"}}
- "largest fires" -> {"pipeline":[{"$sort":{"ESTIMATEDTOTALACRES":-1}},{"$limit":10},{"$project":{"NAME":1,"ESTIMATEDTOTALACRES":1,"year":1,"GENERALCAUSE":1}}],"chart":null}`,
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const planData = await planRes.json();
  const planText = planData?.choices?.[0]?.message?.content ?? "[]";

  // Parse Claude's response. A bare array is still accepted as a pipeline with no chart.
  let pipeline;
  let chartPlan: ChartPlan | null = null;
  try {
    const plan = JSON.parse(planText.replace(/```json|```/g, "").trim());
    pipeline = Array.isArray(plan) ? plan : plan.pipeline;
    chartPlan = Array.isArray(plan) ? null : plan.chart ?? null;
  } catch {
    return { dbResults: "[]", chart: null };
  }

  // ============================================================
  // PART 3 — Internal API Call: Execute the MongoDB Query
  // Send the generated pipeline to our internal /api/mcp/aggregate
  // route, which runs it against the real MongoDB database.
  // Limit results to 50 records to avoid overflowing the AI context.
  // ============================================================
  const dbRes = await fetch(`${BASE_URL}/api/mcp/aggregate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipeline }),
  });

  const dbData = await dbRes.json();
  if (!dbData.ok) return { dbResults: JSON.stringify({ error: dbData.error }), chart: null };
  return {
    dbResults: JSON.stringify({ count: dbData.count, results: dbData.results.slice(0, 50) }),
    chart: buildChart(chartPlan, dbData.results),
  };
}

export async function POST(req: Request) {
  try {
    // ============================================================
    // PART 3.1 — Receive & Validate the User's Question
    // Parse the incoming request, extract the user message and
    // conversation history. Reject empty messages immediately.
    // ============================================================
    const body = await req.json();
    const userMessage: string = body.message ?? "";
    if (!userMessage.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const history: { role: string; content: string }[] = body.history ?? [];

    // Step 1: Query the database
    const { dbResults, chart } = await queryDatabase(userMessage);
    const parsed = JSON.parse(dbResults);
    const hasData = parsed?.count > 0 || (Array.isArray(parsed?.results) && parsed.results.length > 0);

   // ============================================================
    // PART 4 — Claude (2nd Call): Analyze Data → Natural Language Answer
    // Feed the real database results back to Claude. It acts as
    // FireAID and explains the data in plain English.
    // Must cite actual numbers; must not fabricate any figures.
    // ============================================================
    const analysisRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are FireAID, a wildfire intelligence assistant for UAF (University of Alaska Fairbanks).
You will be given REAL data from our Alaska wildfire database (33,596 records, 1939-2024).
Analyze the data and answer the user's question concisely in plain English.
Cite specific numbers from the data. Do not make up any numbers not in the data.
If the data is empty or insufficient, say so honestly.${chart ? `
A ${chart.type} chart titled "${chart.title}" of these results is shown below your answer, so summarise the main pattern and highlights instead of listing every value.` : ""}`,
          },
          ...history,
          {
            role: "user",
            content: `Question: ${userMessage}\n\nReal database results:\n${dbResults}\n\nPlease analyze this data and answer the question.`,
          },
        ],
      }),
    });

    const analysisData = await analysisRes.json();
    const reply = analysisData?.choices?.[0]?.message?.content ?? "No response.";

    return NextResponse.json({
      ok: true,
      reply,
      chart: hasData ? chart : null,
      toolsUsed: hasData ? [{ name: "aggregate_fire_data", recordCount: parsed?.count ?? parsed?.results?.length ?? 0 }] : [],
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
