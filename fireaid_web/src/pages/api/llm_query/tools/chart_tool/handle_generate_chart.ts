import { buildChart, type ChartSpec } from "@/lib/chartBuilder";

export type ChartToolResult = {
  /** Text handed back to the model so it can talk about what was plotted. */
  output: string;
  /** Structured spec passed through to the chat UI for rendering. */
  chart: ChartSpec | null;
};

/**
 * Build a chart from a natural-language request. The model only ever sees the
 * text summary; the chart itself travels separately to the frontend, since a
 * function_call_output has to be a string.
 */
export async function generateChart(request: string): Promise<ChartToolResult> {
  try {
    const { summary, chart } = await buildChart(request);

    if (!chart) {
      return { output: `No data matched that request. ${summary ?? ""}`.trim(), chart: null };
    }

    const preview = chart.data
      .slice(0, 10)
      .map((d) => `${d.label}: ${d.value}`)
      .join(", ");

    return {
      output: [
        `A ${chart.type} chart titled "${chart.title}" has been rendered for the user.`,
        `It has ${chart.data.length} data points. First values: ${preview}.`,
        summary ? `Summary: ${summary}` : "",
        "Describe what the chart shows. Do not repeat every number, and do not claim you cannot display charts.",
      ]
        .filter(Boolean)
        .join(" "),
      chart,
    };
  } catch (e: any) {
    return {
      output: `Chart generation failed: ${e?.message ?? "unknown error"}. Tell the user plainly.`,
      chart: null,
    };
  }
}
