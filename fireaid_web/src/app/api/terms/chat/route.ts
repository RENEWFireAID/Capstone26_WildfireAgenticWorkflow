import { handleToolChat, type LocalTool } from "@/lib/toolChat";
import { MODELS } from "@/lib/models";
import { ANSWER_RULES } from "@/lib/chatPrompts";
import { getDb } from "@/lib/mongo";

const MAX_RESULTS = 8;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const lookupTerms: LocalTool = {
  name: "lookup_terms",
  description:
    "Search the FireAID wildfire glossary (USDA Forest Service terms). Matches the text against term names and definitions, exact term names first. Returns each term with its definition.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "A term or a word to look for, e.g. 'crown fire' or 'fuel'." } },
    required: ["query"],
  },
  async run(args) {
    const query = String(args.query ?? "").trim().slice(0, 100);
    if (!query) return { error: "query is required" };
    // Ignore spaces and hyphens, so "burnout" finds "Burn Out" and "flareup" finds "Flare-up".
    const letters = [...query.replace(/[\s-]+/g, "")].map(escapeRegex);
    if (!letters.length) return { error: "query is required" };
    const pattern = new RegExp(letters.join("[\\s-]?"), "i");
    const terms = (await getDb()).collection<{ term: string; def: string }>("terms");
    const found = await terms
      .find({ $or: [{ term: pattern }, { def: pattern }] }, { projection: { _id: 0, term: 1, def: 1 } })
      .limit(50)
      .toArray();
    const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
    const q = squash(query);
    const rank = (t: { term: string }) => (squash(t.term) === q ? 0 : pattern.test(t.term) ? 1 : 2);
    const results = found.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_RESULTS);
    return results.length ? results : { found: 0, note: `No glossary term matches "${query}".` };
  },
};

function systemPrompt(): string {
  return `You are the FireAID wildfire terminology assistant. You explain terms from the FireAID glossary, which comes from the USDA Forest Service.
- Always look terms up before explaining them, and base the definition on the glossary's wording. You may then add a short plain-language explanation or an example.
- To compare terms or answer "what's the difference" questions, look up each term.
- If a term isn't in the glossary, say so, and offer the closest terms that are.
${ANSWER_RULES}`;
}

export async function POST(req: Request) {
  return handleToolChat(req, {
    name: "terminology chat",
    systemPrompt,
    allowedTools: [],
    localTools: [lookupTerms],
    model: MODELS.fireHistory,
    maxTokens: 2000,
  });
}
