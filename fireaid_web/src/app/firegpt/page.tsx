"use client";

import { useState, useEffect } from "react";
import FireGPTSidebar from "@/components/layout/FireGPTSidebar";
import Popup from "@/components/ui/TermEntry";
import dynamic from "next/dynamic";

const FireMap = dynamic(() => import("@/components/map/FireMap"), {
  ssr: false,
});


const TABS = ["Map", "Charts", "Code", "JSON"] as const;
type Tab = (typeof TABS)[number];

export default function FireGPTPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Map");
  const [showPopUp, setShowPopUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termList, setTermList] = useState<Term[]>([]);


  const getTerms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/get_terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
      });

      const json = await res.json();

      if (!res.ok) {
          console.error(json.message);
      } else {
          console.log("Success:", json);

          let list: Term[] = [];

          json.forEach((i: Object) => {
            console.log(i);
            let t = i as Term;
            list.push(t);
          })

          setTermList(list);
          console.log(termList);
      }
    } catch (err) {
        console.error("Failed to get terms:", err);
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    if (!ignore) getTerms()
    return () => { ignore = true; }
  }, []);

  return (
    <div className="flex gap-5">
      {/* 左侧导航：当前在 FireGPT 主分析页 */}
      <FireGPTSidebar active="firegpt" />

      {/* 右侧主内容 */}
      <div className="flex-1 space-y-6">
        {/* 1. Terminology Library 顶部大模块 */}
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Terminology Library{" "}
              <span className="text-sm text-slate-500">(MCP-resource)</span>
            </h2>
            <div className="flex gap-2">
              <button className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Query a term
              </button>
              <button className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Explore knowledge map
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto text-xs">
            <table className="min-w-full border-separate border-spacing-y-1">
              <thead className="text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="rounded-l-lg bg-slate-50 px-3 py-2 text-left">
                    Terminology
                  </th>
                  <th className="bg-slate-50 px-3 py-2 text-left">
                    Description
                  </th>
                  <th className="bg-slate-50 px-3 py-2 text-left">
                    Proposed by
                  </th>
                  <th className="rounded-r-lg bg-slate-50 px-3 py-2 text-left">
                    LLM summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {termList.map(i => 
                  <TerminologyRow
                    key={i._id}
                    term={i.term}
                    desc={i.def}
                    proposer="Name & role"
                    summary="An LLM generated summary of the term."
                  />)}
              </tbody>
            </table>
            <Popup showPopUp={showPopUp} closePopUp={()=>setShowPopUp(false)}>
              <h2 className="text-xl font-bold text-slate-900"></h2>
            </Popup>
          </div>
        </section>

        {/* 2. 下方三列：左 Data Library / 中 Visualization / 右 Prompt App */}
        <div className="grid grid-cols-[280px_1fr_320px] gap-6">
          {/* 左：Data Library */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Data Library{" "}
                <span className="text-[11px] text-slate-500">
                  (MCP-resource)
                </span>
                <button className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={()=>setShowPopUp(true)}>
                  Add terms
                </button>
              </h3>
              <DataItem
                title="Lidar tile (63.53° N, 147.3° W)"
                source="FNSB"
                type="Canopy height model / CHM"
              />
              <DataItem
                title="Sentinel satellite data"
                source="ASF"
                type="Optical imagery"
              />
              <DataItem
                title="VIIRS satellite data"
                source="GINA"
                type="Active fire / thermal"
              />
              <DataItem
                title="Weather station data"
                source="GINA"
                type="Temperature / wind / precipitation"
              />
            </section>
          </aside>

          {/* 中：FireGPT Data Visualization */}
          <main className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                FireGPT — Data Visualization
              </h2>
              <div className="hidden rounded-full bg-slate-100 p-1 text-xs md:flex">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-3 py-1 transition ${
                      activeTab === tab
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-slate-700">
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                ●
              </span>
              Mouse clicked at <strong>64.84° N</strong>,{" "}
              <strong>147.72° W</strong> · radius: <strong>10 mi</strong>
            </div>

            {activeTab === "Map" && (
                <div className="h-72 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <FireMap />
                 </div>
                )}


            {activeTab === "Charts" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-xs font-semibold text-slate-800">
                    Monthly NDVI trend
                  </h3>
                  <div className="h-40 rounded-lg bg-gradient-to-t from-emerald-100 to-emerald-50 text-[10px] text-slate-400">
                    chart placeholder
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-xs font-semibold text-slate-800">
                    Precipitation vs fire risk
                  </h3>
                  <div className="h-40 rounded-lg bg-gradient-to-t from-sky-100 to-sky-50 text-[10px] text-slate-400">
                    chart placeholder
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Code" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-800">
                <div className="mb-2 text-[11px] text-slate-500">
                  Generated Python app (Demo-1):
                </div>
                <pre className="overflow-x-auto">
{`def run_demo_1():
    ndvi = load_ndvi(time_range="2015-2024")
    precip = load_precipitation(time_range="2015-2024")
    fig = plot_ndvi_vs_precip(ndvi, precip)
    fig.save("ndvi_precip_demo_1.png")`}
                </pre>
              </div>
            )}

            {activeTab === "JSON" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-800">
                <div className="mb-2 text-[11px] text-slate-500">
                  Result metadata (preview):
                </div>
                <pre className="overflow-x-auto">
{`{
  "location": { "lat": 64.84, "lon": -147.72, "radius_mi": 10 },
  "datasets": ["lidar_tile", "viirs_vi", "weather_station"],
  "generated_app": "Demo-1",
  "risk_level": "high"
}`}
                </pre>
              </div>
            )}
          </main>

          {/* 右：Prompt-based App */}
          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Prompt-Based App
            </h2>

            <div className="mb-3 max-h-64 space-y-3 overflow-y-auto text-xs">
              <ChatBubble
                role="Human wildfire enthusiast"
                tone="user"
                text="What data are available in a 10-mile radius?"
              />
              <ChatBubble
                role="AI agent"
                tone="ai"
                text={
                  "1. Lidar tile data (63.53° N, 147.3° W)\n" +
                  "2. Sentinel & VIIRS imagery of the area\n" +
                  "3. Weather station time series at 63.5° N, 147.32° W"
                }
              />
              <ChatBubble
                role="Human wildfire enthusiast"
                tone="user"
                text="What system tools are available?"
              />
              <ChatBubble
                role="AI agent"
                tone="ai"
                text={
                  "Available tools:\n" +
                  "- NDVI on VIIRS data\n" +
                  "- CHM on Lidar data\n" +
                  "- Precipitation loader"
                }
              />
              <ChatBubble
                role="AI agent"
                tone="aiCta"
                text={
                  "Generate a Python app named `Demo-1` using this pipeline:\n" +
                  "• get NDVI trend\n" +
                  "• get precipitation trend\n" +
                  "• plot NDVI as a function of precipitation"
                }
              />
            </div>

            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => e.preventDefault()}
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
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ====== 辅助组件 ====== */

function TerminologyRow({
  term,
  desc,
  proposer,
  summary,
}: {
  term: string;
  desc: string;
  proposer: string;
  summary: string;
}) {
  return (
    <tr className="text-xs text-slate-800">
      <td className="rounded-l-lg bg-white px-3 py-2 font-semibold">
        {term}
      </td>
      <td className="bg-white px-3 py-2 text-slate-600">{desc}</td>
      <td className="bg-white px-3 py-2 text-slate-600">{proposer}</td>
      <td className="rounded-r-lg bg-white px-3 py-2 text-slate-600">
        {summary}
      </td>
    </tr>
  );
}

function DataItem({
  title,
  source,
  type,
}: {
  title: string;
  source: string;
  type: string;
}) {
  return (
    <div className="mb-2 rounded-lg bg-white px-3 py-2 text-[11px] shadow-sm">
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-slate-500">
        Source: <span className="font-medium">{source}</span>
      </div>
      <div className="text-slate-500">{type}</div>
    </div>
  );
}

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


interface Term {
  _id: string;
  term: string;
  def: string;
}
