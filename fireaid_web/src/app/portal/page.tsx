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
import ReactMarkdown from "react-markdown";
import ChatChart, { type ChatChartSpec } from "@/components/chat/ChatChart";
import ModelBadge from "@/components/ui/ModelBadge";

type Message = { role: "user" | "assistant"; content: string; time: string; charts?: ChatChartSpec[] };

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
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
              <div className="w-full max-w-2xl">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">FireAID Assistant</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy-deep text-balance">Ask about Alaska wildfires</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                  Answers are drawn from FireAID&apos;s own data and cite where each fact came from.
                </p>
                <ModelBadge feature="agent" className="mt-2" />

                <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus-within:border-navy">
                  <label htmlFor="portal-question" className="sr-only">Your question</label>
                  <textarea
                    id="portal-question"
                    rows={3}
                    className="w-full resize-none bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder="Ask a question about Alaska wildfires…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    disabled={loading}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Enter to send · Shift+Enter for a new line</span>
                    <button
                      className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-40"
                      onClick={() => send()}
                      disabled={loading || !input.trim()}
                    >
                      <Send size={14} />
                      Send
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold text-slate-500">Try</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SUGGESTED.map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-navy hover:text-navy"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 border-t border-slate-200 pt-5">
                  <p className="text-xs font-semibold text-slate-500">What it can look up</p>
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {SOURCES.map(({ icon: Icon, label, detail }) => (
                      <li key={label} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-soft text-navy">
                          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="font-semibold text-slate-800">{label}</span>
                          <span className="block font-mono text-[11px] text-slate-500">{detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-100">
                <ModelBadge feature="agent" />
                <button
                  className="text-xs text-slate-400 hover:text-slate-600 transition"
                  onClick={() => setMessages([])}
                >
                  Clear chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl mx-auto w-full">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${msg.role === "user" ? "bg-slate-200 text-slate-700" : "bg-navy text-white"}`}>
                      {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                    </div>

                    <div className={`${msg.charts?.length ? "max-w-[95%] w-full" : "max-w-[80%]"} rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-navy-soft text-slate-800"
                        : "bg-white border border-slate-200 text-slate-800"
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

                      <div className="mt-1 text-[10px] text-slate-400">{msg.time}</div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                      <Bot size={14} />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                      <RefreshCw size={14} className="animate-spin text-navy" />
                      Looking it up…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-100 px-6 py-4">
                <div className="max-w-3xl mx-auto">
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus-within:border-navy">
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
                        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy disabled:opacity-40"
                      >
                        <Paperclip size={14} className="-rotate-45" />
                        {isSaving ? "Saving..." : "Save chat"}
                      </button>
                      {/* Send Button */}
                      <button
                        className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-40"
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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-navy-deep"
      >
        <MessageSquare size={15} aria-hidden="true" />
        Feedback
      </Link>
    </div>
  );
}