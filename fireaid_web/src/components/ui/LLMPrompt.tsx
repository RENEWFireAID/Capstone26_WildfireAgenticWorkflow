import { send } from "process";
import React, { useState } from "react";
import { Role, Message, AIResponse } from "../../types/LLMPrompt.d"

function ChatBubble({
  role,
  text,
  tone,
}: {
  role: string;
  text: string;
  tone: Role;
}) {
  const baseClasses =
    tone === Role.user
      ? "bg-amber-100"
      : tone === Role.ai
      ? "bg-emerald-100 border border-emerald-200"
      : "bg-slate-100";

  return (
    <div className={`rounded-2xl px-3 py-2 text-xs shadow-sm ${baseClasses}`}>
      <div className="mb-1 text-[10px] font-semibold text-slate-500">
        {role}
      </div>
      <pre className="whitespace-pre-wrap font-sans text-slate-800">{text}</pre>
    </div>
  );
}

export default function LLMPrompt() {

    const [chats, setChats] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("")


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        let user_input = inputValue
        setInputValue("")

        let user_chat = {src: Role.user, msg: user_input, key: chats.length > 0 ? chats[chats.length-1].key + 1 : 0}
        setChats([...chats, user_chat, {src: Role.ai, msg: "...", key: chats.length > 0 ? chats[chats.length-1].key + 2 : 1}])
        
        const response: AIResponse = await fetch("/api/ai/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msg: user_input }),})
        .then((res) => {
          if (res.status == 200) {
            return res.json()
          }
          return null
        })

        if (response == null) {
          console.log("ERROR: Got bad status code from /api/ai/query")
          return
        }

        setChats([...chats, user_chat, { src: Role.ai, msg: response.msg, key: chats.length > 0 ? chats[chats.length-1].key + 3 : 2 }])
    }

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    
    return (
          <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Prompt-Based App
            </h2>

            <div 
                id="LLMPromptConversation"
                className="mb-3 max-h-94 space-y-3 overflow-y-auto text-xs"
            >{chats.map(chat => <ChatBubble
                role={chat.src == Role.user ? "User" : "AI Model"}
                tone={chat.src}
                text={chat.msg}
                key={chat.key}
              />)}</div>

            <form
              className="absolute inset-x-0 bottom-0 h-16 mt-2 mr-2 ml-2 flex items-center gap-2"
              onSubmit={handleSubmit}
            >
              <input
                className="h-9 flex-1 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]"
                placeholder="Ask FireGPT about this area..."
                value={inputValue}
                onChange={handleChange}
              />
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#003366] text-xs font-semibold text-white hover:bg-slate-900"
              >
                ➤
              </button>
            </form>
          </div>
    )
}
