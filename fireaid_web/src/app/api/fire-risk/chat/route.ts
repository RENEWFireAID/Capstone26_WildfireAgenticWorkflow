import { NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { callFireTool, listFireToolSchemas } from "@/lib/mcpClient";

const MODEL = process.env.FIRE_CHAT_MODEL || "anthropic/claude-sonnet-5.5";
const MAX_TOOL_ROUNDS = 5;
const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;
const MAX_TOOL_RESULT_CHARS = 20000;
// OpenRouter reserves credit for the model's full output limit unless this is set.
const MAX_REPLY_TOKENS = 1500;

type ChatMessage = { role: "user" | "assistant"; content: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

function systemPrompt(): string {
  const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "America/Anchorage" });
  return `You are the FireAID assistant, an expert on Alaska wildfires.
- Use the available tools to look up fire records and predict fire risk instead of guessing.
- When predicting fire risk, always pass the month. If the user doesn't give one, use the current month (${month}).
- Answer in plain, friendly language. Never mention tools, function names, parameters, or JSON. Just give the answer.
- If you can't get the data you need, say so briefly.`;
}

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

// Tool failures go back to the model as text so it can retry or explain.
async function runTool(call: ChatCompletionMessageToolCall): Promise<string> {
  if (call.type !== "function") return JSON.stringify({ error: "Unsupported tool call" });
  try {
    const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    const result = await callFireTool(call.function.name, args);
    const text = typeof result === "string" ? result : JSON.stringify(result);
    return text.length > MAX_TOOL_RESULT_CHARS ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}...[truncated]` : text;
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

export async function POST(req: Request) {
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
    const tools: ChatCompletionTool[] = (await listFireToolSchemas()).map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
    const convo: ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt() }, ...messages];

    // The last round forbids tool calls so the model has to answer with what it has.
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await openai.chat.completions.create({
        model: MODEL,
        messages: convo,
        max_tokens: MAX_REPLY_TOKENS,
        tools,
        tool_choice: round < MAX_TOOL_ROUNDS ? "auto" : "none",
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
        convo.push({ role: "tool", tool_call_id: call.id, content: await runTool(call) });
      }
    }
    throw new Error("Model kept calling tools");
  } catch (e) {
    console.error("fire-risk chat failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Chat service unavailable" }, { status: 502 });
  }
}
