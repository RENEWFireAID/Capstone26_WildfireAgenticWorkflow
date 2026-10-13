import { getDb } from "@/lib/mongo";

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

export type ChartSpec = {
  type: "bar" | "line" | "pie" | "scatter";
  title: string;
  description: string;
  data: { label: string; value: number }[];
  xKey: "label";
  yKey: "value";
};

export type BuiltChart = { summary: string; chart: ChartSpec | null };

const SYSTEM_PROMPT = `You are a wildfire data analyst AI for FireAID, an Alaska Wildfire Intelligence Platform.
You have access to a MongoDB collection called "fire_points" with 33,596 Alaska wildfire records from 1939-2024.

Key fields available:
- year (number): fire year
- NAME / name (string): fire name
- GENERALCAUSE (string): e.g. "Lightning", "Human", "Undetermined", "Prescribed"
- FIRECAUSE (string): specific cause
- FIRESEASON (number): fire season year
- acres / ESTIMATEDTOTALACRES (number): acres burned
- prescribed / PRESCRIBEDFIRE (string): "Y" or "N"
- MGMTORGID (string): managing org e.g. "DOF", "BLM", "NPS", "USFS"
- lat, lon (number): coordinates
- ORIGINFUELTYPE (string): fuel type

Given a user question, respond with a JSON object (no markdown, no backticks) in this exact format:
{
  "pipeline": [...],
  "chartType": "bar" | "line" | "pie" | "scatter",
  "labelField": "fieldname",
  "valueField": "fieldname",
  "title": "Chart title",
  "description": "Brief description of what this chart shows",
  "summary": "2-3 sentence natural language summary of expected findings"
}

Rules:
- pipeline must be a valid MongoDB aggregation pipeline array
- For time series use "line", for comparisons use "bar", for proportions use "pie", for correlation/distribution use "scatter"
- Prefer at most 30 data points. Use $limit only after $sort, and never let $limit silently cut off part of a time range the user asked for — narrow the $match instead.
- labelField and valueField must match fields in the pipeline output
- Return ONLY the JSON object, nothing else. No explanation, no markdown, no backticks. Just the raw JSON.`;

// The pipeline is model-generated, so refuse the stages that can write or leak
// server state, matching the guard in /api/mcp/aggregate.
const BLOCKED_STAGES = [
  "$out",
  "$merge",
  "$indexStats",
  "$collStats",
  "$currentOp",
  "$listSessions",
  "$lookup",
  "$unionWith",
];

function assertSafePipeline(pipeline: unknown): asserts pipeline is Record<string, unknown>[] {
  if (!Array.isArray(pipeline)) throw new Error("Model did not return a pipeline array");
  for (const stage of pipeline) {
    if (!stage || typeof stage !== "object") throw new Error("Invalid pipeline stage");
    for (const key of Object.keys(stage)) {
      if (BLOCKED_STAGES.includes(key)) {
        throw new Error(`Pipeline contains blocked stage ${key}`);
      }
    }
  }
}


// The model does not reliably respect the point budget in the prompt, and a pie
// with 40 slices is unreadable, so clamp here. Pie keeps proportions truthful by
// folding the tail into "Other" rather than dropping it.
const MAX_PIE_SLICES = 12;
const MAX_POINTS = 40;

function clampData(
  type: string,
  data: { label: string; value: number }[],
  description: string
): { data: typeof data; description: string } {
  if (type === "pie" && data.length > MAX_PIE_SLICES) {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, MAX_PIE_SLICES - 1);
    const tail = sorted.slice(MAX_PIE_SLICES - 1);
    const other = tail.reduce((sum, d) => sum + d.value, 0);
    return {
      data: [...head, { label: `Other (${tail.length})`, value: other }],
      description: `${description} The ${tail.length} smallest categories are grouped as "Other".`,
    };
  }

  if (data.length > MAX_POINTS) {
    const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, MAX_POINTS);
    return {
      data: sorted,
      description: `${description} Showing the ${MAX_POINTS} largest of ${data.length} values.`,
    };
  }

  return { data, description };
}

/**
 * Turn a natural-language request into a chart backed by a real aggregation
 * over fire_points. Shared by the Charts page and the chat assistant's
 * generate_chart tool so both behave identically.
 */
export async function buildChart(message: string): Promise<BuiltChart> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");

  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://fireaid.uaf.edu",
      "X-Title": "FireAID Chart Generator",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
    }),
  });

  const aiData = await aiRes.json();
  const rawText = aiData?.choices?.[0]?.message?.content ?? "";
  if (!rawText) {
    throw new Error(aiData?.error?.message ?? "Model returned an empty response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
  } catch {
    throw new Error("Model returned invalid JSON: " + String(rawText).slice(0, 200));
  }

  const { pipeline, chartType, labelField, valueField, title, description, summary } = parsed;
  assertSafePipeline(pipeline);

  const db = await getDb();
  const results = await db.collection("fire_points").aggregate(pipeline).toArray();

  if (!results.length) {
    return { summary: summary ?? "No data found for that query.", chart: null };
  }

  const data = results.map((row: any) => {
    const rawLabel = row[labelField] ?? row._id ?? "Unknown";
    const label =
      typeof rawLabel === "object" && rawLabel !== null
        ? Object.values(rawLabel).join(" / ")
        : String(rawLabel);
    return { label, value: Number(row[valueField] ?? row.count ?? 0) };
  });

  const clamped = clampData(chartType, data, description ?? "");

  return {
    summary,
    chart: {
      type: chartType,
      title,
      description: clamped.description,
      data: clamped.data,
      xKey: "label",
      yKey: "value",
    },
  };
}
