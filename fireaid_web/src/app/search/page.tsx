"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { Search, Flame, Leaf, Calendar, Filter, X, ArrowUpDown, Download, MapPin, ChevronDown, Bot, Send, ChevronLeft, ChevronRight } from "lucide-react";


type Result = {
  NAME?: string;
  GENERALCAUSE?: string;
  FIRECAUSE?: string;
  PRIMARYFUELTYPE?: string;
  ESTIMATEDTOTALACRES?: number;
  acres?: number;
  year?: number;
  FIRESEASON?: number;
  PRESCRIBEDFIRE?: string;
  prescribed?: string;
  lat?: number;
  lon?: number;
  LATITUDE?: number;
  LONGITUDE?: number;
  SPECIFICCAUSE?: string;
  OWNERKIND?: string;
  SUPPRESSIONSTRATEGY?: string;
  ORIGINELEVATION?: string;
  ORIGINASPECT?: string;
  ORIGINSLOPE?: string;
  MGMTOPTIONID?: string;
  STRUCTURESBURNED?: number;
  STRUCTURESTHREATENED?: number;
  [key: string]: any;
};

type SortKey = "acres" | "year" | "name";
type SortDir = "asc" | "desc";
type ChatMsg = { role: "user" | "ai"; text: string };

const FIELD_OPTIONS: Record<string, string[]> = {
  GENERALCAUSE:        ["Lightning", "Human", "Recreation and ceremony", "Debris burning", "Unknown"],
  SPECIFICCAUSE:       ["Campfire", "Debris Burning", "Lightning", "Incendiary", "Smoking", "Equipment Use", "Children", "Railroad", "Unknown"],
  PRIMARYFUELTYPE:     ["Moss", "Timber", "Grass", "Shrub", "Slash", "Mixed"],
  OWNERKIND:           ["Private", "Federal", "State", "ANCSA", "Municipal", "Tribal"],
  SUPPRESSIONSTRATEGY: ["Full Suppression", "Monitor", "Modified Action", "Confine"],
  MGMTOPTIONID:        ["Critical", "Full", "Modified", "Limited"],
  ORIGINASPECT:        ["Flat", "North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"],
  ORIGINSLOPE:         ["0-25", "26-40", "41-55", "56-70", "71+"],
  ORIGINELEVATION:     ["0-500", "501-1000", "1001-2000", "2001-3000", "3001+"],
};

const FIELD_LABELS: Record<string, string> = {
  GENERALCAUSE:        "General Cause",
  SPECIFICCAUSE:       "Specific Cause",
  PRIMARYFUELTYPE:     "Fuel Type",
  OWNERKIND:           "Land Owner",
  SUPPRESSIONSTRATEGY: "Suppression Strategy",
  MGMTOPTIONID:        "Management Option",
  ORIGINASPECT:        "Aspect",
  ORIGINSLOPE:         "Slope",
  ORIGINELEVATION:     "Elevation",
};

const PAGE_SIZE = 100;

function getAcres(r: Result) { return Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0); }
function getYear(r: Result)  { return Number(r.year ?? r.FIRESEASON ?? 0); }
function getName(r: Result)  { return r.NAME ?? ""; }
function getPresc(r: Result) { return r.PRESCRIBEDFIRE ?? r.prescribed ?? "N"; }
function getCause(r: Result) { return r.GENERALCAUSE ?? r.FIRECAUSE ?? "Unknown"; }
function getFuel(r: Result)  { return r.PRIMARYFUELTYPE ?? "—"; }
function getLat(r: Result)   { return r.lat ?? r.LATITUDE; }
function getLon(r: Result)   { return r.lon ?? r.LONGITUDE; }

function exportCSV(rows: Result[]) {
  const keys = ["NAME","FIRESEASON","GENERALCAUSE","SPECIFICCAUSE","PRIMARYFUELTYPE","ESTIMATEDTOTALACRES","PRESCRIBEDFIRE","OWNERKIND","SUPPRESSIONSTRATEGY"];
  const header = keys.join(",");
  const body = rows.map(r => keys.map(k => '"' + String(r[k] ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "wildfire_search.csv"; a.click();
  URL.revokeObjectURL(url);
}

function buildContext(rows: Result[]): string {
  if (rows.length === 0) return "No fire data loaded.";
  const total = rows.length;
  const totalAcres = rows.reduce((s, r) => s + getAcres(r), 0);
  const causes: Record<string, number> = {};
  const fuels: Record<string, number> = {};
  const years: Record<string, number> = {};
  rows.forEach(r => {
    const c = getCause(r); causes[c] = (causes[c] || 0) + 1;
    const f = getFuel(r);  fuels[f]  = (fuels[f]  || 0) + 1;
    const y = String(getYear(r) || "Unknown"); years[y] = (years[y] || 0) + 1;
  });
  const topCause = Object.entries(causes).sort((a,b) => b[1]-a[1])[0];
  const topFuel  = Object.entries(fuels).sort((a,b)  => b[1]-a[1])[0];
  const topYear  = Object.entries(years).sort((a,b)  => b[1]-a[1])[0];
  return `Dataset: ${total} fires, ${(totalAcres/1000).toFixed(1)}K total acres. Top cause: ${topCause?.[0]} (${topCause?.[1]}). Top fuel: ${topFuel?.[0]}. Most active year: ${topYear?.[0]} (${topYear?.[1]} fires). Sample fires: ${rows.slice(0,3).map(r => r.NAME).join(", ")}.`;
}

export default function SearchPage() {
  const [query, setQuery]             = useState("");
  const [yearStart, setYearStart]     = useState("2015");
  const [yearEnd, setYearEnd]         = useState("2024");
  const [prescribed, setPrescribed]   = useState<"all" | "Y" | "N">("all");
  const [limit, setLimit]             = useState(200);
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
  const [results, setResults]         = useState<Result[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [searched, setSearched]       = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey]         = useState<SortKey>("acres");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [selected, setSelected]       = useState<Result | null>(null);
  const [chatMsgs, setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // added page state to manage pagination
  const [page, setPage]               = useState(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"search" | "live">("search");
  const [liveFireData, setLiveFireData] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  async function fetchLiveFires() {
    setLiveLoading(true); setLiveError(null);
    try {
      const url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Current_WildlandFire_Perimeters/FeatureServer/0/query" +
        "?where=1%3D1&outFields=IncidentName,GISAcres,PercentContained,POOState,CreateDate,ModifiedOnDateTime_dt&resultRecordCount=200&orderByFields=GISAcres+DESC&f=json";
      const res = await fetch(url);
      const data = await res.json();
      const features = (data.features ?? []).map((f: any) => f.attributes);
      setLiveFireData(features);
    } catch (e: any) {
      setLiveError("Failed to load live fire data.");
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "live" && liveFireData.length === 0) fetchLiveFires();
  }, [activeTab]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...results].sort((a, b) => {
    let va: any, vb: any;
    if (sortKey === "acres")     { va = getAcres(a); vb = getAcres(b); }
    else if (sortKey === "year") { va = getYear(a);  vb = getYear(b); }
    else                         { va = getName(a).toLowerCase(); vb = getName(b).toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Page calculation
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pagedResults = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, sorted.length);

  async function runSearch() {
    setLoading(true); setError(null); setSearched(true);
    setPage(1); // reset the page 
    try {
      const body: Record<string, any> = {
        yearStart: yearStart ? Number(yearStart) : undefined,
        yearEnd:   yearEnd   ? Number(yearEnd)   : undefined,
        limit,
      };
      if (prescribed !== "all") body.prescribed = prescribed;
      const res  = await fetch("/api/mcp/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      let rows: Result[] = data.results ?? [];
      if (query.trim()) {
        const q = query.toLowerCase();
        rows = rows.filter(r => r.NAME?.toLowerCase().includes(q) || r.GENERALCAUSE?.toLowerCase().includes(q) || r.PRIMARYFUELTYPE?.toLowerCase().includes(q) || r.SPECIFICCAUSE?.toLowerCase().includes(q));
      }
      Object.entries(fieldFilters).forEach(([field, value]) => {
        if (value) rows = rows.filter(r => String(r[field] ?? "").toLowerCase() === value.toLowerCase());
      });
      setResults(rows);
      // Auto AI summary
      const ctx = buildContext(rows);
      setChatMsgs([{ role: "ai", text: `I found ${rows.length} fires. ${ctx} What would you like to know?` }]);
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMsgs(m => [...m, { role: "user", text: userMsg }]);
    setChatLoading(true);
    try {
      const ctx = buildContext(results);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: `You are a wildfire data analyst. Context: ${ctx}\n\nUser question: ${userMsg}` }
          ]
        }),
      });
      const data = await res.json();
      const reply = data?.content?.[0]?.text ?? data?.reply ?? data?.message ?? "Sorry, I could not generate a response.";
      setChatMsgs(m => [...m, { role: "ai", text: reply }]);
    } catch {
      setChatMsgs(m => [...m, { role: "ai", text: "Failed to get AI response. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  function clearAll() {
    setResults([]); setSearched(false); setQuery("");
    setFieldFilters({}); setPrescribed("all");
    setYearStart("2015"); setYearEnd("2024");
    setChatMsgs([]); setPage(1); // reset the page when clearing
  }

  const activeFilterCount = Object.values(fieldFilters).filter(Boolean).length + (prescribed !== "all" ? 1 : 0);

  // Quick stats
  const totalAcres  = results.reduce((s, r) => s + getAcres(r), 0);
  const prescribed_count = results.filter(r => getPresc(r) === "Y").length;
  const causes: Record<string, number> = {};
  results.forEach(r => { const c = getCause(r); causes[c] = (causes[c] || 0) + 1; });
  const topCause = Object.entries(causes).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "—";

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[288px_minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <FireAIDSidebar/>

      {/* Center: Search */}
      <div className="min-w-0 space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === "search" ? "bg-slate-900 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setActiveTab("search")}
          >
            🗂 Historical Search
          </button>
          <button
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === "live" ? "bg-red-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setActiveTab("live")}
          >
            🔴 Live Fires
          </button>
        </div>

        {activeTab === "live" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <div className="text-sm font-bold text-slate-900">Currently Active Wildfires</div>
                <div className="text-xs text-slate-400 mt-0.5">Source: NIFC WFIGS · Updates every 5 min</div>
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={fetchLiveFires}>
                ↻ Refresh
              </button>
            </div>
            {liveLoading && <div className="p-8 text-center text-sm text-slate-400">Loading live fire data…</div>}
            {liveError && <div className="p-4 text-sm text-red-600">{liveError}</div>}
            {!liveLoading && !liveError && liveFireData.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">No active fires found.</div>
            )}
            {!liveLoading && liveFireData.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="rounded-xl bg-red-50 p-3 text-center">
                    <div className="text-lg font-bold text-red-600">{liveFireData.length}</div>
                    <div className="text-[10px] text-slate-500">Active Fires</div>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-3 text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {(liveFireData.reduce((s, f) => s + (f.GISAcres ?? 0), 0) / 1000).toFixed(1)}K
                    </div>
                    <div className="text-[10px] text-slate-500">Total Acres</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {liveFireData.filter(f => f.POOState === "US-AK").length}
                    </div>
                    <div className="text-[10px] text-slate-500">In Alaska</div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {liveFireData.map((f, i) => {
                    const acres = f.GISAcres ?? 0;
                    const pct = f.PercentContained ?? 0;
                    const isAK = f.POOState === "US-AK";
                    return (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 ${isAK ? "bg-orange-50" : ""}`}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}>
                          {pct}%
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-900">{f.IncidentName ?? "Unknown"}</span>
                            {isAK && <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">AK</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">{f.POOState ?? "—"} · {pct}% contained</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-slate-900">{acres >= 1000 ? `${(acres/1000).toFixed(1)}K` : acres.toFixed(0)}</div>
                          <div className="text-[10px] text-slate-400">acres</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xl font-bold text-slate-900">Wildfire Search</div>
            <div className="mt-1 text-xs text-slate-500">Search fire records from local database</div>
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 placeholder:text-slate-400"
                  placeholder="Search by fire name, cause, or fuel type…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                />
              </div>
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50" onClick={runSearch} disabled={loading}>
                {loading ? "Searching…" : "Search"}
              </button>
              <button
                className={`relative rounded-xl border px-3 py-2 transition ${showFilters ? "border-blue-400 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={14} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{activeFilterCount}</span>
                )}
              </button>
            </div>
          </div>
        )}

        {showFilters && activeTab === "search" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-slate-900">Filter by field</div>
              <button className="text-xs text-slate-400 hover:text-slate-700" onClick={clearAll}>Clear all</button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-600">Year from</div>
                <input type="number" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-600">Year to</div>
                <input type="number" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-600">Prescribed fire</div>
                <div className="flex gap-1">
                  {(["all", "Y", "N"] as const).map((v) => (
                    <button key={v} className={`flex-1 rounded-lg py-2 text-xs font-semibold ${prescribed === v ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 border border-slate-200"}`} onClick={() => setPrescribed(v)}>
                      {v === "all" ? "All" : v === "Y" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-600">Limit</div>
                <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  {[100, 200, 500, 1000].map(n => <option key={n} value={n}>{n} records</option>)}
                </select>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 w-1/3">Field</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">Select value</th>
                    <th className="px-4 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(FIELD_LABELS).map(([field, label]) => (
                    <tr key={field} className={fieldFilters[field] ? "bg-blue-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-2.5 font-semibold text-slate-700">{label}</td>
                      <td className="px-4 py-2.5">
                        <div className="relative">
                          <select
                            className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none pr-7"
                            value={fieldFilters[field] ?? ""}
                            onChange={(e) => setFieldFilters(f => ({ ...f, [field]: e.target.value }))}
                          >
                            <option value="">All</option>
                            {FIELD_OPTIONS[field].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {fieldFilters[field] && (
                          <button onClick={() => setFieldFilters(f => { const n = {...f}; delete n[field]; return n; })}>
                            <X size={12} className="text-slate-400 hover:text-red-500" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50" onClick={runSearch} disabled={loading}>
              {loading ? "Searching…" : "Apply Filters & Search"}
            </button>
          </div>
        )}

        {activeTab === "search" && error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {searched && !loading && activeTab === "search" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="text-sm font-semibold text-slate-900">{results.length} result{results.length !== 1 ? "s" : ""}</div>
              <div className="flex items-center gap-2">
                {results.length > 0 && (
                  <button className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => exportCSV(sorted)}>
                    <Download size={12} /> Export CSV
                  </button>
                )}
                <button className="text-slate-400 hover:text-slate-700" onClick={clearAll}><X size={14} /></button>
              </div>
            </div>
            {results.length > 0 && (
              <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
                <span className="text-[11px] text-slate-400 self-center">Sort:</span>
                {(["acres", "year", "name"] as SortKey[]).map((k) => (
                  <button key={k} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${sortKey === k ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`} onClick={() => toggleSort(k)}>
                    {k === "acres" ? "Acres" : k === "year" ? "Year" : "Name"}
                    {sortKey === k && <ArrowUpDown size={10} />}
                  </button>
                ))}
              </div>
            )}
            {results.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No fires found. Try adjusting your filters.</div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {/* Show all results */}
                  {pagedResults.map((r, i) => {
                    const acres = getAcres(r);
                    const year  = getYear(r) || "—";
                    const presc = getPresc(r);
                    return (
                      <div key={i} className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-slate-50 transition" onClick={() => setSelected(r)}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${presc === "Y" ? "bg-emerald-500" : "bg-orange-500"}`}>
                          {presc === "Y" ? <Leaf size={14} /> : <Flame size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{r.NAME ?? "Unnamed fire"}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[11px] text-slate-500"><Calendar size={10} /> {year}</span>
                            <span className="text-[11px] text-slate-400">{getCause(r)}</span>
                            <span className="text-[11px] text-slate-400">{getFuel(r)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-slate-900">{acres >= 1000 ? `${(acres/1000).toFixed(1)}K` : acres.toFixed(1)}</div>
                          <div className="text-[10px] text-slate-400">acres</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Seperated pages */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <span className="text-xs text-slate-400">
                      Showing {startIndex}–{endIndex} of {sorted.length} results
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                      >
                        <ChevronLeft size={12} /> Prev
                      </button>
                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            className={`h-7 w-7 rounded-lg text-xs font-semibold transition ${p === page ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Map + Stats + AI */}
      <div className="min-w-0 space-y-4">

        {/* Quick stats */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 mb-3">Quick Stats</div>
          {results.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">Run a search to see statistics</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total Fires"   value={String(results.length)} />
              <StatCard label="Total Acres"   value={totalAcres >= 1000 ? `${(totalAcres/1000).toFixed(1)}K` : totalAcres.toFixed(0)} />
              <StatCard label="Prescribed"    value={String(prescribed_count)} />
              <StatCard label="Top Cause"     value={topCause} small />
            </div>
          )}
        </div>

        {/* Top 5 Fires by Acres */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 mb-3">Top 5 Fires by Acres</div>
          {results.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">Run a search to see top fires</div>
          ) : (
            <div className="space-y-2">
              {[...results]
                .sort((a, b) => Number(b.ESTIMATEDTOTALACRES ?? b.acres ?? 0) - Number(a.ESTIMATEDTOTALACRES ?? a.acres ?? 0))
                .slice(0, 5)
                .map((r, i) => {
                  const acres = Number(r.ESTIMATEDTOTALACRES ?? r.acres ?? 0);
                  const maxAcres = Number(results.reduce((m: any, x: any) => Number(x.ESTIMATEDTOTALACRES ?? x.acres ?? 0) > Number(m.ESTIMATEDTOTALACRES ?? m.acres ?? 0) ? x : m, results[0])?.ESTIMATEDTOTALACRES ?? 1);
                  const pct = Math.round((acres / maxAcres) * 100);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-slate-700 font-medium truncate max-w-[65%]">{r.NAME ?? r.INCIDENT_NAME ?? "Unknown"}</span>
                        <span className="text-slate-500">{acres >= 1000 ? `${(acres/1000).toFixed(1)}K` : acres} ac</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Breakdown by Year */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 mb-3">Fires by Year</div>
          {results.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">Run a search to see breakdown</div>
          ) : (() => {
            const yearCounts: Record<string, number> = {};
            results.forEach((r: any) => {
              const y = String(r.year ?? r.FIRESEASON ?? "Unknown");
              yearCounts[y] = (yearCounts[y] || 0) + 1;
            });
            const sorted = Object.entries(yearCounts).sort((a, b) => a[0].localeCompare(b[0]));
            const max = Math.max(...sorted.map(([,v]) => v));
            return (
              <div className="space-y-1.5">
                {sorted.map(([year, count]) => (
                  <div key={year} className="text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-600">{year}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${Math.round((count/max)*100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Top Causes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 mb-3">Fires by Cause</div>
          {results.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">Run a search to see causes</div>
          ) : (() => {
            const counts: Record<string, number> = {};
            results.forEach((r: any) => {
              const c = String(r.GENERALCAUSE ?? r.FIRECAUSE ?? "Unknown");
              counts[c] = (counts[c] || 0) + 1;
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const max = sorted[0]?.[1] ?? 1;
            const colors: Record<string, string> = {
              Lightning: "bg-yellow-400",
              Prescribed: "bg-green-400",
              Human: "bg-red-400",
              Unknown: "bg-slate-300",
            };
            return (
              <div className="space-y-1.5">
                {sorted.map(([cause, count]) => (
                  <div key={cause} className="text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-600 truncate max-w-[70%]">{cause}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className={`h-1.5 rounded-full ${colors[cause] ?? "bg-purple-400"}`} style={{ width: `${Math.round((count/max)*100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Fuel Type Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 mb-3">Fires by Fuel Type</div>
          {results.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">Run a search to see fuel types</div>
          ) : (() => {
            const counts: Record<string, number> = {};
            results.forEach((r: any) => {
              const f = String(r.PRIMARYFUELTYPE ?? r.fueltype ?? "Unknown");
              counts[f] = (counts[f] || 0) + 1;
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const max = sorted[0]?.[1] ?? 1;
            return (
              <div className="space-y-1.5">
                {sorted.map(([fuel, count]) => (
                  <div key={fuel} className="text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-600 truncate max-w-[70%]">{fuel}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.round((count/max)*100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* AI Analysis */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col" style={{minHeight: "320px"}}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Bot size={14} className="text-blue-500" />
            <div className="text-sm font-semibold text-slate-900">AI Analysis</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{maxHeight: "300px"}}>
            {chatMsgs.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                Run a search and ask me anything about the results.
                <div className="mt-3 space-y-1">
                  {["What year had the most fires?", "What is the most common cause?", "Compare fuel types"].map(q => (
                    <button key={q} className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-left text-[11px] text-slate-600 hover:bg-slate-50" onClick={() => { setChatInput(q); }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                    {m.text}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">Thinking…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100 p-3 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-400 placeholder:text-slate-400"
              placeholder="Ask about the results…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              disabled={results.length === 0}
            />
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-white disabled:opacity-40 hover:bg-slate-700"
              onClick={sendChat}
              disabled={results.length === 0 || chatLoading || !chatInput.trim()}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-4 top-4 text-slate-400 hover:text-slate-700" onClick={() => setSelected(null)}><X size={16} /></button>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${getPresc(selected) === "Y" ? "bg-emerald-500" : "bg-orange-500"}`}>
                {getPresc(selected) === "Y" ? <Leaf size={16} /> : <Flame size={16} />}
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">{selected.NAME ?? "Unnamed fire"}</div>
                <div className="text-xs text-slate-500">{getPresc(selected) === "Y" ? "Prescribed fire" : "Wildfire"} · {getYear(selected) || "Unknown year"}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <DetailCard label="Acres"             value={getAcres(selected) >= 1000 ? `${(getAcres(selected)/1000).toFixed(1)}K` : getAcres(selected).toFixed(1)} />
              <DetailCard label="Year"              value={String(getYear(selected) || "—")} />
              <DetailCard label="General Cause"     value={getCause(selected)} />
              <DetailCard label="Specific Cause"    value={selected.SPECIFICCAUSE ?? "—"} />
              <DetailCard label="Fuel Type"         value={getFuel(selected)} />
              <DetailCard label="Land Owner"        value={selected.OWNERKIND ?? "—"} />
              <DetailCard label="Strategy"          value={selected.SUPPRESSIONSTRATEGY ?? "—"} />
              <DetailCard label="Management"        value={selected.MGMTOPTIONID ?? "—"} />
              <DetailCard label="Elevation"         value={selected.ORIGINELEVATION ? selected.ORIGINELEVATION + " ft" : "—"} />
              <DetailCard label="Slope"             value={selected.ORIGINSLOPE ?? "—"} />
              <DetailCard label="Aspect"            value={selected.ORIGINASPECT ?? "—"} />
              <DetailCard label="Structures Burned" value={String(selected.STRUCTURESBURNED ?? 0)} />
            </div>
            {getLat(selected) != null && getLon(selected) != null && (
                <a
                href={"https://www.google.com/maps?q=" + String(getLat(selected)) + "," + String(getLon(selected))}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MapPin size={12} /> View on Google Maps ({Number(getLat(selected)).toFixed(3)}, {Number(getLon(selected)).toFixed(3)})
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className={`mt-0.5 font-bold text-slate-900 truncate ${small ? "text-xs" : "text-lg"}`}>{value}</div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 truncate">{value}</div>
    </div>
  );
}