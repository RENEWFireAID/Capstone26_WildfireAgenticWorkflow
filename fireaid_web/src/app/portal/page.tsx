"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/topbar/Topbar";
import {
  Send,
  Bot,
  User,
  RefreshCw,
  Paperclip,
  BarChart3,
  BookOpen,
  FileText,
  Flame,
  MessageSquare,
} from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { CONTOURS, PEAKS } from "@/components/layout/uafBackdrops";
import ReactMarkdown from "react-markdown";
import ChatChart, { type ChatChartSpec } from "@/components/chat/ChatChart";
import ModelBadge from "@/components/ui/ModelBadge";
import AnswerSources from "@/components/chat/AnswerSources";
import type { AnswerSource } from "@/lib/answerSources";

// sources is set on real answers only, so error replies show no evidence block.
type Message = { role: "user" | "assistant"; content: string; time: string; charts?: ChatChartSpec[]; sources?: AnswerSource[] };

const SUGGESTED = [
  "How many fires were there in Alaska in 2022?",
  "Chart acres burned per year since 2000",
  "What does research say about fire and permafrost thaw?",
  "What is a prescribed burn?",
];

// What the assistant's tools can reach, so people know what to ask.
const SOURCES = [
  { icon: Flame,     label: "Alaska fire records", detail: "33,596 fires, 1939–2024" },
  { icon: FileText,  label: "Research library",    detail: "101,856 paper abstracts" },
  { icon: BookOpen,  label: "Wildfire glossary",   detail: "Terms and definitions" },
  { icon: BarChart3, label: "Charts",              detail: "Drawn from the fire records" },
];

// uaf.edu's square white card and its gold condensed button.
const CARD = "bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]";
const GOLD_BUTTON =
  "flex items-center gap-2 bg-gold px-5 py-2 font-mono text-sm font-semibold uppercase tracking-wide text-navy-deep transition hover:bg-[#ffd94d] disabled:opacity-40";

export default function PortalPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [isSaving, setIsSaving] = useState(false); // NEW: Track save state
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // NEW FUNCTION: Save the chat to the database
  async function saveChat() {
    // Do nothing if there are no messages or if a save is already in progress
    if (messages.length === 0 || isSaving) return;
    
    setIsSaving(true);
    try {
      const res = await fetch("/api/ai/save_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      
      if (res.ok) {
        alert("Chat archived successfully!");
      } else {
        alert("Failed to save chat.");
      }
    } catch (error) {
      console.error("Error saving chat:", error);
      alert("An error occurred while saving the chat.");
    } finally {
      setIsSaving(false);
    }
  }

  async function send(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);
    const userMsg: Message = { role: "user", content: msg, time: new Date().toLocaleTimeString() };
    
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);

    try {
      console.log();
      console.log("CURRENT MESSAGE LIST");
      console.log(updatedMessages);
      console.log();
      const res = await fetch("/api/llm_query/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msgs: updatedMessages }),
      });
      const data = await res.json();
      const reply = data?.error
        ? `Error: ${data.error}`
        : data?.message ?? data?.msg ?? data?.content ?? "Sorry, I could not get a response.";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        time: new Date().toLocaleTimeString(),
        charts: data?.charts?.length ? data.charts : undefined,
        sources: data?.error ? undefined : data?.sources ?? [],
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: failed to get response.", time: new Date().toLocaleTimeString() }]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Topbar />

      <div className="flex flex-1">
        {/* SIDEBAR */}
        <FireAIDSidebar/>

        {/* MAIN */}
        <main className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
          {isEmpty ? (
            <>
              {/* uaf.edu's dark hero: navy with contour lines, holding the question box. */}
              <section className="px-6 py-14 md:px-10" style={{ backgroundColor: "var(--color-navy-deep)", backgroundImage: CONTOURS }}>
                <div className="mx-auto w-full max-w-3xl">
                  <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-uaf-sky">FireAID Assistant</p>
                  <h1 className="mt-1 text-4xl font-bold leading-tight text-white text-balance md:text-5xl">Ask about Alaska wildfires</h1>
                  <p className="mt-3 text-base leading-relaxed text-slate-200">
                    Answers are drawn from FireAID&apos;s own data and cite where each fact came from.
                  </p>
                  <ModelBadge feature="agent" className="mt-3" onDark />

                  <div className={`mt-7 flex flex-col gap-3 border-t-4 border-gold px-5 py-4 ${CARD}`}>
                    <label htmlFor="portal-question" className="sr-only">Your question</label>
                    <textarea
                      id="portal-question"
                      rows={3}
                      className="w-full resize-none bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="Ask a question about Alaska wildfires…"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      disabled={loading}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Enter to send · Shift+Enter for a new line</span>
                      <button className={GOLD_BUTTON} onClick={() => send()} disabled={loading || !input.trim()}>
                        <Send size={14} aria-hidden="true" />
                        Send
                      </button>
                    </div>
                  </div>

                  <div className="mt-7">
                    <p className="font-mono text-sm font-semibold uppercase tracking-wide text-white">Try asking</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SUGGESTED.map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="border border-white/50 px-3.5 py-2 text-left text-sm text-white transition hover:border-gold hover:bg-gold hover:text-navy-deep"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* uaf.edu's icon blocks on UAF Blue, filling down to the bottom of the page. */}
              <section className="flex-1 px-6 py-14 md:px-10" style={{ backgroundColor: "var(--color-navy)", backgroundImage: PEAKS }}>
                <div className="mx-auto w-full max-w-5xl">
                  <h2 className="text-3xl font-bold text-white">What it can look up</h2>
                  <p className="mt-1 text-sm text-slate-200">The assistant answers from these sources and names the one it used.</p>
                  <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                    {SOURCES.map(({ icon: Icon, label, detail }) => (
                      <li key={label} className="flex flex-col items-center text-center text-white">
                        <Icon size={52} strokeWidth={1.25} aria-hidden="true" />
                        <h3 className="mt-4 text-2xl font-bold">{label}</h3>
                        <p className="mt-2 font-mono text-sm font-semibold uppercase tracking-wide text-uaf-sky">{detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
                <ModelBadge feature="agent" />
                <button
                  className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500 underline-offset-2 transition hover:text-navy hover:underline"
                  onClick={() => setMessages([])}
                >
                  Clear chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl mx-auto w-full">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center text-xs ${msg.role === "user" ? "bg-slate-200 text-slate-700" : "bg-navy text-white"}`}>
                      {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                    </div>

                    <div className={`${msg.charts?.length ? "max-w-[95%] w-full" : "max-w-[80%]"} px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-navy-soft text-slate-800"
                        : "border-l-4 border-navy bg-white text-slate-800 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.5)]"
                    }`}>
                      <div>
                        <ReactMarkdown
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-lg font-semibold mb-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-base font-semibold mb-1" {...props} />,
                          }}
                        >{msg.content}</ReactMarkdown>
                      </div>

                      {msg.charts?.map((c, j) => <ChatChart key={j} chart={c} />)}

                      {msg.role === "assistant" && msg.sources && <AnswerSources sources={msg.sources} />}

                      <div className="mt-1 text-[10px] text-slate-400">{msg.time}</div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-navy text-white">
                      <Bot size={14} />
                    </div>
                    <div className="flex items-center gap-2 border-l-4 border-navy bg-white px-4 py-3 text-sm text-slate-500">
                      <RefreshCw size={14} className="animate-spin text-navy" />
                      Looking it up…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-200 bg-white px-6 py-4">
                <div className="max-w-3xl mx-auto">
                  <div className="flex flex-col gap-3 border border-slate-300 border-t-4 border-t-gold bg-white px-4 py-3 focus-within:border-navy focus-within:border-t-gold">
                    <textarea
                      rows={2}
                      className="w-full resize-none text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
                      placeholder="Ask FireAID about wildfire data..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      disabled={loading}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={saveChat}
                        disabled={isEmpty || isSaving}
                        className="flex items-center gap-2 border border-navy bg-white px-4 py-2 font-mono text-sm font-semibold uppercase tracking-wide text-navy transition hover:bg-navy-soft disabled:opacity-40"
                      >
                        <Paperclip size={14} className="-rotate-45" />
                        {isSaving ? "Saving..." : "Save chat"}
                      </button>
                      {/* Send Button */}
                      <button
                        className={GOLD_BUTTON}
                        onClick={() => send()}
                        disabled={loading || !input.trim()}
                      >
                        <Send size={14} />
                        Send
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 text-center">
                    FireAID Assistant may make mistakes. For research purposes only.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* Feedback floating button */}
      <Link
        href="/feedback"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-navy px-4 py-2.5 font-mono text-sm font-semibold uppercase tracking-wide text-white shadow-lg ring-1 ring-white/30 transition hover:bg-navy-deep"
      >
        <MessageSquare size={15} aria-hidden="true" />
        Feedback
      </Link>
    </div>
  );
}