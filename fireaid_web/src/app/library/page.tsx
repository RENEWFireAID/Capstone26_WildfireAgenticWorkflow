"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AppPage, FIELD, Notice, Panel, Placeholder, SHADOW } from "@/components/ui/app";
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
    <AppPage
      eyebrow="Apps · Reference"
      title="Wildfire Terminology Library"
      description="Look up the wildfire terms used across the apps, from fuel types to fire behavior."
      meta={["FireAID wildfire glossary", "Terms from the USDA Forest Service", `${terms.length} terms`]}
      actions={
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">Source</span>
          <Image src="/usda-logo.svg" alt="USDA Fire Service Logo" width={225} height={30} />
        </div>
      }
    >
      <Panel accent>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className={`${FIELD} h-10 pl-9 pr-9`}
            placeholder="Search terms or definitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-slate-400 transition hover:bg-slate-100 hover:text-navy" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </Panel>

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <Placeholder>Loading terms...</Placeholder>
      ) : filtered.length === 0 ? (
        <Placeholder>No terms found for "{search}"</Placeholder>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* Term list */}
          <section className={`min-w-0 overflow-hidden bg-white ${SHADOW}`}>
            <div className="border-b border-slate-200 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">
              {filtered.length} term{filtered.length !== 1 ? "s" : ""} {search ? `matching "${search}"` : ""}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {letters.map(letter => (
                <div key={letter}>
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-navy">
                    {letter}
                  </div>
                  {grouped[letter].map(t => (
                    <button
                      key={t.term}
                      className={`flex w-full items-center justify-between gap-3 border-b border-l-4 border-b-slate-100 px-4 py-3 text-left transition ${selected?.term === t.term ? "border-l-navy bg-navy-soft" : "border-l-transparent hover:bg-slate-50"}`}
                      onClick={() => setSelected(t)}
                    >
                      <span className={`text-sm font-semibold ${selected?.term === t.term ? "text-navy-deep" : "text-slate-800"}`}>{t.term}</span>
                      <ChevronRight size={14} className={`shrink-0 ${selected?.term === t.term ? "text-navy" : "text-slate-300"}`} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Term detail */}
          <section className={`min-w-0 self-start bg-white ${SHADOW} md:sticky md:top-6`}>
            {selected ? (
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-bold leading-tight text-navy-deep">{selected.term}</h2>
                  <button className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-navy" onClick={() => setSelected(null)} aria-label="Close definition">
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Wildfire Term
                </div>
                <div className="mt-4 border-l-4 border-gold bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                  {selected.def}
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <Book size={28} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />
                <div className="text-sm font-semibold text-slate-600">Select a term</div>
                <div className="mt-1 text-xs text-slate-500">Click any term to see its definition</div>
              </div>
            )}
          </section>
        </div>
      )}
    </AppPage>
  );
}
