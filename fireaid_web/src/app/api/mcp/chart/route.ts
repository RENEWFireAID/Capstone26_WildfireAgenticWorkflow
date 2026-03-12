import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

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
  "chartType": "bar" | "line" | "pie",
  "labelField": "fieldname",
  "valueField": "fieldname",
  "title": "Chart title",
  "description": "Brief description of what this chart shows",
  "summary": "2-3 sentence natural language summary of expected findings"
}

Rules:
- pipeline must be a valid MongoDB aggregation pipeline array
- For time series use "line", for comparisons use "bar", for proportions use "pie"
- Always limit results to 20 or fewer data points using $limit
- labelField and valueField must match fields in the pipeline output
- Return ONLY the JSON object, nothing else. No explanation, no markdown, no backticks. Just the raw JSON.`;

async function getClient() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    // Step 1: Ask AI to generate MongoDB pipeline
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://fireaid.uaf.edu",
        "X-Title": "FireAID Chart Generator",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
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

    let parsed: any;
    try {
      parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON: " + rawText }, { status: 500 });
    }

    const { pipeline, chartType, labelField, valueField, title, description, summary } = parsed;

    // Step 2: Run the pipeline against MongoDB
    const mongo = await getClient();
    const db = mongo.db("fireaid");
    const results = await db.collection("fire_points").aggregate(pipeline).toArray();

    if (!results.length) {
      return NextResponse.json({ summary: "No data found for that query.", chart: null });
    }

    // Step 3: Format for Recharts
    const chartData = results.map((row: any) => ({
      label: String(row[labelField] ?? row._id ?? "Unknown"),
      value: Number(row[valueField] ?? row.count ?? 0),
    }));

    return NextResponse.json({
      summary,
      chart: {
        type: chartType,
        title,
        description,
        data: chartData,
        xKey: "label",
        yKey: "value",
      },
    });

  } catch (err: any) {
    console.error("Chart API error:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
