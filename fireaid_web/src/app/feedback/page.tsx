"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/topbar/Topbar";
import { LayoutGrid, Database, Terminal, Star } from "lucide-react";

const SIDEBAR_ITEMS = [
  { key: "apps",   label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",   label: "DATA",   icon: Database,   href: "/data" },
  { key: "prompt", label: "PROMPT", icon: Terminal,   href: "/prompt" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition"
        >
          <Star
            size={28}
            className={`transition ${(hover || value) >= star ? "fill-[#FFCC33] text-[#FFCC33]" : "text-slate-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const [form, setForm] = useState({
    name: "", email: "",
    overallRating: 0, uiClarity: 0, dataEase: 0,
    feedback: "", suggestions: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!form.overallRating || !form.uiClarity || !form.dataEase) {
      alert("Please fill in all ratings.");
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch {
      alert("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Topbar />
      <div className="flex flex-1">
        <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shrink-0">
          {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
            <Link key={key} href={href}
              className="rounded-xl text-slate-400 hover:bg-slate-100 hover:text-[#003366] transition w-11 py-2.5 flex flex-col items-center gap-1 text-[8px] font-semibold tracking-widest">
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </aside>

        <main className="flex-1 flex flex-col bg-slate-50">
          <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID</p>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">User Feedback</h1>
            <p className="text-slate-400 text-sm mt-1">Help us improve FireAID — your feedback matters!</p>
          </div>

          <div className="flex-1 px-12 py-10">
            {submitted ? (
              <div className="max-w-xl flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="text-2xl font-semibold text-slate-800">Thank you!</h2>
                <p className="text-slate-400 text-sm">Your feedback has been submitted successfully.</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", overallRating: 0, uiClarity: 0, dataEase: 0, feedback: "", suggestions: "" }); }}
                  className="mt-4 px-6 py-2.5 bg-[#003366] text-white rounded-xl text-sm font-semibold hover:bg-[#002244] transition"
                >
                  Submit another
                </button>
              </div>
            ) : (
              <div className="max-w-xl flex flex-col gap-8">

                {/* Name & Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-500">Name <span className="text-slate-300">(optional)</span></label>
                    <input
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#003366] transition bg-white"
                      placeholder="Your name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-500">Email <span className="text-slate-300">(optional)</span></label>
                    <input
                      className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#003366] transition bg-white"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Ratings */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">Overall Rating <span className="text-red-400">*</span></label>
                    <StarRating value={form.overallRating} onChange={v => setForm(f => ({ ...f, overallRating: v }))} />
                  </div>
                  <div className="border-t border-slate-100" />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">UI Clarity <span className="text-red-400">*</span></label>
                    <StarRating value={form.uiClarity} onChange={v => setForm(f => ({ ...f, uiClarity: v }))} />
                  </div>
                  <div className="border-t border-slate-100" />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">Ease of Finding Data <span className="text-red-400">*</span></label>
                    <StarRating value={form.dataEase} onChange={v => setForm(f => ({ ...f, dataEase: v }))} />
                  </div>
                </div>

                {/* Feedback */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500">General Feedback</label>
                  <textarea
                    rows={4}
                    className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#003366] transition bg-white resize-none"
                    placeholder="What did you like? What was confusing?"
                    value={form.feedback}
                    onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))}
                  />
                </div>

                {/* Suggestions */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500">Specific Suggestions</label>
                  <textarea
                    rows={4}
                    className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#003366] transition bg-white resize-none"
                    placeholder="Any specific features or improvements you'd like to see?"
                    value={form.suggestions}
                    onChange={e => setForm(f => ({ ...f, suggestions: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <textarea
                    rows={4}
                    className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#003366] transition bg-white resize-none"
                    placeholder="Did you find the website useful?"
                    value={form.suggestions}
                    onChange={e => setForm(f => ({ ...f, suggestions: e.target.value }))}
                  />
                </div>
                

                <div className="flex flex-col gap-1.5">
                  <textarea
                    rows={4}
                    className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#003366] transition bg-white resize-none"
                    placeholder="Could you tell us how you would like to use it?"
                    value={form.suggestions}
                    onChange={e => setForm(f => ({ ...f, suggestions: e.target.value }))}
                  />
                </div>
               

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 bg-[#003366] text-white rounded-xl text-sm font-semibold hover:bg-[#002244] disabled:opacity-40 transition"
                >
                  {loading ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}