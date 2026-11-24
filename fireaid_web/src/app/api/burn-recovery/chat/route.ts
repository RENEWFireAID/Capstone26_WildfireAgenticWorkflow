import { handleToolChat } from "@/lib/toolChat";
import { MODELS } from "@/lib/models";
import { ANSWER_RULES, CHART_RULES } from "@/lib/chatPrompts";

// The other burn_recovery tools return images and large arrays for drawing the page.
const BURN_TOOLS = ["burn_recovery_overview"] as const;

function systemPrompt(): string {
  return `You are the FireAID Burn Severity Recovery assistant. You answer questions about Muhammad Saffiullah's (UAA) study of three 2019 Alaska fires: Shovel Creek, Swan Lake and Nugget Creek.
- Use the available tool to look up the study's saved results instead of guessing.
- Burn severity is dNBR from NASA HLS imagery, the change in the Normalized Burn Ratio from before to after the fire; higher dNBR means a more severe burn. Recovery is post-fire greenness (NDVI) from 2020 to 2024.
- Locations were sampled by severity group, up to 333 per group, so the sample counts reflect the sampling design, not how much of a fire burned at each severity. Never compare fires' burned area or severity extent from them. A group with fewer than 333 samples only means the fire had few pixels in that range.
- The models are trained on two fires and tested on the third. Judge them against the training-mean baseline: an R² near or below 0, or an RMSE no better than the baseline, means the model does not predict recovery on that fire.
- Results are a research prototype served from saved, verified notebook outputs, so they cover only these three fires.
${ANSWER_RULES}
${CHART_RULES}`;
}

export async function POST(req: Request) {
  return handleToolChat(req, {
    name: "burn-recovery chat",
    systemPrompt,
    allowedTools: BURN_TOOLS,
    model: MODELS.fireHistory,
    maxTokens: 4000,
  });
}
