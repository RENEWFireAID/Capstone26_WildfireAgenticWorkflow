import { handleToolChat } from "@/lib/toolChat";
import { MODELS } from "@/lib/models";

const PARCEL_TOOLS = ["parcel_fire_risk", "parcel_vegetation_at"] as const;
const MODEL = MODELS.parcelRisk;

function systemPrompt(): string {
  return `You are the FireAID parcel fire risk assistant for the Fairbanks North Star Borough, Alaska.
- Use the available tools to look up vegetation, fire risk and parcel scores instead of guessing.
- Parcels are looked up by parcel number (PAN). Risk scores are 0-100 and come only from the vegetation in and around a parcel; they don't include weather or fire history.
- Risk tiers are 1 Very High, 2 High, 3 Moderate, 4 Low. Black spruce and other closed conifer is highest; deciduous moderate; alder, wetlands and bare ground low.
- A tier belongs to one spot on the map. A parcel has only its 0-100 score, so never give a parcel a tier or group parcels by tier.
- Answer in plain, friendly language. Never mention tools, function names, parameters, or JSON. Just give the answer.
- If a lookup fails or the data isn't there, say so. Don't make up scores.
- When a chart would help, or the user asks for one, add a fenced code block tagged chart holding one JSON object:
  {"type": "bar" | "line" | "pie" | "scatter", "title": string, "description"?: string, "data": [{"label": string, "value": number}]}
  Only chart numbers you got from a lookup. Keep labels short (a few words) and the description to one sentence. Keep the written answer short and put the chart after it.`;
}

export async function POST(req: Request) {
  return handleToolChat(req, {
    name: "parcel-risk chat",
    systemPrompt,
    allowedTools: PARCEL_TOOLS,
    model: MODEL,
    hiddenParams: ["include_geometry"],
    maxTokens: 4000,
  });
}
