"use client";

import { useState } from "react";
import Image from "next/image";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { FileText, Search, Loader2, ExternalLink } from "lucide-react";

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
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1fr)]">
            <FireAIDSidebar active="publication" />

            <div className="min-w-0 space-y-4">
                {/* Header Section */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-white">
                            <FileText size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="text-xl font-bold text-slate-900">Publications Search</div>
                                <Image
                                    src="/arxiv-logo.svg"
                                    alt="ArXiv Logo"
                                    width={60}
                                    height={24}
                                    className="opacity-80"
                                />
                            </div>
                            <div className="text-xs text-slate-500">Search through research papers and reports</div>
                        </div>
                    </div>

                    {/* Search input */}
                    <div className="mt-6 flex gap-2">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-slate-400" />
                            </div>
                            <input
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-100 placeholder:text-slate-400 text-slate-800"
                                placeholder="Search publications (e.g. recent findings, mitigation strategies)..."
                                value={input}
                                onChange={(e: any) => setInput(e.target.value)}
                                onKeyDown={(e: any) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-2"
                            disabled={!input.trim() || loading}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : "Search"}
                        </button>
                    </div>
                </div>

                {/* Results Area */}
                {loading && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                        <Loader2 size={32} className="mx-auto text-blue-500 mb-3 animate-spin" />
                        <div className="text-sm font-semibold text-slate-500">Searching publications</div>
                        <div className="text-xs text-slate-400 mt-1">Retrieving the most relevant academic sources...</div>
                    </div>
                )}

                {!loading && hasSearched && results.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                        <FileText size={32} className="mx-auto text-slate-300 mb-3" />
                        <div className="text-sm font-semibold text-slate-500">No search results</div>
                        <div className="text-xs text-slate-400 mt-1">Try adjusting your query or keywords</div>
                    </div>
                )}

                {!loading && !hasSearched && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                        <FileText size={32} className="mx-auto text-slate-300 mb-3" />
                        <div className="text-sm font-semibold text-slate-500">Ready to search</div>
                        <div className="text-xs text-slate-400 mt-1">Enter a query above to find publications</div>
                    </div>
                )}

                {!loading && results.map((chunk: any, i: number) => {
                    const title = chunk.metadata?.title || chunk.metadata?.filename || "Unknown Title";
                    const authors = parseAuthors(chunk.metadata?.authors);
                    const year = chunk.metadata?.year || "N/A";
                    const textExcerpt = chunk.text || "";

                    return (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex gap-4 transition hover:shadow-md">
                            {/* Icon Container */}
                            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 border border-blue-100">
                                <FileText size={20} strokeWidth={1.5} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-slate-900 leading-tight mb-1 group/title" style={{ color: "#1e293b" }}>
                                    <a
                                        href={`https://scholar.google.com/scholar?hl=en&as_sdt=0%2C2&q=${encodeURIComponent(title)}&btnG=`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-blue-700 transition-all cursor-pointer inline-flex items-baseline gap-2 group-hover/title:underline decoration-blue-300 underline-offset-4"
                                    >
                                        <span>{title}</span>
                                        <ExternalLink size={14} className="text-slate-400 group-hover/title:text-blue-600 transition-colors shrink-0 relative top-[1px]" />
                                    </a>
                                </h2>
                                <div className="flex items-center gap-2 mb-3 text-[#64748b] text-sm">
                                    <span className="truncate">{authors}</span>
                                    {year !== "N/A" && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                                            <span className="bg-[#eff6ff] text-[#2563eb] px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap">
                                                {year}
                                            </span>
                                        </>
                                    )}
                                </div>

                                <p className="text-slate-600 leading-relaxed text-[14px]">
                                    {textExcerpt}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
