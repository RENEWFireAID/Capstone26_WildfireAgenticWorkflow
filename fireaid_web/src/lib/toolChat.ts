import { NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { callFireTool, listFireToolSchemas } from "@/lib/mcpClient";
import { MODELS } from "@/lib/models";

const MODEL = MODELS.fireRisk;
const MAX_TOOL_ROUNDS = 5;
const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;
const MAX_TOOL_RESULT_CHARS = 20000;
// OpenRouter reserves credit for the model's full output limit unless this is set.
const MAX_REPLY_TOKENS = 1500;

type ChatMessage = { role: "user" | "assistant"; content: string };

// A tool that runs inside the web app instead of FireMCP, e.g. a literature or glossary search.
export type LocalTool = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export type ToolChatOptions = {
  name: string;
  systemPrompt: () => string;
  // FireMCP tools the model may call. Omit to allow every tool; [] for none.
  allowedTools?: readonly string[];
  localTools?: readonly LocalTool[];
  // For FireMCP tools slower than the client's 60 s default, e.g. Earth Engine queries.
  toolTimeoutMs?: number;
  // OpenRouter model id. Omit to use FIRE_CHAT_MODEL.
  model?: string;
  // Tool parameters the model shouldn't see or set, e.g. ones only the page uses.
  hiddenParams?: readonly string[];
  maxTokens?: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!isRecord(body) || !Array.isArray(body.messages)) return null;
  const messages = body.messages
    .filter(
      (m): m is ChatMessage =>
        isRecord(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== "",
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  return messages.at(-1)?.role === "user" ? messages : null;
}

async function runTool(
  call: ChatCompletionMessageToolCall,
  allowed: Set<string>,
  local: readonly LocalTool[],
  hidden: readonly string[],
  timeoutMs?: number,
): Promise<string> {
  if (call.type !== "function") return JSON.stringify({ error: "Unsupported tool call" });
  const localTool = local.find((t) => t.name === call.function.name);
  // The model only sees allowed tools, but it can still name another one.
  if (!localTool && !allowed.has(call.function.name)) return JSON.stringify({ error: `Unknown tool ${call.function.name}` });
  try {
    const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    for (const p of hidden) delete args[p];
    const result = localTool
      ? await localTool.run(args)
      : await callFireTool(call.function.name, args, timeoutMs ? { timeoutMs } : undefined);
    const text = typeof result === "string" ? result : JSON.stringify(result);
    return text.length > MAX_TOOL_RESULT_CHARS ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}...[truncated]` : text;
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

export async function handleToolChat(req: Request, options: ToolChatOptions) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Missing OPENROUTER_API_KEY" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const messages = parseMessages(body);
  if (!messages) return badRequest("messages must end with a user message");

  try {
    const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY });
    // Skip FireMCP entirely when a chat only uses local tools.
    const schemas = options.allowedTools?.length === 0 ? [] : (await listFireToolSchemas()).filter(
      (t) => !options.allowedTools || options.allowedTools.includes(t.name),
    );
    const local = options.localTools ?? [];
    const allowed = new Set(schemas.map((t) => t.name));
    const hidden = options.hiddenParams ?? [];
    const tools: ChatCompletionTool[] = schemas.map((t) => {
      const properties = Object.fromEntries(
        Object.entries(t.inputSchema.properties ?? {}).filter(([p]) => !hidden.includes(p)),
      );
      return {
        type: "function",
        function: { name: t.name, description: t.description, parameters: { ...t.inputSchema, properties } },
      };
    });
    for (const t of local) {
      tools.push({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } });
    }
    const convo: ChatCompletionMessageParam[] = [{ role: "system", content: options.systemPrompt() }, ...messages];

    // The last round forbids tool calls so the model has to answer with what it has.
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await openai.chat.completions.create({
        model: options.model ?? MODEL,
        messages: convo,
        max_tokens: options.maxTokens ?? MAX_REPLY_TOKENS,
        ...(tools.length > 0 && { tools, tool_choice: round < MAX_TOOL_ROUNDS ? "auto" : "none" }),
      });
      const reply = res.choices[0]?.message;
      if (!reply) throw new Error("Empty response from model");

      const calls = reply.tool_calls ?? [];
      if (calls.length === 0) {
        if (!reply.content?.trim()) throw new Error("Model returned no text");
        return NextResponse.json({ message: reply.content.trim() });
      }

      convo.push({ role: "assistant", content: reply.content, tool_calls: calls });
      for (const call of calls) {
        convo.push({ role: "tool", tool_call_id: call.id, content: await runTool(call, allowed, local, hidden, options.toolTimeoutMs) });
      }
    }
    throw new Error("Model kept calling tools");
  } catch (e) {
    console.error(`${options.name} failed:`, e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Chat service unavailable" }, { status: 502 });
  }
}
