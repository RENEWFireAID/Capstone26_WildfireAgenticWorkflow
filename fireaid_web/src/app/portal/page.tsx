"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import { LayoutGrid, Database, Terminal, BarChart3, Send, Bot, User, RefreshCw } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; time: string };

const SUGGESTED = [
  "How many fires in Alaska in 2022?",
  "Most common cause of wildfires?",
  "Which year had the most acres burned?",
  "Tell me about prescribed burns",
  "What fuel types cause large fires?",
];

const SIDEBAR_ITEMS = [
  { key: "apps",   label: "APPS",   icon: LayoutGrid, href: "/apps" },
  { key: "data",   label: "DATA",   icon: Database,   href: "/data" },
  { key: "visualization", label: "VISUAL", icon: BarChart3,  href: "/visualization" },
  { key: "prompt", label: "PROMPT", icon: Terminal,    href: "/prompt" },
];

export default function PortalPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msgs: updatedMessages }),
      });
      const data = await res.json();
      const reply = data?.message ?? data?.msg ?? data?.content ?? "Sorry, I could not get a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, time: new Date().toLocaleTimeString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: failed to get response.", time: new Date().toLocaleTimeString() }]);
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex w-full">
      {/* SIDEBAR */}
      <aside className="w-14 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 flex-shrink-0 min-h-screen">
        {SIDEBAR_ITEMS.map(({ key, label, icon: Icon, href }) => (
          <Link
            key={key}
            href={href}
            className="w-11 py-2.5 rounded-xl flex flex-col items-center gap-1 text-slate-400 hover:bg-slate-100 hover:text-[#003366] transition text-[8px] font-semibold tracking-widest"
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-h-screen bg-slate-50">

        {/* EMPTY STATE — centered like Claude */}
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 gap-10">
            {/* Title */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-4xl">🔥</span>
                <h1 className="text-4xl font-semibold text-slate-800 tracking-tight">
                  FireAID Assistant
                </h1>
              </div>
              <p className="text-slate-400 text-sm">Ask me anything about Alaska wildfire data</p>
            </div>

            {/* Input box */}
            <div className="w-full max-w-2xl">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col gap-4">
                <textarea
                  rows={3}
                  className="w-full resize-none text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
                  placeholder="How can I help you today?"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={loading}
                />
                <div className="flex justify-end">
                  <button
                    className="rounded-xl bg-[#003366] px-5 py-2 text-white text-sm hover:bg-[#002244] disabled:opacity-40 flex items-center gap-2 transition"
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                  >
                    <Send size={14} />
                    Send
                  </button>
                </div>
              </div>

              {/* Suggested pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:border-[#003366] hover:text-[#003366] transition shadow-sm"
                    onClick={() => send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

        ) : (
          /* CHAT STATE — messages + input at bottom */
          <div className="flex-1 flex flex-col">
            {/* Clear button */}
            <div className="flex justify-end px-6 py-3 border-b border-slate-100">
              <button
                className="text-xs text-slate-400 hover:text-slate-600 transition"
                onClick={() => setMessages([])}
              >
                Clear chat
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl mx-auto w-full">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs ${msg.role === "user" ? "bg-orange-500" : "bg-[#003366]"}`}>
                    {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-white border border-slate-200 text-slate-800"
                      : "bg-blue-50 border border-blue-100 text-slate-800"
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{msg.time}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003366] text-white">
                    <Bot size={14} />
                  </div>
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
                    <RefreshCw size={14} className="animate-spin text-[#003366]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 px-6 py-4">
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col gap-3">
                  <textarea
                    rows={2}
                    className="w-full resize-none text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
                    placeholder="Ask FireAID about wildfire data..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    disabled={loading}
                  />
                  <div className="flex justify-end">
                    <button
                      className="rounded-xl bg-[#003366] px-5 py-2 text-white text-sm hover:bg-[#002244] disabled:opacity-40 flex items-center gap-2 transition"
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
  );
}
