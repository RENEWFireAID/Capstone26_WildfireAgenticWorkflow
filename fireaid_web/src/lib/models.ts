// The OpenRouter model behind each AI feature. The API routes call these, and
// /api/models serves them so each page can tell the user which model answers.
export const MODELS = {
  // FireAID Assistant (/portal): a small model picks the tools, a larger one writes the answer.
  agentTools: "openai/gpt-4o-mini",
  agentAnswer: "openai/gpt-4o",
  // Fire History "Ask AI about this data" (/mcp-tools).
  fireHistory: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5",
  // Alaska Fire Risk chat (/fire-risk).
  fireRisk: process.env.FIRE_CHAT_MODEL || "anthropic/claude-sonnet-5.5",
};

export type ModelFeature = "agent" | "fireHistory" | "fireRisk";

// What each page shows, in the order the models run.
export function modelsFor(feature: ModelFeature): { id: string; task?: string }[] {
  if (feature === "agent") {
    return [
      { id: MODELS.agentTools, task: "picks tools" },
      { id: MODELS.agentAnswer, task: "writes the answer" },
    ];
  }
  return [{ id: MODELS[feature] }];
}
