import React, { useState } from "react";
import { Role, Message, AIResponse } from "../../types/LLMPrompt.d"

function ChatBubble({ role, text, tone }: { role: string; text: string; tone: Role }) {
  const baseClasses =
    tone === Role.user
      ? "bg-amber-50 border border-amber-200"
      : "bg-emerald-50 border border-emerald-200";
  return (
    <div className={`rounded-2xl px-4 py-3 text-xs shadow-sm ${baseClasses}`}>
      <div className="mb-1 text-[10px] font-semibold text-slate-500">{role}</div>
      <pre className="whitespace-pre-wrap font-sans text-slate-800 leading-relaxed">{text}</pre>
    </div>
  );
}

export default function LLMPrompt() {
  const [chats, setChats] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user_input = inputValue.trim();
    if (!user_input) return;
    setInputValue("");

    const userChat: Message = { src: Role.user, msg: user_input, key: Date.now() };
    const loadingChat: Message = { src: Role.ai, msg: "...", key: Date.now() + 1 };
    const next = [...chats, userChat, loadingChat];
    setChats(next);

    const response: AIResponse = await fetch("/api/ai/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg: user_input }),
    }).then(res => res.ok ? res.json() : null);

    if (!response) {
      setChats([...chats, userChat, { src: Role.ai, msg: "Error: failed to get response.", key: Date.now() + 2 }]);
      return;
    }
    setChats([...chats, userChat, { src: Role.ai, msg: response.msg, key: Date.now() + 2 }]);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Prompt-Based App</h2>

      {/* 对话区 */}
      <div className="flex-1 min-h-[200px] max-h-[480px] overflow-y-auto space-y-3 pr-1">
        {chats.length === 0 && (
          <div className="text-xs text-slate-400 text-center mt-8">
            Ask FireAID anything about wildfire data...
          </div>
        )}
        {chats.map(chat => (
          <ChatBubble
            key={chat.key}
            role={chat.src === Role.user ? "User" : "AI Model"}
            tone={chat.src}
            text={chat.msg}
          />
        ))}
      </div>

      {/* 输入区 */}
      <form className="mt-4 flex items-center gap-2" onSubmit={handleSubmit}>
        <input
          className="h-10 flex-1 rounded-full border border-slate-300 bg-white px-4 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]"
          placeholder="Ask FireAID about this area..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
        />
        <button
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#003366] text-white hover:bg-slate-900"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
