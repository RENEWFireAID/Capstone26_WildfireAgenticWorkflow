// What the assistant looked up to write an answer. The server records these as
// it runs each tool, so the chat can show the evidence itself rather than the
// model's own account of it.

export type FireRecordsSource = {
  kind: "fire_records";
  filters: { yearStart: number | null; yearEnd: number | null; prescribed: string; limit: number | null };
  total: number;
  preview: { name: string; year: string; acres: string; cause: string }[];
};

export type PapersSource = {
  kind: "papers";
  query: string;
  // `n` is the number the answer cites, as in [1].
  papers: { n: number; title: string; authors: string; year: string; text: string }[];
};

export type TermSource = { kind: "term"; term: string; definition: string | null };

export type ChartSource = { kind: "chart"; request: string; title: string | null; points: number };

export type AnswerSource = FireRecordsSource | PapersSource | TermSource | ChartSource;

/** "[{'first': 'Evan', 'last': 'Larson'}, ...]" as stored in the literature CSV -> "Larson et al." */
export function shortAuthors(raw: unknown): string {
  const lasts = [...String(raw ?? "").matchAll(/'last':\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  if (lasts.length === 0) return "Unknown author";
  if (lasts.length === 1) return lasts[0];
  if (lasts.length === 2) return `${lasts[0]} and ${lasts[1]}`;
  return `${lasts[0]} et al.`;
}
