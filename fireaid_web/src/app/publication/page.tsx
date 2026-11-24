"use client";

import { useState } from "react";
import Image from "next/image";
import { AppPage, FIELD, Panel, Placeholder, SHADOW, buttonClass } from "@/components/ui/app";
import { FileText, Search, Loader2, ExternalLink } from "lucide-react";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";

const CHAT_SUGGESTIONS = [
  "How does wildfire smoke affect respiratory health?",
  "What do studies say about boreal forest recovery after fire in Alaska?",
  "How does climate change affect fire season length?",
];

function parseAuthors(authorString: string): string {
    if (!authorString) return "Unknown Authors";
    if (!authorString.startsWith("[")) return authorString;

    try {
        const validJsonStr = authorString
            .replace(/'(first|middle|last|suffix)'/g, '"$1"')
            .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

        const authorsArr = JSON.parse(validJsonStr);
        return authorsArr.map((a: any) => {
            const first = a.first || "";
            const middle = Array.isArray(a.middle) ? a.middle.join(" ") : (a.middle || "");
            const last = a.last || "";
            return [first, middle, last].filter(Boolean).join(" ");
        }).join(", ");
    } catch (e) {
        return authorString.replace(/[\[\]{}']/g, '');
    }
}

export default function PublicationPage() {
    const [input, setInput] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!input.trim() || loading) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const res = await fetch("/api/publication", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: input }),
            });
            const data = await res.json();
            if (data.chunks) {
                setResults(data.chunks);
            } else {
                setResults([]);
            }
        } catch (e) {
            console.error(e);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppPage
            eyebrow="Apps · Research literature"
            title="Publications Search"
            description="Search through research papers and reports"
            meta={["101,856 paper abstracts", "Semantic search, 10 closest passages"]}
            actions={
                <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Source</span>
                    <Image src="/arxiv-logo.svg" alt="ArXiv Logo" width={60} height={27} />
                </div>
            }
        >
            {/* Search input */}
            <Panel accent>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                            className={`${FIELD} h-10 pl-9`}
                            placeholder="Search publications (e.g. recent findings, mitigation strategies)..."
                            value={input}
                            onChange={(e: any) => setInput(e.target.value)}
                            onKeyDown={(e: any) => e.key === "Enter" && handleSearch()}
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className={buttonClass("primary", "h-10 min-w-[7.5rem] px-6")}
                        disabled={!input.trim() || loading}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : "Search"}
                    </button>
                </div>
            </Panel>

            <FireRiskChat
                endpoint="/api/publication/chat"
                title="Ask the literature"
                subtitle="Answers drawn from the paper abstracts, naming the papers used"
                suggestions={CHAT_SUGGESTIONS}
                modelFeature="fireHistory"
            />

            {/* Results Area */}
            {loading && (
                <Placeholder height="py-12">
                    <Loader2 size={28} className="mx-auto mb-3 animate-spin text-navy" aria-hidden="true" />
                    <div className="font-semibold text-slate-600">Searching publications</div>
                    <div className="mt-1 text-xs text-slate-500">Retrieving the most relevant academic sources...</div>
                </Placeholder>
            )}

            {!loading && hasSearched && results.length === 0 && (
                <Placeholder height="py-12">
                    <FileText size={28} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
                    <div className="font-semibold text-slate-600">No search results</div>
                    <div className="mt-1 text-xs text-slate-500">Try adjusting your query or keywords</div>
                </Placeholder>
            )}

            {!loading && !hasSearched && (
                <Placeholder height="py-12">
                    <FileText size={28} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
                    <div className="font-semibold text-slate-600">Ready to search</div>
                    <div className="mt-1 text-xs text-slate-500">Enter a query above to find publications</div>
                </Placeholder>
            )}

            {!loading && results.length > 0 && (
                <div className="space-y-4">
                    {results.map((chunk: any, i: number) => {
                        const title = chunk.metadata?.title || chunk.metadata?.filename || "Unknown Title";
                        const authors = parseAuthors(chunk.metadata?.authors);
                        const year = chunk.metadata?.year || "N/A";
                        const textExcerpt = chunk.text || "";

                        return (
                            <article key={i} className={`flex min-w-0 gap-4 bg-white p-5 ${SHADOW}`}>
                                {/* Icon Container */}
                                <div className="hidden h-10 w-10 shrink-0 items-center justify-center bg-navy-soft text-navy sm:flex">
                                    <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                    <h2 className="mb-1 text-lg font-bold leading-snug text-navy-deep">
                                        <a
                                            href={`https://scholar.google.com/scholar?hl=en&as_sdt=0%2C2&q=${encodeURIComponent(title)}&btnG=`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group/title inline decoration-navy/40 underline-offset-4 transition hover:text-navy hover:underline"
                                        >
                                            <span className="break-words">{title}</span>
                                            <ExternalLink size={14} className="ml-1.5 inline -translate-y-0.5 text-slate-400 transition-colors group-hover/title:text-navy" aria-hidden="true" />
                                        </a>
                                    </h2>
                                    <div className="mb-3 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                                        <span className="truncate">{authors}</span>
                                        {year !== "N/A" && (
                                            <>
                                                <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true"></span>
                                                <span className="whitespace-nowrap bg-navy-soft px-2 py-0.5 font-mono text-xs font-semibold text-navy">
                                                    {year}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <p className="text-sm leading-relaxed text-slate-700">
                                        {textExcerpt}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </AppPage>
    );
}
