"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CloudRain, Droplets, Flame, MapPin, RefreshCw, Thermometer, Wind } from "lucide-react";
import { FIELD, Notice, Panel, SHADOW, Segmented, buttonClass } from "@/components/ui/app";

type Place = { name: string; latitude: number; longitude: number };

type Day = {
  date: string;
  observed: boolean;
  status: "rated" | "out_of_season" | "snow" | "too_cold";
  rating: string | null;
  reasons: string[];
  weather: {
    temp_f: number;
    humidity: number;
    wind_mph: number;
    gust_mph: number;
    rain_in: number;
    precip_probability: number | null;
  };
};

type Forecast = { days: Day[] };

// Leaflet needs the browser, so the map only loads client-side.
const FireDangerMap = dynamic(() => import("./FireDangerMap"), {
  ssr: false,
  loading: () => <div className="h-[540px] bg-slate-200 motion-safe:animate-pulse" />,
});

const QUICK_PICKS: Place[] = [
  { name: "Fairbanks", latitude: 64.8378, longitude: -147.7164 },
  { name: "Anchorage", latitude: 61.2181, longitude: -149.9003 },
  { name: "Juneau", latitude: 58.3019, longitude: -134.4197 },
  { name: "Tok", latitude: 63.3367, longitude: -142.9856 },
  { name: "Bethel", latitude: 60.7922, longitude: -161.7558 },
];

// A peak day of the record 2022 season, for demoing outside fire season.
const EXAMPLE_DAY = "2022-06-15";
const EARLIEST_DAY = "2000-01-01";
const MAX_LEAD_DAYS = 11;

// AICC chart colours (Low blue, Moderate green, High yellow, Very High orange, Extreme red),
// with text colours that pass WCAG AA on each.
const CARD_STYLE: Record<string, string> = {
  Low: "bg-blue-600 text-white",
  Moderate: "bg-green-700 text-white",
  High: "bg-yellow-400 text-slate-900",
  "Very High": "bg-orange-500 text-slate-900",
  Extreme: "bg-red-600 text-white",
};
const CHIP_STYLE: Record<string, string> = {
  Low: "bg-blue-50 text-blue-700",
  Moderate: "bg-green-50 text-green-700",
  High: "bg-yellow-50 text-yellow-800",
  "Very High": "bg-orange-50 text-orange-700",
  Extreme: "bg-red-50 text-red-700",
};
const LEVELS = ["Low", "Moderate", "High", "Very High", "Extreme"];
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
const STATUS_LABEL = { out_of_season: "Out of season", snow: "Snow cover", too_cold: "Not started" };
const STATUS_NOTE = {
  out_of_season: "Alaska rates fire danger from April 1 to September 30.",
  snow: "Snow is still on the ground. Ratings start after snowmelt.",
  too_cold: "The fire season hasn't started here yet. Ratings start after three warm days in a row.",
};

function alaskaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Anchorage",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const formatDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

const dayLabel = (day: Day) => day.rating ?? STATUS_LABEL[day.status as keyof typeof STATUS_LABEL];

function PlaceSearch({ onPick }: { onPick: (place: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const searching = query.trim().length >= 2;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=en&format=json`;
        const data = await (await fetch(url, { signal: controller.signal })).json();
        type Result = { name: string; latitude: number; longitude: number; country_code?: string; admin1?: string };
        setResults(
          ((data.results ?? []) as Result[])
            .filter((r) => r.country_code === "US" && r.admin1 === "Alaska")
            .slice(0, 5)
            .map((r) => ({ name: r.name, latitude: r.latitude, longitude: r.longitude })),
        );
      } catch {
        if (!controller.signal.aborted) setResults([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searching]);

  return (
    <div className="relative min-w-0 flex-1 basis-56">
      <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search an Alaska place"
        placeholder="Search an Alaska place..."
        className={`${FIELD} pl-9!`}
      />
      {searching && results.length > 0 && (
        <ul className={`absolute z-10 mt-1 w-full overflow-hidden border border-slate-300 bg-white ${SHADOW}`}>
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-navy-soft focus-visible:bg-navy-soft focus-visible:outline-none"
              >
                {r.name}
                <span className="ml-2 font-mono text-xs text-slate-500">
                  {r.latitude.toFixed(2)}, {r.longitude.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Drawn in the card's text colour so it reads on every rating colour.
function DangerScale({ rating }: { rating: string | null }) {
  return (
    <div className="mt-auto pt-6" aria-hidden>
      <div className="flex gap-1">
        {LEVELS.map((level) => (
          <div key={level} className={`h-1.5 flex-1 bg-current ${level === rating ? "" : "opacity-25"}`} />
        ))}
      </div>
      <div className="mt-1.5 flex text-[11px] font-medium">
        {LEVELS.map((level) => (
          <span key={level} className={`flex-1 text-center ${level === rating ? "font-bold" : "opacity-80"}`}>
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeatherTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 border-t border-slate-200 pt-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 whitespace-nowrap font-mono text-2xl font-semibold tabular-nums text-navy-deep">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function FireDangerForecast() {
  const today = alaskaToday();
  const [place, setPlace] = useState<Place>(QUICK_PICKS[0]);
  const [date, setDate] = useState(today);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/fire-danger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: place.latitude, longitude: place.longitude, date }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setForecast(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Forecast failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [place, date]);

  const first = forecast?.days[0];
  const w = first?.weather;

  return (
    <div className="space-y-4">
      <Panel accent title="Fire Danger Forecast" subtitle="Search a place, pick one below or click the map, then choose a date.">
        <div className="flex flex-wrap items-center gap-3">
          <PlaceSearch onPick={setPlace} />
          <input
            type="date"
            aria-label="Date"
            value={date}
            min={EARLIEST_DAY}
            max={addDays(today, MAX_LEAD_DAYS)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${FIELD} w-auto! shrink-0`}
          />
          <button type="button" onClick={() => setDate(EXAMPLE_DAY)} className={buttonClass("secondary", `h-9 py-0 ${FOCUS}`)}>
            Example: Jun 15, 2022
          </button>
          {date !== today && (
            <button type="button" onClick={() => setDate(today)} className={buttonClass("quiet", `h-9 px-2 py-0 ${FOCUS}`)}>
              Back to today
            </button>
          )}
        </div>
        <div className="mt-3">
          <Segmented
            label="Quick places"
            size="sm"
            options={QUICK_PICKS.map((p) => p.name)}
            value={place.name}
            onChange={(name) => setPlace(QUICK_PICKS.find((p) => p.name === name) ?? place)}
          />
        </div>
      </Panel>

      {error ? (
        <div role="alert">
          <Notice tone="error">Couldn&apos;t load the forecast: {error}</Notice>
        </div>
      ) : !forecast || !first || !w ? (
        <div aria-busy="true" aria-label="Loading forecast" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-60 bg-slate-200 motion-safe:animate-pulse" />
            <div className="h-60 bg-slate-200 motion-safe:animate-pulse" />
          </div>
          <div className="h-40 bg-slate-200 motion-safe:animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className={`flex min-w-0 flex-col p-6 ${SHADOW} transition-colors duration-200 ${
                first.rating ? CARD_STYLE[first.rating] : "bg-slate-200 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3 font-mono text-sm font-medium">
                <span>
                  {place.name} · {formatDay(first.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
                {loading && <RefreshCw size={14} className="motion-safe:animate-spin" aria-label="Updating" />}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Flame size={40} aria-hidden />
                <div>
                  <div className="font-mono text-xs font-semibold uppercase tracking-wide">Fire danger</div>
                  <div className="text-3xl font-bold leading-tight sm:text-4xl">{dayLabel(first)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm">
                {first.rating
                  ? first.reasons.join(", ").replace(/^./, (c) => c.toUpperCase()) + "."
                  : STATUS_NOTE[first.status as keyof typeof STATUS_NOTE]}
              </p>
              <DangerScale rating={first.rating} />
            </div>

            <Panel
              title="Weather at 2 p.m."
              aside={
                <span className="border border-slate-300 px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {first.observed ? "Observed" : "Forecast"}
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <WeatherTile icon={<Thermometer size={14} />} label="Temperature" value={`${w.temp_f}°F`} />
                <WeatherTile icon={<Droplets size={14} />} label="Humidity" value={`${w.humidity}%`} />
                <WeatherTile icon={<Wind size={14} />} label="Wind" value={`${w.wind_mph} mph`} sub={`Gusts ${w.gust_mph} mph`} />
                {w.precip_probability !== null ? (
                  <WeatherTile
                    icon={<CloudRain size={14} />}
                    label="Chance of rain"
                    value={`${w.precip_probability}%`}
                    sub={`${w.rain_in} in past 24 h`}
                  />
                ) : (
                  <WeatherTile icon={<CloudRain size={14} />} label="Rain (24 h)" value={`${w.rain_in} in`} />
                )}
              </div>
            </Panel>
          </div>

          <Panel title="5-day fire danger">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {forecast.days.map((day, i) => (
                <li
                  key={day.date}
                  className={`border p-3 text-center ${i === 0 ? "border-navy bg-navy-soft" : "border-slate-200 bg-slate-50"}`}
                >
                  <div className="font-mono text-sm font-semibold uppercase tracking-wide text-navy-deep">{formatDay(day.date, { weekday: "short" })}</div>
                  <div className="text-xs text-slate-600">{formatDay(day.date, { month: "short", day: "numeric" })}</div>
                  <div
                    className={`mt-2 px-1 py-1 text-xs font-semibold ${
                      day.rating ? CHIP_STYLE[day.rating] : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {dayLabel(day)}
                  </div>
                  <div className="mt-2 font-mono text-sm font-semibold tabular-nums text-navy-deep">{day.weather.temp_f}°F</div>
                  <div className="text-xs text-slate-600">
                    {day.weather.precip_probability !== null
                      ? `${day.weather.precip_probability}% rain`
                      : `${day.weather.rain_in} in rain`}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <p className="px-1 text-xs text-slate-600">
            Canadian Fire Weather Index with Alaska (AICC) danger ratings, using Open-Meteo weather. Gridded weather can
            read wetter than local stations, so ratings may run lower than official ones.
          </p>
        </>
      )}

      <FireDangerMap date={date} selected={place} onPick={setPlace} />
    </div>
  );
}
