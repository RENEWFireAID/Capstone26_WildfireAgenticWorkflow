// The FireAID apps' data, offered to the home page Chat as FireMCP tools.
// A curated list rather than every MCP tool: some return map tiles or images
// that are no use in a chat, and each one needs an entry under "Based on".

import type { Tool } from "openai/resources/responses/responses.mjs";
import { callFireTool, listFireToolSchemas } from "@/lib/mcpClient";
import type { AppSource } from "@/lib/answerSources";

type AppTool = {
  app: string;
  href: string;
  // Added to FireMCP's own description: the caveats the app's chat would know.
  note?: string;
  timeoutMs?: number;
};

const EARTH_ENGINE = 180_000;

export const APP_TOOLS: Record<string, AppTool> = {
  get_vegetation_timeseries: {
    app: "Forest Trends",
    href: "/forest-trends",
    note: "Check fire_history_at_point first: a sharp NBR or NDVI drop in a fire year is the burn, the years after are the recovery.",
    timeoutMs: EARTH_ENGINE,
  },
  fire_history_at_point: { app: "Forest Trends", href: "/forest-trends", timeoutMs: EARTH_ENGINE },
  forest_trend_map: {
    app: "Forest Trends",
    href: "/forest-trends",
    note: "Pass a box a few tens of km across. Use its summary only: tau above 0 is greening, below 0 browning.",
    timeoutMs: EARTH_ENGINE,
  },
  burn_recovery_overview: {
    app: "Burn Severity Recovery",
    href: "/burn-recovery",
    note: "This study has no burned-area figures. sampled_locations and the per-group sample counts come from the sampling design (up to 333 per severity group), not from fire size, so never use them to compare how large or how severe the fires were. For burned area, use the Alaska fire records (acres).",
  },
  predict_fire_risk: { app: "Alaska Fire Risk", href: "/fire-risk" },
  fire_danger_forecast: { app: "Alaska Fire Risk", href: "/fire-risk" },
  parcel_fire_risk: {
    app: "Parcel Fire Risk",
    href: "/parcel-risk",
    note: "Fairbanks North Star Borough only. The 0-100 score is a hazard index, not a probability of fire.",
  },
  parcel_vegetation_at: {
    app: "Parcel Fire Risk",
    href: "/parcel-risk",
    note: "Fairbanks North Star Borough only. The 0-100 score is a hazard index, not a probability of fire.",
  },
  lightning_strike_counts: { app: "Lightning and Fire History", href: "/lightning" },
};

// Page-only parameters the chat model should not see or set.
const HIDDEN_PARAMS = ["include_geometry"];
const MAX_RESULT_CHARS = 20_000;

/** The app tools in the Responses API format, or none if FireMCP is unreachable. */
export async function appTools(): Promise<Tool[]> {
  try {
    const schemas = (await listFireToolSchemas()).filter((t) => t.name in APP_TOOLS);
    return schemas.map((t) => {
      const meta = APP_TOOLS[t.name];
      const properties = Object.fromEntries(
        Object.entries((t.inputSchema.properties ?? {}) as Record<string, unknown>).filter(([p]) => !HIDDEN_PARAMS.includes(p)),
      );
      return {
        type: "function",
        name: t.name,
        description: `[${meta.app} app] ${t.description}${meta.note ? `\nNote: ${meta.note}` : ""}`,
        parameters: { ...t.inputSchema, properties },
        // MCP schemas have optional parameters, which strict mode does not allow.
        strict: false,
      } as Tool;
    });
  } catch (e) {
    console.error("App tools unavailable:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Tile URLs, image data and geometry cost tokens and mean nothing to the model.
function stripMedia(value: unknown): unknown {
  if (typeof value === "string") return /^(https?:|data:)/.test(value) ? "[link omitted]" : value;
  if (Array.isArray(value)) return value.map(stripMedia);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([k]) => k !== "geometry").map(([k, v]) => [k, stripMedia(v)]),
    );
  }
  return value;
}

// "lat 64.97, lon -148.25" for the Based on line.
function describeArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => (typeof v === "object" ? (k === "region" ? "a drawn area" : k.replace(/_/g, " ")) : `${k.replace(/_/g, " ")} ${v}`));
  return parts.join(", ");
}

/** Run one app tool: the text for the model and the source for the chat. */
export async function runAppTool(name: string, rawArgs: string): Promise<{ output: string; source: AppSource }> {
  const meta = APP_TOOLS[name];
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    // Fall through with no arguments; the tool reports what is missing.
  }
  for (const p of HIDDEN_PARAMS) delete args[p];
  // A model sometimes drops the minus sign of a west longitude. Nothing in Alaska lies
  // between 0 and 170 E (the far Aleutians reach about 172 E), so flip those back.
  for (const k of ["lon", "longitude"]) {
    const v = args[k];
    if (typeof v === "number" && v > 0 && v < 170) args[k] = -v;
  }
  const base = { kind: "app" as const, app: meta.app, href: meta.href, tool: name, lookup: describeArgs(args) };

  try {
    const result = await callFireTool(name, args, meta.timeoutMs ? { timeoutMs: meta.timeoutMs } : undefined);
    const failed = result && typeof result === "object" && (result.ok === false || "error" in result);
    // The caveat travels with the data: the answering model reads results more closely than tool descriptions.
    let text = (meta.note ? `Note: ${meta.note}\n` : "") + JSON.stringify(stripMedia(result));
    if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}...[truncated]`;
    return { output: text, source: { ...base, ok: !failed } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { output: JSON.stringify({ error: message }), source: { ...base, ok: false } };
  }
}
