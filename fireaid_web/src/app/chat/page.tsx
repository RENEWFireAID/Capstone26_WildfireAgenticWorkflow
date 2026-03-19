"use client";

import { useState, useEffect, useRef } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { Send, RefreshCw, Bot, User } from "lucide-react";

type Message = { role: "user" | "ai"; content: string; time: string };

const SUGGESTED = [
  "How many fires were recorded in Alaska in 2022?",
  "What is the most common cause of wildfires in Alaska?",
  "Which year had the most acres burned?",
  "Tell me about prescribed burns in Interior Alaska",
  "What fuel types are most associated with large fires?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hi! I'm FireAID Assistant. Ask me anything about Alaska wildfire data, trends, terminology, or analysis.", time: new Date().toLocaleTimeString() }
  ]);
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
    setMessages(prev => [...prev, userMsg]);

    try {
      // ============================================================
      // API INTEGRATION POINT
      // Connect your AI backend here.
      //
      // Current endpoint: /api/chat (see src/app/api/chat/route.ts)
      // Requires: OPENROUTER_API_KEY in .env
      // Model: google/gemini-flash-1.5 (can be changed in route.ts)
      //
      // To switch to a different AI provider:
      // 1. Update /api/chat/route.ts with your API logic
      // 2. Set the appropriate API key in .env
      // 3. The request format: { message: string }
      //    The response format: { message: string }
      // ============================================================
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const reply = data?.message ?? data?.msg ?? data?.content ?? "Sorry, I could not get a response.";
      setMessages(prev => [...prev, { role: "ai", content: reply, time: new Date().toLocaleTimeString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", content: "Error: failed to get response.", time: new Date().toLocaleTimeString() }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1fr)]">
      <FireAIDSidebar active="chat" />

      <div className="flex min-h-[calc(100vh-5rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white">
            <Bot size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">FireAID Assistant</div>
            <div className="text-xs text-slate-400">Powered by AI · Alaska wildfire data expert</div>
          </div>
          <button
            className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            onClick={() => setMessages([{ role: "ai", content: "Hi! I'm FireAID Assistant. Ask me anything about Alaska wildfire data, trends, terminology, or analysis.", time: new Date().toLocaleTimeString() }])}
          >
            Clear chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${msg.role === "user" ? "bg-orange-500" : "bg-blue-500"}`}>
                {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-orange-50 border border-orange-100 text-slate-800"
                  : "bg-blue-50 border border-blue-100 text-slate-800"
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className="mt-1 text-[10px] text-slate-400">{msg.time}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                <Bot size={14} />
              </div>
              <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
                <RefreshCw size={14} className="animate-spin text-blue-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested queries */}
        {messages.length === 1 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {SUGGESTED.map(q => (
              <button key={q} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder:text-slate-400"
              placeholder="Ask FireAID about wildfire data..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              disabled={loading}
            />
            <button
              className="rounded-xl bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              onClick={() => send()}
              disabled={loading || !input.trim()}
            >
              <Send size={14} />
            </button>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 text-center">
            FireAID Assistant may make mistakes. For research purposes only.
          </div>
        </div>
      </div>
    </div>
  );
}