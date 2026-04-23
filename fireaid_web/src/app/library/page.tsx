"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { Book, Search, ChevronRight, X } from "lucide-react";

type Term = { term: string; def: string };

export default function LibraryPage() {
  const [terms, setTerms]       = useState<Term[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Term | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/terms")
      .then(r => r.json())
      .then(data => { setTerms(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = terms.filter(t =>
    t.term?.toLowerCase().includes(search.toLowerCase()) ||
    t.def?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by first letter
  const grouped: Record<string, Term[]> = {};
  filtered.forEach(t => {
    const letter = t.term?.[0]?.toUpperCase() ?? "#";
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(t);
  });
  const letters = Object.keys(grouped).sort();

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1fr)]">
      <FireAIDSidebar/>

      <div className="min-w-0 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-white">
              <Book size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold text-slate-900">Wildfire Terminology Library</div>
                <Image
                  src="/usda-logo.svg"
                  alt="USDA Fire Service Logo"
                  width={250}
                  height={50}
                  className="opacity-80"
                />
              </div>
              <div className="text-xs text-slate-500">{terms.length} terms</div>
            </div>
          </div>

          <div className="mt-4 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 placeholder:text-slate-400"
              placeholder="Search terms or definitions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => setSearch("")}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading terms...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">No terms found for "{search}"</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
            {/* Term list */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
                {filtered.length} term{filtered.length !== 1 ? "s" : ""} {search ? `matching "${search}"` : ""}
              </div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {letters.map(letter => (
                  <div key={letter}>
                    <div className="sticky top-0 bg-slate-50 px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      {letter}
                    </div>
                    {grouped[letter].map(t => (
                      <button
                        key={t.term}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition ${selected?.term === t.term ? "bg-violet-50" : ""}`}
                        onClick={() => setSelected(t)}
                      >
                        <span className={`text-sm font-semibold ${selected?.term === t.term ? "text-violet-700" : "text-slate-800"}`}>{t.term}</span>
                        <ChevronRight size={14} className="text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Term detail */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {selected ? (
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-lg font-bold text-slate-900">{selected.term}</div>
                    <button className="text-slate-400 hover:text-slate-700 shrink-0" onClick={() => setSelected(null)}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-1 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    Wildfire Term
                  </div>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
                    {selected.def}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center">
                  <div>
                    <Book size={28} className="mx-auto text-slate-300 mb-2" />
                    <div className="text-sm font-semibold text-slate-400">Select a term</div>
                    <div className="text-xs text-slate-300 mt-1">Click any term to see its definition</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}