"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/topbar/Topbar";
import { Star } from "lucide-react";

type Feedback = {
  _id: string;
  name: string;
  email: string;
  overallRating: number;
  uiClarity: number;
  dataEase: number;
  feedback: string;
  suggestions: string;
  createdAt: string;
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={14} className={s <= value ? "fill-[#FFCC33] text-[#FFCC33]" : "text-slate-200"} />
      ))}
    </div>
  );
}

function avg(data: Feedback[], key: keyof Feedback) {
  if (!data.length) return 0;
  return (data.reduce((sum, f) => sum + (f[key] as number), 0) / data.length).toFixed(1);
}

export default function AdminPage() {
  const [data, setData]     = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feedback")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Topbar />
      <main className="flex-1 bg-slate-50 px-12 py-10">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-8">Feedback Dashboard</h1>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : data.length === 0 ? (
          <div className="text-slate-400 text-sm">No feedback yet.</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mb-10">
              {[
                { label: "Overall Rating",      value: avg(data, "overallRating") },
                { label: "UI Clarity",          value: avg(data, "uiClarity") },
                { label: "Ease of Finding Data", value: avg(data, "dataEase") },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-2">
                  <div className="text-xs text-slate-400 uppercase tracking-widest">{label}</div>
                  <div className="text-3xl font-bold text-[#003366]">{value}</div>
                  <Stars value={Math.round(Number(value))} />
                </div>
              ))}
            </div>

            {/* Total */}
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-widest">{data.length} responses</p>

            {/* Feedback list */}
            <div className="flex flex-col gap-4 max-w-3xl">
              {data.map(f => (
                <div key={f._id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{f.name || "Anonymous"}</div>
                      {f.email && <div className="text-xs text-slate-400">{f.email}</div>}
                    </div>
                    <div className="text-xs text-slate-300">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Overall",   value: f.overallRating },
                      { label: "UI Clarity", value: f.uiClarity },
                      { label: "Data Ease", value: f.dataEase },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
                        <div className="text-[10px] text-slate-400 mb-1">{label}</div>
                        <Stars value={value} />
                      </div>
                    ))}
                  </div>

                  {f.feedback && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">General Feedback</div>
                      <p className="text-sm text-slate-600 leading-relaxed">{f.feedback}</p>
                    </div>
                  )}

                  {f.suggestions && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Suggestions</div>
                      <p className="text-sm text-slate-600 leading-relaxed">{f.suggestions}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}