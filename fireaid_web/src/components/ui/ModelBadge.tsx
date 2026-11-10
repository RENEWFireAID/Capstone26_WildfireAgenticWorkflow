"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import type { ModelFeature } from "@/lib/models";

type ModelInfo = { id: string; task?: string };

// One request per page load, shared by every badge on the page.
let modelsRequest: Promise<Record<ModelFeature, ModelInfo[]>> | null = null;

function loadModels() {
  modelsRequest ??= fetch("/api/models").then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  return modelsRequest;
}

// "anthropic/claude-sonnet-4-5" -> "Claude Sonnet 4.5", "openai/gpt-4o-mini" -> "GPT-4o mini"
export function modelName(id: string): string {
  return (id.split("/").pop() ?? id)
    .replace(/(\d)-(\d)/g, "$1.$2")
    .split("-")
    .map((w) => (w === "gpt" ? "GPT" : w === "mini" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/^GPT /, "GPT-");
}

export default function ModelBadge({ feature, className = "" }: { feature: ModelFeature; className?: string }) {
  const [models, setModels] = useState<ModelInfo[] | null>(null);

  useEffect(() => {
    let live = true;
    loadModels()
      .then((all) => live && setModels(all[feature] ?? null))
      .catch(() => {
        modelsRequest = null;
      });
    return () => {
      live = false;
    };
  }, [feature]);

  if (!models?.length) return null;

  return (
    <div className={`flex items-center gap-1.5 text-[11px] text-slate-400 ${className}`} title={models.map((m) => m.id).join(", ")}>
      <Cpu size={12} aria-hidden="true" />
      <span>
        {models.length > 1 ? "Models: " : "Model: "}
        {models.map((m, i) => (
          <span key={m.id}>
            {i > 0 && ", "}
            <span className="font-medium text-slate-500">{modelName(m.id)}</span>
            {m.task && ` (${m.task})`}
          </span>
        ))}
      </span>
    </div>
  );
}
