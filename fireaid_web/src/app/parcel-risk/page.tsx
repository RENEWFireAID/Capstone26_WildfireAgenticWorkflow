"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";
import FireRiskChat from "@/components/fire-risk/FireRiskChat";
import type { LegendEntry, MapPoint, MapView, ParcelGeometry, RiskLayer } from "@/components/parcel-risk/ParcelRiskMap";

const ParcelRiskMap = dynamic(() => import("@/components/parcel-risk/ParcelRiskMap"), { ssr: false });

// The card style the other app pages use.
const CARD = "bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]";

const SUGGESTIONS = [
  "What's the fire risk for parcel 622476?",
  "What goes into a parcel's risk score?",
  "Is the risk score the chance of a fire?",
];

type Station = { stid: string; lat: number; lon: number; fwi: number | null; source: string };
type Score = {
  RISK: number; FUEL: number; EXPO: number; SLOPE_PCT: number; FWI_PCT: number; NO_VEG: number;
  STN: string; STN_SHARE: number; STN_ABSENT: boolean; band: string; fwi_raw: number;
  points: { fuel: number; exposure: number; slope: number; fwi: number };
  protection_label: string; protection_color: string;
};
type ParcelResult = { pan: number | string | null; primary_use?: string; score: Score | null; center?: [number, number]; geometry?: ParcelGeometry };

// Cell 9 opens on the parcels' centre at zoom 10.
const START: MapView = { center: [64.8101, -146.5671], zoom: 10 };
type Hint = { text: string; color: string };

// Python's float formatting rounds ties to even; toFixed rounds them up.
function fx(v: number, d = 0) {
  const x = v * 10 ** d;
  const r = Math.round(x);
  return ((Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r) / 10 ** d).toFixed(d);
}

const Box = ({ style, children }: { style?: CSSProperties; children: ReactNode }) => (
  <div style={{ padding: 10, ...style }}>{children}</div>
);

const SEASON_WARNING = (
  <Box style={{ padding: 12, background: "#fff3cd", borderLeft: "4px solid #ff9800", color: "#664d03", fontSize: 13 }}>
    ⚠️ <b>Off-Season Date Selected:</b> Weather data in Fairbanks North Star Borough only records from <b>Feb 1 – Oct 31</b>. Please choose a date within that range for an accurate fire risk score.
  </Box>
);

async function lookup(body: object): Promise<ParcelResult & { geocoded?: boolean; address?: string; point?: [number, number] }> {
  const res = await fetch("/api/parcel-risk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Lookup failed");
  return data;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const errorBox = (e: unknown) => <Box style={{ color: "#b71c1c" }}>⚠️ {errorText(e)}</Box>;

export default function ParcelRiskPage() {
  const [day, setDay] = useState("");
  const [maxDay, setMaxDay] = useState<string>();
  const [curDay, setCurDay] = useState<string | null>(null);
  const [layers, setLayers] = useState<RiskLayer[]>([]);
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [fwiCap, setFwiCap] = useState(30.7);
  const [view, setView] = useState<MapView>(START);
  const [parcel, setParcel] = useState<ParcelGeometry | null>(null);
  const [hint, setHint] = useState<Hint>({ text: "FWI source: Ready (select a date and click Update Map)", color: "#666" });
  const [status, setStatus] = useState<ReactNode>(null);
  const [box, setBox] = useState<ReactNode>(<Box>click a parcel, or search a PAN or address</Box>);
  const [query, setQuery] = useState("");

  // Only the newest request may show its result; an older one can come back later.
  // A new date also drops pending parcel lookups, which belong to the old date.
  const latestMap = useRef(0);
  const latest = useRef(0);

  async function render(d: string | null) {
    if (d === "") return setBox(<Box style={{ color: "#b71c1c" }}>⚠️ Please select a date first.</Box>);
    const id = ++latestMap.current;
    latest.current++;
    setParcel(null);
    const inSeason = d == null || (+d.slice(5, 7) >= 2 && +d.slice(5, 7) <= 10);
    if (inSeason) {
      setHint({ text: `⏳ Checking Live MesoWest Web & Google Sheet${d ? ` for ${d}` : ""}...`, color: "#666" });
      setBox(<Box>⏳ Pulling weather station FWI{d ? ` for ${d}` : ""}...</Box>);
    }
    try {
      const res = await fetch(`/api/parcel-risk${d ? `?date=${d}` : ""}`);
      const r = await res.json();
      if (!res.ok) throw new Error(r?.error ?? "Could not load the map");
      if (id !== latestMap.current) return;
      const today = new Date().toLocaleDateString("en-CA");
      setDay(r.date);
      setMaxDay(r.last_date > today ? r.last_date : today);
      setLayers(r.layers);
      setLegend(r.legend);
      setFwiCap(r.fwi_cap);
      setStations(r.status === "ok" ? r.stations : []);
      setCurDay(r.status === "ok" ? r.date : null);

      if (r.status === "off_season") {
        setHint({ text: `FWI source (${r.date}): Off-season (Feb 1 – Oct 31 only)`, color: "#b71c1c" });
        setStatus(null);
        setBox(SEASON_WARNING);
      } else if (r.status === "no_data") {
        setHint({ text: `FWI source (${r.date}): 0 Live Web · 0 Google Sheet · 13 Offline`, color: "#b71c1c" });
        setStatus(`${r.date}: no station data`);
        setBox(
          <Box style={{ background: "#ffebee", borderLeft: "4px solid #d32f2f" }}>
            ⚠️ No stations recorded FWI data on <b>{r.date}</b>. Please choose another date between Feb 1 and Oct 31.
          </Box>,
        );
      } else {
        const st: Station[] = r.stations;
        const count = (icon: string) => st.filter((s) => s.source.startsWith(icon)).length;
        const active = st.filter((s) => s.fwi != null).length;
        setHint({ text: `FWI source (${r.date}): 🌐 ${count("🌐")} Live Web · 📊 ${count("📊")} Google Sheet · ⚠️ ${count("⚠️")} Offline`, color: "#444" });
        setStatus(<><b>{r.date}</b> — borough median {fx(r.p50)}, 90th pct {fx(r.p90)} ({active}/{st.length} stations active)</>);
        setBox(
          <Box style={{ background: "#e8f5e9", borderLeft: "4px solid #2e7d32" }}>
            ✅ Map updated for <b>{r.date}</b> ({active}/13 stations active). Click any parcel or station dot to inspect.
          </Box>,
        );
      }
    } catch (e) {
      if (id !== latestMap.current) return;
      setHint({ text: `FWI source${d ? ` (${d})` : ""}: ${errorText(e)}`, color: "#b71c1c" });
      setBox(errorBox(e));
    }
  }

  useEffect(() => {
    render(null);
  }, []);

  function showParcel(r: ParcelResult, s: Score, addr = "") {
    if (r.geometry) setParcel(r.geometry);
    setBox(
      <Box style={{ borderLeft: "4px solid #d7191c", fontSize: 12 }}>
        <b>PAN {r.pan}</b>
        {s.NO_VEG ? <> <b>[NO VEG]</b></> : null}
        {addr && <div style={{ color: "#555", fontSize: 12 }}>📍 {addr}</div>}
        <div style={{ color: "#333", fontSize: 12 }}>🏷️ <b>Primary Use:</b> {r.primary_use}</div>
        <b>RISK {fx(s.RISK, 1)} / 100</b> ({s.band})
        <hr />
        🌿 fuel: {fx(s.FUEL)}/100 → <b>{fx(s.points.fuel, 1)} pts</b><br />
        🔥 exposure: {fx(s.EXPO)}/100 → <b>{fx(s.points.exposure, 1)} pts</b><br />
        ⛰️ slope: {fx(s.SLOPE_PCT)}/100 → <b>{fx(s.points.slope, 1)} pts</b><br />
        ☀️ FWI: {fx(s.FWI_PCT)}/100 (raw {fx(s.fwi_raw, 1)}) → <b>{fx(s.points.fwi, 1)} pts</b>
        <hr />
        🚒 <span style={{ color: s.protection_color, fontWeight: "bold" }}>protection: {s.protection_label}</span><br />
        📡 <span style={{ color: "#555" }}>
          FWI dominated by {s.STN} ({fx(s.STN_SHARE * 100)}% of parcel){s.STN_ABSENT ? " — absent that day, neighbours used" : ""}
        </span>
      </Box>,
    );
  }

  // The nearest station within 800 m wins over a parcel, as in the notebook.
  function stationAt({ latitude: lat, longitude: lon }: MapPoint) {
    let best: [number, Station] | null = null;
    for (const s of stations) {
      const dm = Math.hypot((s.lat - lat) * 111_000, (s.lon - lon) * 111_000 * Math.cos((lat * Math.PI) / 180));
      if (!best || dm < best[0]) best = [dm, s];
    }
    return best && best[0] < 800 ? best[1] : null;
  }

  async function pick(point: MapPoint) {
    if (!curDay) return setBox(SEASON_WARNING);
    const st = stationAt(point);
    if (st) {
      const up = st.fwi != null;
      return setBox(
        <Box style={{ fontSize: 12, borderLeft: "4px solid #0055ff" }}>
          <b>📡 Station {st.stid}</b> ({curDay})<br />
          status: {up ? "reporting" : "no reading that day"}<br />
          source: <b>{st.source}</b><br />
          {up && <>raw FWI: {fx(st.fwi!, 1)} (scaled: {fx(Math.min(100, (st.fwi! / fwiCap) * 100), 1)}/100)</>}
        </Box>,
      );
    }
    const id = ++latest.current;
    setBox(<Box>⏳ calculating parcel score …</Box>);
    try {
      const r = await lookup({ lat: point.latitude, lon: point.longitude, date: curDay });
      if (id !== latest.current) return;
      if (r.pan == null) setBox(<Box>no parcel here</Box>);
      else if (!r.score) setBox(<Box>PAN {r.pan} could not be scored on this date</Box>);
      else showParcel(r, r.score);
    } catch (e) {
      if (id === latest.current) setBox(errorBox(e));
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!curDay) return setBox(SEASON_WARNING);
    const q = query.trim();
    if (!q) return;
    const id = ++latest.current;
    setBox(<Box>🔎 searching {q} …</Box>);
    try {
      const r = await lookup({ query: q, date: curDay });
      if (id !== latest.current) return;
      const rawQ = q.replace(/-/g, "");
      if (/^\d+$/.test(rawQ)) {
        if (r.pan != null && r.center) setView({ center: r.center, zoom: 17 });
        return r.score ? showParcel(r, r.score) : setBox(<Box>PAN {rawQ} not found</Box>);
      }
      if (r.geocoded === false || !r.point) return setBox(<Box>not found: {q}</Box>);
      setView({ center: r.point, zoom: 16 });
      if (r.score) showParcel(r, r.score, r.address);
      else setBox(<Box>{r.address} — no parcel here</Box>);
    } catch (err) {
      if (id === latest.current) setBox(errorBox(err));
    }
  }

  const input = "h-9 border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-navy";
  const button = "h-9 px-4 font-mono text-xs font-semibold uppercase tracking-wide transition disabled:opacity-40";

  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="Apps · Property risk"
          title="Parcel Fire Risk"
          description="Scores every tax parcel in the Fairbanks North Star Borough on a 0-100 fire hazard scale for a chosen day, from fuel, ember exposure, slope and the station Fire Weather Index. The score is a hazard index, not a probability: it says how readily a parcel would carry fire, not how likely ignition is."
          meta={["FNSB vegetation · 3DEP slope", "AKFF station FWI", "FNSB tax parcels", "Google Earth Engine"]}
        />

        <div className="grid flex-1 grid-cols-1 gap-5 bg-slate-50 px-6 py-6 md:px-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <div className={`min-w-0 space-y-2 p-4 ${CARD}`}>
            <div style={{ fontSize: 11, color: hint.color, margin: "0 0 2px 4px" }}>
              <i>{hint.text}</i>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-deep">
                FWI Date:
                <input type="date" value={day} min="2015-02-01" max={maxDay} onChange={(e) => setDay(e.target.value)} className={input} />
              </label>
              <button type="button" onClick={() => render(day)} className={`${button} bg-[#2e7d32] text-white hover:bg-[#256528]`}>
                Update Map
              </button>
              <form onSubmit={search} className="flex items-center gap-2 sm:ml-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-deep">
                  Find:
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="PAN or address" className={`${input} w-56`} />
                </label>
                <button type="submit" className={`${button} bg-gold text-navy-deep hover:bg-[#ffd94d]`}>
                  Search
                </button>
              </form>
            </div>
            <div className="relative h-[640px] overflow-hidden">
              <ParcelRiskMap layers={layers} legend={legend} view={view} parcel={parcel} onPick={pick} />
            </div>
            {status && <div className="text-sm text-slate-800" style={{ padding: 6 }}>{status}</div>}
            <div className="text-sm text-slate-800">{box}</div>
          </div>

          <div className="min-w-0">
            <FireRiskChat
              endpoint="/api/parcel-risk/chat"
              title="Ask about parcel fire risk"
              subtitle="Daily parcel scores, their parts and fire protection"
              suggestions={SUGGESTIONS}
              chartSource="the FNSB parcel fire risk model"
              modelFeature="parcelRisk"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
