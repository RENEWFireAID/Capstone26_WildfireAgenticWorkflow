"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const LiveFireMap = dynamic(() => import("@/components/map/LiveFireMap"), { ssr: false });

const CSS = `
  @keyframes float-up {
    0%   { transform: translateY(0)   scale(1);   opacity: 0.6; }
    100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
  }
  @keyframes fade-slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(249,115,22,0.5), 0 0 40px rgba(249,115,22,0.2); }
    50%       { box-shadow: 0 0 40px rgba(249,115,22,1),   0 0 80px rgba(249,115,22,0.5); }
  }
  @keyframes scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  .particle {
    position: absolute;
    bottom: -20px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,120,20,0.8), transparent);
    animation: float-up linear infinite;
    pointer-events: none;
  }
  .stat-badge {
    animation: fade-slide-up 0.6s ease both;
  }
  .enter-btn {
    animation: pulse-glow 2.5s ease-in-out infinite;
  }
`;

const PARTICLES: { id: number; left: string; size: string; duration: string; delay: string; opacity: number }[] = [];

function useCountUp(target: number | null, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === null) return;
    let start = 0;
    const step = 16;
    const inc = target / (duration / step);
    const t = setInterval(() => {
      start += inc;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, step);
    return () => clearInterval(t);
  }, [target]);
  return val;
}

function useTypewriter(text: string, delay = 400, speed = 60) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text]);
  return displayed;
}

export default function HomePage() {
  const [fireCount, setFireCount] = useState<number | null>(null);
  const [weather, setWeather] = useState<{ temp: number; risk: string } | null>(null);
  const [aqi, setAqi] = useState<{ pm25: number; aqi: number } | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [particles, setParticles] = useState<typeof PARTICLES>([]);

  useEffect(() => {
    setParticles(Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      size: `${6 + Math.random() * 14}px`,
      duration: `${4 + Math.random() * 8}s`,
      delay: `${Math.random() * 6}s`,
      opacity: 0.3 + Math.random() * 0.5,
    })));
  }, []);
  
  // Animation of rolling numbers for live fire count
  const displayCount = useCountUp(fireCount);
  const title = useTypewriter("FireAID", 300, 80);

  // Fetch live weather for Fairbanks, AK 
  // And compute a simple fire risk level based on humidity and wind speed
  // This is a simple way to calculate the risk of fire
  // For the next scientific calculations, we will use more complex models and more data (like fuel moisture, topography, etc.)
  // Now, we only offer two index: relative humidity and wind speed, which are two of the most important factors for fire behavior

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=64.84&longitude=-147.72&current=temperature_2m,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph")
      .then(r => r.json())
      .then(data => {
        const c = data.current;
        const rh = c.relative_humidity_2m;
        const ws = c.wind_speed_10m;
        const risk = (rh < 15 && ws > 30) ? "EXTREME"
                   : (rh < 20 && ws > 25) ? "VERY HIGH"
                   : (rh < 30 && ws > 15) ? "HIGH"
                   : (rh < 40 || ws > 15) ? "MODERATE"
                   : "LOW";
        setWeather({ temp: Math.round(c.temperature_2m), risk });
      }).catch(() => {});
  // Fetch current PM2.5 and AQI for Fairbanks, AK

    fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=64.84&longitude=-147.72&current=pm2_5,us_aqi")
      .then(r => r.json())
      .then(data => {
        const c = data.current;
        setAqi({ pm25: c.pm2_5, aqi: c.us_aqi });
      }).catch(() => {});
    const t = setTimeout(() => setStatsVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex flex-col w-screen min-h-[calc(100vh-3.5rem)]"
      style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw", overflow: "hidden" }}>
      <style>{CSS}</style>

      {/* Floating fire particles */}
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: p.left, width: p.size, height: p.size,
          animationDuration: p.duration, animationDelay: p.delay, opacity: p.opacity,
        }} />
      ))}

      {/* Scanline effect */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
      }} />

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <LiveFireMap onFireCount={setFireCount} />
      </div>

      {/* Overlay */}
      <div className="relative z-10 pointer-events-none flex flex-col justify-between h-full min-h-[calc(100vh-3.5rem)] p-8">

        {/* Title */}
        <div className="pointer-events-auto" style={{
          animation: "fade-slide-up 0.8s ease both",
        }}>
          <div className="relative flex flex-col gap-2">
            <div className="absolute -inset-4 rounded-3xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(255,80,10,0.18) 0%, transparent 70%)" }} />

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.25em] uppercase text-orange-400">
                UAF Data/AI Lab
              </span>
              <div className="h-px w-8 bg-orange-500/40" />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-5xl leading-none"
                style={{ filter: "drop-shadow(0 0 16px rgba(255,100,20,0.9))", animation: "fade-slide-up 0.6s ease both" }}>
                🔥
              </span>
              <span className="text-6xl font-black tracking-tight text-white leading-none" style={{
                textShadow: "0 0 30px rgba(255,100,20,0.6), 0 0 80px rgba(255,60,0,0.3)",
                fontFamily: "monospace",
                minWidth: "8ch",
              }}>
                {title}
                {title.length < "FireAID".length && (
                  <span style={{ animation: "blink 0.8s step-end infinite", color: "#f97316" }}>|</span>
                )}
              </span>
            </div>

            <div style={{
              height: "1px", width: "16rem",
              background: "linear-gradient(to right, rgba(249,115,22,0.7), transparent)",
              marginTop: "4px",
              animation: "fade-slide-up 1s ease 0.5s both",
            }} />
            <p className="text-[11px] tracking-[0.2em] uppercase text-white/60 font-light"
              style={{ animation: "fade-slide-up 1s ease 0.7s both" }}>
              Alaska Wildfire Intelligence Platform
            </p>
          </div>
        </div>

        {/* Bottom stats + button */}
        <div className="pointer-events-auto flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            {statsVisible && (
              <>
                <StatBadge icon="🛰️" label="Live fire detections" value={fireCount !== null ? `${displayCount} active` : "Loading…"} delay={0} />
                <StatBadge icon="📊" label="Historical records" value="33,596 fires" delay={100} />
                <StatBadge icon="📅" label="Data range" value="1939 – 2024" delay={200} />
                {weather && (
                  <>
                    <StatBadge icon="🌡️" label="Fairbanks" value={`${weather.temp}°F`} delay={300} />
                    <StatBadge
                      icon="🔥" label="Fire risk" value={weather.risk} delay={400}
                      highlight={
                        weather.risk === "EXTREME" ? "extreme" :
                        weather.risk === "VERY HIGH" ? "veryhigh" :
                        weather.risk === "HIGH" ? "red" :
                        weather.risk === "MODERATE" ? "orange" : "green"
                      }
                    />
                  </>
                )}
                {aqi && (
                  <StatBadge
                    icon="💨" label="PM2.5 · AQI" delay={500}
                    value={`${aqi.pm25} μg/m³ · ${aqi.aqi}`}
                    highlight={aqi.aqi <= 50 ? "green" : aqi.aqi <= 100 ? "orange" : aqi.aqi <= 150 ? "red" : "extreme"}
                  />
                )}
              </>
            )}
          </div>

          <Link href="/portal"
            className="enter-btn rounded-2xl bg-orange-500 px-8 py-4 text-sm font-bold text-white hover:bg-orange-600 transition flex items-center gap-2"
            style={{ animation: "fade-slide-up 0.8s ease 1s both, pulse-glow 2.5s ease-in-out 2s infinite" }}
          >
            Enter FireAID →
          </Link>
        </div>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] text-white/40 pointer-events-none">
        Live fire data: ArcGIS USA Wildfires · Historical data: WFIGS via local MongoDB
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value, highlight, delay = 0 }: {
  icon: string; label: string; value: string; highlight?: string; delay?: number;
}) {
  const color =
    highlight === "extreme"  ? "text-purple-400" :
    highlight === "veryhigh" ? "text-red-400" :
    highlight === "red"      ? "text-red-400" :
    highlight === "orange"   ? "text-orange-400" :
    highlight === "green"    ? "text-green-400" : "text-white";
  return (
    <div className="stat-badge rounded-xl bg-black/60 backdrop-blur px-4 py-2 text-white shadow-lg"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[10px] text-slate-400">{icon} {label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}
