"use client";

import { useState, useEffect } from "react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import Popup from "@/components/ui/TermEntry";
import LLMPrompt from "@/components/ui/LLMPrompt";

const CITIES = [
  { name: "Fairbanks",       lat: 64.84, lon: -147.72 },
  { name: "Anchorage",       lat: 61.22, lon: -149.90 },
  { name: "Juneau",          lat: 58.30, lon: -134.42 },
  { name: "Fairbanks North", lat: 65.0,  lon: -147.5  },
];

type WeatherData = {
  name: string; temp: number; tempMin: number; tempMax: number;
  wind: number; humidity: number; winddir: number;
  condition: string; conditionCode: number;
  precip: number; uv: number; visibility: number; feelsLike: number;
};

function getWindDir(deg: number) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg / 45) % 8];
}

function getCondition(code: number): string {
  if (code === 0) return "☀️ Clear";
  if (code <= 3) return "⛅ Partly Cloudy";
  if (code <= 48) return "🌫️ Foggy";
  if (code <= 67) return "🌧️ Rain";
  if (code <= 77) return "❄️ Snow";
  if (code <= 82) return "🌦️ Showers";
  return "⛈️ Thunderstorm";
}

function getFireRisk(humidity: number, wind: number): { label: string; color: string; bg: string } {
  if (humidity < 20 && wind > 20) return { label: "EXTREME", color: "#fff", bg: "#7c1d1d" };
  if (humidity < 25 && wind > 15) return { label: "HIGH",    color: "#fff", bg: "#dc2626" };
  if (humidity < 40)               return { label: "MODERATE",color: "#fff", bg: "#f97316" };
  return                                  { label: "LOW",     color: "#fff", bg: "#16a34a" };
}

function getBg(_code: number): string {
  return "linear-gradient(160deg, #bfdbfe 0%, #dbeafe 60%, #eff6ff 100%)";
}

function AlaskaWeather() {
  const [weather, setWeather] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    async function fetchAll() {
      try {
        const results = await Promise.all(
          CITIES.map(async (city) => {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
              `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature,precipitation` +
              `&daily=temperature_2m_max,temperature_2m_min,uv_index_max,visibility_max` +
              `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Anchorage`
            );
            const data = await res.json();
            const c = data.current;
            const d = data.daily;
            return {
              name: city.name,
              temp: Math.round(c.temperature_2m),
              tempMin: Math.round(d?.temperature_2m_min?.[0] ?? c.temperature_2m - 5),
              tempMax: Math.round(d?.temperature_2m_max?.[0] ?? c.temperature_2m + 5),
              wind: Math.round(c.wind_speed_10m),
              humidity: c.relative_humidity_2m,
              winddir: c.wind_direction_10m,
              condition: getCondition(c.weather_code),
              conditionCode: c.weather_code,
              precip: c.precipitation ?? 0,
              uv: Math.round(d?.uv_index_max?.[0] ?? 1),
              visibility: Math.round((d?.visibility_max?.[0] ?? 10000) / 1609),
              feelsLike: Math.round(c.apparent_temperature),
            };
          })
        );
        setWeather(results);
      } catch {
        setWeather([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) return (
    <div className="h-64 flex items-center justify-center text-sm text-slate-400">
      Loading weather data...
    </div>
  );

  const w = weather[selected];
  if (!w) return null;
  const risk = getFireRisk(w.humidity, w.wind);
  const bg = getBg(w.conditionCode);

  return (
    <div className="space-y-3">
      {/* City tabs */}
      <div className="flex gap-2 flex-wrap">
        {weather.map((city, i) => (
          <button
            key={city.name}
            onClick={() => setSelected(i)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              selected === i
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {city.name}
          </button>
        ))}
      </div>

      {/* Main weather card — iPhone style */}
      <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: bg }}>
        {/* Top: city + temp */}
        <div className="px-6 pt-6 pb-4 text-white">
          <div className="text-lg font-semibold text-slate-700">{w.name}</div>
          <div className="text-7xl font-thin tracking-tight mt-1 text-slate-900">{w.temp}°<span className="text-3xl font-light text-slate-500">F</span></div>
          <div className="text-base mt-1 text-slate-600">{w.condition}</div>
          <div className="text-sm mt-0.5 text-slate-500">H:{w.tempMax}° L:{w.tempMin}°</div>
        </div>

        {/* Fire Risk banner */}
        <div className="mx-4 mb-4 rounded-xl px-4 py-2.5 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.6)" }}>
          <span className="text-slate-700 text-sm font-medium">🔥 Fire Risk</span>
          <span className="font-bold text-sm px-3 py-1 rounded-full" style={{ background: risk.bg, color: risk.color }}>
            {risk.label}
          </span>
        </div>

        {/* Stats grid — iPhone weather tiles */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {[
            { icon: "💨", label: "WIND", value: `${w.wind} mph`, sub: getWindDir(w.winddir) },
            { icon: "💧", label: "HUMIDITY", value: `${w.humidity}%`, sub: w.humidity < 25 ? "⚠️ Dangerously Low" : w.humidity < 40 ? "Low" : "Normal" },
            { icon: "🌡️", label: "FEELS LIKE", value: `${w.feelsLike}°F`, sub: "" },
            { icon: "🌧️", label: "PRECIP", value: `${w.precip} mm`, sub: "Current" },
            { icon: "☀️", label: "UV INDEX", value: String(w.uv), sub: w.uv <= 2 ? "Low" : w.uv <= 5 ? "Moderate" : w.uv <= 7 ? "High" : "Very High" },
            { icon: "👁️", label: "VISIBILITY", value: `${w.visibility} mi`, sub: "" },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.6)" }}>
              <div className="text-[10px] text-slate-500 font-semibold tracking-wide">{icon} {label}</div>
              <div className="text-slate-900 text-lg font-semibold mt-0.5">{value}</div>
              {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>

        <div className="text-center text-[10px] text-slate-400 pb-3">
          Source: Open-Meteo · NOAA GFS · Updates on page load
        </div>
      </div>
    </div>
  );
}

export default function FireAIDPage() {
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
        const list: Term[] = json.map((i: object) => i as Term);
        setTermList(list);
      }
    } catch (err) {
      console.error("Failed to get terms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    if (!ignore) getTerms();
    return () => { ignore = true; };
  }, []);

  return (
    <div className="flex gap-5 min-h-screen">
      <FireAIDSidebar/>

      <div className="flex-1 space-y-6 min-w-0 flex flex-col">

        {/* 1. WEATHER + EXTERNAL RESOURCES side by side */}
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Alaska Live Weather
              <span className="ml-2 text-sm font-normal text-slate-400">Fire risk indicators</span>
            </h2>
            <AlaskaWeather />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 mb-1">External Resources</h2>
            <p className="text-xs text-slate-400 mb-5">Can&apos;t find what you need? Continue your research on these trusted platforms.</p>
            <div className="flex flex-col gap-3 flex-1">
              {[
                {
                  name: "FRAMES / AFSC",
                  desc: "Alaska Fire Science Consortium — research, reports & data",
                  url: "https://www.frames.gov/afsc/ACWE",
                  icon: "🔬",
                },
                {
                  name: "NIFC ArcGIS Portal",
                  desc: "National Interagency Fire Center — interactive fire maps",
                  url: "https://nifc.maps.arcgis.com/apps/instant/portfolio/index.html?appid=099b1abe3559408995a5840688e8df57&sectionId=a01873bd7b844df2b0d290dd809fbd8d",
                  icon: "🗺️",
                },
                {
                  name: "GINA Alaska",
                  desc: "Geographic Information Network of Alaska — satellite & spatial data",
                  url: "https://gina.alaska.edu/",
                  icon: "🛰️",
                },
              ].map(({ name, desc, url, icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 items-start rounded-xl border border-slate-200 p-4 hover:bg-slate-50 hover:border-blue-300 transition-all group"
                >
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="font-semibold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">{name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-4 text-[10px] text-slate-300 text-center">Opens in new tab</div>
          </section>
        </div>

        {/* 2. TERMINOLOGY — full width, spacious */}
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Terminology Library{" "}
              <span className="text-base font-normal text-slate-400">(MCP-resource)</span>
            </h2>
            <div className="flex gap-3">
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => setShowPopUp(true)}
              >
                Add terms
              </button>
              <button className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Query a term
              </button>
              <button className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Explore knowledge map
              </button>
            </div>
          </div>
          <div className="overflow-x-auto min-h-[320px]">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead className="text-xs uppercase text-slate-400 tracking-wide">
                <tr>
                  <th className="rounded-l-xl bg-slate-50 px-5 py-3 text-left w-48">Terminology</th>
                  <th className="bg-slate-50 px-5 py-3 text-left">Description</th>
                  <th className="bg-slate-50 px-5 py-3 text-left w-40">Proposed by</th>
                  <th className="rounded-r-xl bg-slate-50 px-5 py-3 text-left">LLM summary</th>
                </tr>
              </thead>
              <tbody>
                {termList.map(i => (
                  <TerminologyRow
                    key={i._id}
                    term={i.term}
                    desc={i.def}
                    proposer="Name & role"
                    summary="An LLM generated summary of the term."
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Popup showPopUp={showPopUp} closePopUp={() => setShowPopUp(false)}>
            <h2 className="text-xl font-bold text-slate-900"></h2>
          </Popup>
        </section>

        {/* 3. LLM — full width */}
        <section className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[560px] flex flex-col">
          <LLMPrompt />
        </section>

        {/* 4. DATA LIBRARY — full width */}
        <section className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-8">
          <h3 className="mb-6 text-2xl font-bold text-slate-900">
            Data Library{" "}
            <span className="text-base font-normal text-slate-400">(MCP-resource)</span>
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <DataItem title="Lidar tile (63.53° N, 147.3° W)" source="FNSB" type="Canopy height model / CHM" />
            <DataItem title="Sentinel satellite data" source="ASF" type="Optical imagery" />
            <DataItem title="VIIRS satellite data" source="GINA" type="Active fire / thermal" />
            <DataItem title="Weather station data" source="GINA" type="Temperature / wind / precipitation" />
          </div>
        </section>

      </div>
    </div>
  );
}

/* ====== Helper components ====== */

function TerminologyRow({ term, desc, proposer, summary }: { term: string; desc: string; proposer: string; summary: string }) {
  return (
    <tr className="text-xs text-slate-800">
      <td className="rounded-l-xl bg-white px-5 py-4 font-semibold text-sm">{term}</td>
      <td className="bg-white px-5 py-4 text-slate-600 text-sm">{desc}</td>
      <td className="bg-white px-5 py-4 text-slate-600 text-sm">{proposer}</td>
      <td className="rounded-r-xl bg-white px-5 py-4 text-slate-600 text-sm">{summary}</td>
    </tr>
  );
}

function DataItem({ title, source, type }: { title: string; source: string; type: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 text-xs shadow-sm">
      <div className="font-semibold text-slate-800 text-sm mb-1">{title}</div>
      <div className="text-slate-500">Source: <span className="font-medium">{source}</span></div>
      <div className="text-slate-500">{type}</div>
    </div>
  );
}

interface Term {
  _id: string;
  term: string;
  def: string;
}
