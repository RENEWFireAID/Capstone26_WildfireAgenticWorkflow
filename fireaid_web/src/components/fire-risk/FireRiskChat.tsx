"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "What was the fire danger in Fairbanks on June 15, 2022?",
  "How many fires were there in 2022?",
  "What's the risk for a lightning fire in July?",
];

const ERROR_REPLY = "Sorry, I couldn't get a response. Try again.";

export default function FireRiskChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the message list, not the page, so the form stays in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, loading]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;

    const history: Message[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/fire-risk/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Error bubbles are display-only and never sent back to the model.
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || typeof data?.message !== "string") throw new Error(data?.error ?? `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: data.message }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: ERROR_REPLY, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  function send(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white">
          <Bot size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">Ask about fire risk</div>
          <div className="text-xs text-slate-600">Fire history, risk predictions and fire danger forecasts</div>
        </div>
      </div>

      <div
        ref={listRef}
        className={`max-h-[420px] space-y-3 overflow-y-auto px-5 py-4 ${messages.length ? "min-h-[160px]" : ""}`}
      >
        {messages.length === 0 && (
          <div>
            <div className="text-sm text-slate-600">Try asking:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors duration-150 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-orange-500 text-white"
                  : m.error
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap">{m.content}</span>
              ) : (
                <div className="[&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">Typing…</div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-100 px-5 py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Ask a question"
          placeholder="Ask a question..."
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}
