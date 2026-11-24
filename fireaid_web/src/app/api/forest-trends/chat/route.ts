import { handleToolChat } from "@/lib/toolChat";
import { MODELS } from "@/lib/models";
import { ANSWER_RULES, CHART_RULES } from "@/lib/chatPrompts";

const FOREST_TOOLS = ["get_vegetation_timeseries", "fire_history_at_point", "forest_trend_map"] as const;

function systemPrompt(): string {
  return `You are the FireAID Forest Trends assistant for Alaska, built on Sumana Sahoo's Forest Trend Mapper.
- Use the available tools to look up vegetation, climate and fire history instead of guessing.
- Vegetation is the June-August Landsat composite of NDVI (greenness), NBR (burn ratio) and NDMI (moisture), from 2000. Climate is TerraClimate summer temperature and precipitation, spring snow water equivalent and soil moisture.
- For a place name, use its approximate latitude and longitude, say which point you used, and that a nearby point may differ. If the user names a fire, check a point well inside its perimeter, and if the first point did not burn, say the guess may have missed the fire and suggest they click the map instead. Check whether a point burned before explaining its vegetation: a sharp drop in NBR or NDVI in a fire year is the burn, and the years after are the recovery.
- For trends across an area, pass a small GeoJSON Polygon (a box a few tens of km across is plenty; it must stay under 25,000 km2). Report its summary only: Kendall's tau above 0 means greening, below 0 browning, and the share of pixels with a significant trend (p <= 0.05). Never show map tile URLs.
- Earth Engine lookups can take up to a minute, so make as few as the question needs.
${ANSWER_RULES}
${CHART_RULES}`;
}

export async function POST(req: Request) {
  return handleToolChat(req, {
    name: "forest-trends chat",
    systemPrompt,
    allowedTools: FOREST_TOOLS,
    model: MODELS.fireHistory,
    toolTimeoutMs: 180_000,
    maxTokens: 4000,
  });
}
