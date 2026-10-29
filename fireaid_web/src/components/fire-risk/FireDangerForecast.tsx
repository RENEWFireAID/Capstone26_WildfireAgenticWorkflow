"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CloudRain, Droplets, Flame, MapPin, RefreshCw, Thermometer, Wind } from "lucide-react";

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
  loading: () => <div className="h-[540px] rounded-2xl bg-slate-200 motion-safe:animate-pulse" />,
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
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500";
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
    <div className="relative min-w-56 flex-1">
      <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search an Alaska place"
        placeholder="Search an Alaska place..."
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
      />
      {searching && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none"
              >
                {r.name}
                <span className="ml-2 text-xs text-slate-500">
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
          <div key={level} className={`h-1.5 flex-1 rounded-full bg-current ${level === rating ? "" : "opacity-25"}`} />
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
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
        {icon}
        {label}
      </div>
      <div className="mt-1 whitespace-nowrap text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-600">{sub}</div>}
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <PlaceSearch onPick={setPlace} />
          <input
            type="date"
            aria-label="Date"
            value={date}
            min={EARLIEST_DAY}
            max={addDays(today, MAX_LEAD_DAYS)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
          />
          <button
            type="button"
            onClick={() => setDate(EXAMPLE_DAY)}
            className={`rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition-colors duration-150 hover:bg-orange-100 ${FOCUS}`}
          >
            Example: Jun 15, 2022
          </button>
          {date !== today && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className={`rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 ${FOCUS}`}
            >
              Back to today
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PICKS.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-pressed={place.name === p.name}
              onClick={() => setPlace(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${FOCUS} ${
                place.name === p.name ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load the forecast: {error}
        </div>
      ) : !forecast || !first || !w ? (
        <div aria-busy="true" aria-label="Loading forecast" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-60 rounded-2xl bg-slate-200 motion-safe:animate-pulse" />
            <div className="h-60 rounded-2xl bg-slate-200 motion-safe:animate-pulse" />
          </div>
          <div className="h-40 rounded-2xl bg-slate-200 motion-safe:animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className={`flex flex-col rounded-2xl p-6 shadow-sm transition-colors duration-200 ${
                first.rating ? CARD_STYLE[first.rating] : "bg-slate-200 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span>
                  {place.name} · {formatDay(first.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
                {loading && <RefreshCw size={14} className="motion-safe:animate-spin" aria-label="Updating" />}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Flame size={40} aria-hidden />
                <div>
                  <div className="text-sm font-medium">Fire danger</div>
                  <div className="text-4xl font-bold leading-tight">{dayLabel(first)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm">
                {first.rating
                  ? first.reasons.join(", ").replace(/^./, (c) => c.toUpperCase()) + "."
                  : STATUS_NOTE[first.status as keyof typeof STATUS_NOTE]}
              </p>
              <DangerScale rating={first.rating} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Weather at 2 p.m.</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {first.observed ? "Observed" : "Forecast"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-900">5-day fire danger</div>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {forecast.days.map((day, i) => (
                <li
                  key={day.date}
                  className={`rounded-xl p-3 text-center ${i === 0 ? "bg-slate-100 ring-1 ring-slate-300" : "bg-slate-50"}`}
                >
                  <div className="text-sm font-semibold text-slate-900">{formatDay(day.date, { weekday: "short" })}</div>
                  <div className="text-xs text-slate-600">{formatDay(day.date, { month: "short", day: "numeric" })}</div>
                  <div
                    className={`mt-2 rounded-lg px-1 py-1 text-xs font-semibold ${
                      day.rating ? CHIP_STYLE[day.rating] : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {dayLabel(day)}
                  </div>
                  <div className="mt-2 text-sm tabular-nums text-slate-800">{day.weather.temp_f}°F</div>
                  <div className="text-xs text-slate-600">
                    {day.weather.precip_probability !== null
                      ? `${day.weather.precip_probability}% rain`
                      : `${day.weather.rain_in} in rain`}
                  </div>
                </li>
              ))}
            </ol>
          </div>

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
