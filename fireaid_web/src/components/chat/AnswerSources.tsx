"use client";

import { AlertTriangle, BarChart3, BookOpen, Database, FileText } from "lucide-react";
import type { AnswerSource, FireRecordsSource } from "@/lib/answerSources";

function describeFilters(f: FireRecordsSource["filters"]) {
  const years =
    f.yearStart && f.yearEnd
      ? f.yearStart === f.yearEnd ? `${f.yearStart}` : `${f.yearStart}–${f.yearEnd}`
      : f.yearStart ? `${f.yearStart} onward` : f.yearEnd ? `up to ${f.yearEnd}` : "all years";
  const prescribed = f.prescribed === "Y" ? "prescribed fires only" : "excluding prescribed fires";
  return `${years}, ${prescribed}`;
}

function Row({ icon: Icon, label, detail, children }: {
  icon: typeof Database;
  label: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const head = (
    <span className="flex min-w-0 items-center gap-2">
      <Icon size={13} className="shrink-0 text-navy" aria-hidden="true" />
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="truncate font-mono text-[11px] text-slate-500">{detail}</span>
    </span>
  );
  if (!children) return <li className="py-1.5">{head}</li>;
  return (
    <li className="py-1.5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          {head}
          <span className="shrink-0 text-[11px] font-semibold text-navy group-open:hidden">Show</span>
          <span className="hidden shrink-0 text-[11px] font-semibold text-navy group-open:inline">Hide</span>
        </summary>
        <div className="mt-2 pl-5">{children}</div>
      </details>
    </li>
  );
}

/**
 * The evidence behind one answer: what was queried and what came back,
 * shown from the tool results themselves so readers can check the answer.
 */
export default function AnswerSources({ sources }: { sources?: AnswerSource[] }) {
  if (!sources || sources.length === 0) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
        <span>Answered from the model&apos;s general knowledge. No FireAID data was looked up, so check this before relying on it.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-2 text-xs">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">Based on</p>
      <ul className="mt-1 divide-y divide-slate-100">
        {sources.map((s, i) => {
          if (s.kind === "fire_records") {
            return (
              <Row key={i} icon={Database} label="Alaska fire records"
                detail={`${s.total.toLocaleString("en-US")} matched · ${describeFilters(s.filters)}`}>
                {s.preview.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] tabular">
                      <thead className="text-slate-500">
                        <tr><th className="py-1 pr-3 font-medium">Fire</th><th className="py-1 pr-3 font-medium">Year</th><th className="py-1 pr-3 text-right font-medium">Acres</th><th className="py-1 font-medium">Cause</th></tr>
                      </thead>
                      <tbody className="text-slate-700">
                        {s.preview.map((r, j) => (
                          <tr key={j} className="border-t border-slate-100">
                            <td className="py-1 pr-3">{r.name}</td><td className="py-1 pr-3 font-mono">{r.year}</td>
                            <td className="py-1 pr-3 text-right font-mono">{r.acres}</td><td className="py-1">{r.cause}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[11px] text-slate-500">
                      First {s.preview.length} of {s.total.toLocaleString("en-US")} matching records.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No records matched these filters.</p>
                )}
              </Row>
            );
          }
          if (s.kind === "papers") {
            return (
              <li key={i} className="py-1.5">
                <span className="flex items-center gap-2">
                  <FileText size={13} className="shrink-0 text-navy" aria-hidden="true" />
                  <span className="font-semibold text-slate-700">Research library</span>
                  <span className="truncate font-mono text-[11px] text-slate-500">searched “{s.query}”</span>
                </span>
                <ol className="mt-1 space-y-1 pl-5">
                  {s.papers.map((p) => (
                    <li key={p.n}>
                      <details className="group">
                        <summary className="cursor-pointer list-none text-slate-700 [&::-webkit-details-marker]:hidden">
                          <span className="font-mono text-navy">[{p.n}]</span>{" "}
                          <span className="font-medium group-hover:underline">{p.title}</span>
                          <span className="text-slate-500"> — {p.authors}{p.year ? `, ${p.year}` : ""}</span>
                        </summary>
                        <p className="mt-1 max-h-48 overflow-y-auto rounded-md bg-slate-50 p-2 leading-relaxed text-slate-600">{p.text}</p>
                      </details>
                    </li>
                  ))}
                </ol>
              </li>
            );
          }
          if (s.kind === "term") {
            return (
              <Row key={i} icon={BookOpen} label="Wildfire glossary"
                detail={s.definition ? `“${s.term}”` : `“${s.term}” not found`}>
                {s.definition ? <p className="leading-relaxed text-slate-600">{s.definition}</p> : undefined}
              </Row>
            );
          }
          return (
            <Row key={i} icon={BarChart3} label="Chart"
              detail={s.title ? `${s.title} · ${s.points} points from the fire records` : "No data matched the chart request"} />
          );
        })}
      </ul>
    </div>
  );
}
