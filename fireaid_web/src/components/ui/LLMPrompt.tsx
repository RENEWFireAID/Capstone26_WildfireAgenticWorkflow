import { send } from "process";

type BubbleTone = "user" | "ai" | "aiCta";

function ChatBubble({
  role,
  text,
  tone,
}: {
  role: string;
  text: string;
  tone: BubbleTone;
}) {
  const baseClasses =
    tone === "user"
      ? "bg-amber-50"
      : tone === "aiCta"
      ? "bg-emerald-50 border border-emerald-200"
      : "bg-slate-50";

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

    const sendQuery = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log("Sending Query")
    }
    return (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Prompt-Based App
            </h2>

            <div className="mb-3 max-h-64 space-y-3 overflow-y-auto text-xs">
              
            </div>

            <form
              className="mt-2 flex items-center gap-2 bottom-0"
              onSubmit={sendQuery}
            >
              <input
                className="h-9 flex-1 rounded-full border border-slate-300 bg-white px-3 text-xs outline-none placeholder:text-slate-400 focus:border-[#FFCC33] focus:ring-1 focus:ring-[#FFCC33]"
                placeholder="Ask FireGPT about this area..."
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
