import Link from "next/link";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";
import { ArrowUpRight, BookOpen, FileText, Flame, Satellite, Sprout, TrendingUp, TriangleAlert } from "lucide-react";

const APPS = [
  {
    label: "Fire History",
    kind: "Historical records",
    desc: "Map, filter and chart every recorded Alaska fire since 1939, or ask questions about them in plain English.",
    data: "Alaska Fire Service records · 33,596 fires, 1939–2024",
    icon: Flame,
    href: "/mcp-tools",
    developer: "Ivy Swenson",
    role: "Undergraduate Researcher · UAF Computer Science",
  },
  {
    label: "Alaska Fire Risk",
    kind: "Forecast",
    desc: "Daily fire danger for any place in Alaska, a statewide danger map, and a classifier that rates the risk of a fire.",
    data: "Canadian Fire Weather Index with AICC ratings · Open-Meteo weather",
    icon: TriangleAlert,
    href: "/fire-risk",
    developer: "Noah Bush",
    role: "Undergraduate Researcher · UAF Computer Science",
  },
  {
    label: "Wildfire Prediction",
    kind: "Machine learning",
    desc: "Fire probability for each grid cell around Fairbanks from an XGBoost model.",
    data: "Gridded temperature, humidity, wind and soil moisture · fire seasons 2000–2007",
    icon: TrendingUp,
    href: "/wildfire-prediction",
    developer: "Yara Hassan",
    role: "Undergraduate Researcher · UAA Electrical Engineering",
  },
  {
    label: "Forest Trends",
    kind: "Remote sensing",
    desc: "Follow how vegetation recovers after a fire, year by year, from satellite greenness and burn severity.",
    data: "Landsat summer NDVI and NBR · Google Earth Engine",
    icon: Sprout,
    href: "/forest-trends",
    developer: "Sumana Sahoo",
    role: "PhD Student · UAF Natural Resources and Sustainability",
  },
  {
    label: "Burn Severity Recovery",
    kind: "Fire effects research",
    desc: "Compare burn severity and post-fire greenness across three 2019 Alaska fires, and test whether recovery on one fire can be predicted from the other two.",
    data: "NASA HLS imagery, MTBS and field CBI · 3 fires, 2018–2024",
    icon: Satellite,
    href: "/burn-recovery",
    developer: "Muhammad Saffiullah",
    role: "Undergraduate Researcher · UAA Computer Science",
  },
  {
    label: "Publication",
    kind: "Research literature",
    desc: "Find research by meaning rather than keywords across a library of fire, climate and ecology abstracts.",
    data: "101,856 paper abstracts · semantic search",
    icon: FileText,
    href: "/publication",
    developer: "Utsav Dutta",
    role: "Undergraduate Researcher · UAA Computer Science",
  },
  {
    label: "Terminology",
    kind: "Reference",
    desc: "Look up the wildfire terms used across the apps, from fuel types to fire behavior.",
    data: "FireAID wildfire glossary",
    icon: BookOpen,
    href: "/library",
    developer: "Jenae Matson",
    role: "Undergraduate Researcher · UAF Computer Science",
  },
];

// Each card's cover is the colour scale its app uses for data, so the colour on
// this page means what it means inside the app. The two reference apps have no
// data scale and wear the UAF colours instead.
type Cover = { colors: string[]; scale?: string; accent: string };
const COVERS: Record<string, Cover> = {
  // The map's 100+ acre classes, ending on its largest-fire outline, so the band
  // reads as embers rather than repeating the green-to-red of the next two cards.
  "Fire History": { colors: ["#eab308", "#ea580c", "#dc2626", "#7f1d1d"], scale: "Fire size: 100 to 10,000+ acres", accent: "#c2410c" },
  "Alaska Fire Risk": { colors: ["#2563eb", "#15803d", "#facc15", "#f97316", "#dc2626"], scale: "AICC danger: Low to Extreme", accent: "#b45309" },
  // Inferno, a standard probability scale, keeps this card apart from the two
  // above; the app's own map still uses green to red.
  "Wildfire Prediction": { colors: ["#2d0a5b", "#7a1d6f", "#c2364e", "#f1701f", "#fcd34d"], scale: "Fire probability: low to high", accent: "#9d174d" },
  "Forest Trends": { colors: ["#e5d7b3", "#aed581", "#1b5e20"], scale: "NDVI greenness", accent: "#15803d" },
  "Burn Severity Recovery": { colors: ["#006400", "#70a800", "#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026", "#7a0000"], scale: "dNBR burn severity", accent: "#bd0026" },
  "Publication": { colors: ["#0a1f3d", "#236192", "#2a78d6", "#8ec5f5"], accent: "#2a78d6" },
  "Terminology": { colors: ["#236192", "#1d4f80", "#ffcd00"], accent: "#a77b00" },
};

function coverBackground({ colors }: Cover) {
  return `linear-gradient(100deg, ${colors.join(", ")})`;
}

// Reference tools sit apart from the apps that map and model fire data.
const REFERENCE = new Set(["Publication", "Terminology"]);
const SECTIONS = [
  { title: "Fire and vegetation", apps: APPS.filter((a) => !REFERENCE.has(a.label)) },
  { title: "Reference", apps: APPS.filter((a) => REFERENCE.has(a.label)) },
];

function AppCard({ app }: { app: (typeof APPS)[number] }) {
  const { label, kind, desc, data, icon: Icon, href, developer, role } = app;
  const cover = COVERS[label];
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_30px_-14px_rgba(0,51,102,0.45)]"
    >
      <div className="relative h-20 shrink-0" style={{ background: coverBackground(cover) }}>
        {/* A soft top light so flat colour bands read as a surface. */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" aria-hidden="true" />
        {cover.scale && (
          <span className="absolute bottom-2 right-2 rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700 shadow-sm">
            {cover.scale}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-6 flex items-end justify-between">
          <span
            className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-[0_4px_12px_-4px_rgba(15,27,45,0.35)] ring-1 ring-slate-200"
            style={{ color: cover.accent }}
          >
            <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <ArrowUpRight
            size={18}
            className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy"
            aria-hidden="true"
          />
        </div>

        <p className="mt-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: cover.accent }}>{kind}</p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-navy-deep">{label}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>

        <div className="flex-1" />
        <dl className="mt-5 grid gap-2 border-t border-slate-100 pt-4 text-xs">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
            <dt className="text-slate-500">Data</dt>
            <dd className="text-slate-700">{data}</dd>
          </div>
          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
            <dt className="text-slate-500">Built by</dt>
            <dd className="min-w-0">
              <span className="font-semibold text-slate-800">{developer}</span>
              <span className="block text-slate-500">{role}</span>
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}

export default function AppsPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="FireAID"
          title="Apps"
          description="Seven tools over Alaska wildfire data, each built and maintained by a researcher in the UAF Data/AI Lab."
        />

        <div className="flex flex-1 flex-col gap-10 px-6 py-8 md:px-10">
          {SECTIONS.map(({ title, apps }) => (
            <section key={title} className="max-w-6xl">
              <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
                <h2 className="text-lg font-bold tracking-tight text-navy-deep">{title}</h2>
                <span className="font-mono text-xs text-slate-500">{apps.length} apps</span>
              </div>
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {apps.map((app) => (
                  <li key={app.label} className="min-w-0">
                    <AppCard app={app} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
