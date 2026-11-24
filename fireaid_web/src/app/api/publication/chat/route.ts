import { handleToolChat, type LocalTool } from "@/lib/toolChat";
import { MODELS } from "@/lib/models";
import { ANSWER_RULES } from "@/lib/chatPrompts";

const RAG_URLS = [process.env.RAG_URL || "http://rag-service:8000/api/retrieve", "http://127.0.0.1:8000/api/retrieve"];
const MAX_RESULTS = 8;

type Chunk = { text?: string; metadata?: Record<string, unknown> };

// Same RAG service as the search box above, with the same local-testing fallback.
async function retrieve(query: string, topK: number): Promise<Chunk[]> {
  for (const url of RAG_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: topK }),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.chunks) ? data.chunks : [];
      }
    } catch {
      // Try the next URL.
    }
  }
  throw new Error("The literature search service is unavailable");
}

const searchLiterature: LocalTool = {
  name: "search_literature",
  description:
    "Semantic search over 101,856 wildfire, climate and ecology paper abstracts. Returns the closest abstracts with title, authors and year. Search again with different wording if the results don't answer the question.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to search for, in plain English." },
      top_k: { type: "integer", description: `How many abstracts to return, 1-${MAX_RESULTS}. Default 5.` },
    },
    required: ["query"],
  },
  async run(args) {
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required" };
    const topK = Math.min(Math.max(Number(args.top_k) || 5, 1), MAX_RESULTS);
    const chunks = await retrieve(query, topK);
    return chunks.map((c) => ({
      title: c.metadata?.title ?? c.metadata?.filename ?? "Unknown title",
      authors: c.metadata?.authors ?? "Unknown",
      // The index stores 0 when the year is missing.
      year: c.metadata?.year && String(c.metadata.year) !== "0" ? c.metadata.year : "unknown",
      abstract: c.text ?? "",
    }));
  },
};

function systemPrompt(): string {
  return `You are the FireAID research literature assistant. You answer questions from a library of 101,856 wildfire, climate and ecology paper abstracts.
- Always search the library before answering, and answer only from the abstracts you found. Don't add facts from memory.
- Name the papers you used inline, by title and year (or "year unknown"), e.g. *Title* (2019).
- If the abstracts don't answer the question, say so plainly, and suggest a better search if you can.
- When findings differ between papers, say so rather than picking one.
${ANSWER_RULES}`;
}

export async function POST(req: Request) {
  return handleToolChat(req, {
    name: "publication chat",
    systemPrompt,
    allowedTools: [],
    localTools: [searchLiterature],
    model: MODELS.fireHistory,
    maxTokens: 3000,
  });
}
