import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "anthropic/claude-3.5-sonnet";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

async function queryDatabase(userMessage: string): Promise<string> {
  // Step 1: Ask Claude to write a MongoDB pipeline based on the question
  const planRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a MongoDB query generator for an Alaska wildfire database.
Collection: fire_points
Fields: year (number), NAME (string), GENERALCAUSE (string), SPECIFICCAUSE (string), ESTIMATEDTOTALACRES (number), LATITUDE (number), LONGITUDE (number), PRESCRIBEDFIRE (string Y/N), MGMTORGID (string), ORIGINFUELTYPE (string), PRIMARYFUELTYPE (string), OWNERKIND (string), FIRESEASON (string).

Given a user question, return ONLY a valid JSON MongoDB aggregation pipeline array. No explanation, no markdown, just the raw JSON array.
Examples:
- "how many fires in 2004" -> [{"$match":{"year":2004}},{"$count":"total"}]
- "fires by cause" -> [{"$group":{"_id":"$GENERALCAUSE","count":{"$sum":1}}},{"$sort":{"count":-1}}]
- "largest fires" -> [{"$sort":{"ESTIMATEDTOTALACRES":-1}},{"$limit":10},{"$project":{"NAME":1,"ESTIMATEDTOTALACRES":1,"year":1,"GENERALCAUSE":1}}]`,
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const planData = await planRes.json();
  const pipelineText = planData?.choices?.[0]?.message?.content ?? "[]";

  let pipeline;
  try {
    const clean = pipelineText.replace(/```json|```/g, "").trim();
    pipeline = JSON.parse(clean);
  } catch {
    return "[]";
  }

  // Step 2: Execute the pipeline against MongoDB
  const dbRes = await fetch(`${BASE_URL}/api/mcp/aggregate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipeline }),
  });

  const dbData = await dbRes.json();
  if (!dbData.ok) return JSON.stringify({ error: dbData.error });
  return JSON.stringify({ count: dbData.count, results: dbData.results.slice(0, 50) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userMessage: string = body.message ?? "";
    if (!userMessage.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const history: { role: string; content: string }[] = body.history ?? [];

    // Step 1: Query the database
    const dbResults = await queryDatabase(userMessage);
    const parsed = JSON.parse(dbResults);
    const hasData = parsed?.count > 0 || (Array.isArray(parsed?.results) && parsed.results.length > 0);

    // Step 2: Ask Claude to analyze the real data
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
If the data is empty or insufficient, say so honestly.`,
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
      toolsUsed: hasData ? [{ name: "aggregate_fire_data", recordCount: parsed?.count ?? parsed?.results?.length ?? 0 }] : [],
    });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
