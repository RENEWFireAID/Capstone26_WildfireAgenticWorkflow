import { handleToolChat } from "@/lib/toolChat";
import { MODELS } from "@/lib/models";

const LIGHTNING_TOOLS = ["lightning_strike_counts", "query_fire_points", "count_fires"] as const;

function systemPrompt(): string {
  return `You are the FireAID lightning and fire history assistant for Alaska.
- Use the available tools to look up lightning strikes and fire records instead of guessing.
- Lightning records cover 1986-2012, with 1987 and 1989 missing. Fire records run from 1939.
- Answer in plain, friendly language. Never mention tools, function names, parameters, or JSON. Just give the answer.
- If a lookup fails or the data isn't there, say so. Don't make up numbers.
- When a chart would help, or the user asks for one, add a fenced code block tagged chart holding one JSON object:
  {"type": "bar" | "line" | "pie" | "scatter", "title": string, "description"?: string, "data": [{"label": string, "value": number}]}
  Only chart numbers you got from a lookup. Keep labels short (a few words) and the description to one sentence. Keep the written answer short and put the chart after it.`;
}

export async function POST(req: Request) {
  return handleToolChat(req, {
    name: "lightning chat",
    systemPrompt,
    allowedTools: LIGHTNING_TOOLS,
    // Same model as the Fire History chat.
    model: MODELS.fireHistory,
    maxTokens: 4000,
  });
}
