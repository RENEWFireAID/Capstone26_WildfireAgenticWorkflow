import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { CONTOURS, PEAKS } from "@/components/layout/uafBackdrops";
import burnSeverityPreview from "./previews/burn-severity.jpg";
import fireHistoryPreview from "./previews/fire-history.jpg";
import fireRiskPreview from "./previews/fire-risk.jpg";
import forestTrendsPreview from "./previews/forest-trends.jpg";
import { ArrowRight, BookOpen, FileText, Flame, MapPinned, Satellite, Sprout, TriangleAlert } from "lucide-react";

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
    label: "Forest Trends",
    kind: "Remote sensing",
    desc: "Map where the forest has been greening or browning since 2000, and follow any point's recovery after fire and its link to climate.",
    data: "Landsat NDVI, NBR, NDMI · TerraClimate · Google Earth Engine",
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
    label: "Parcel Fire Risk",
    kind: "Property risk",
    desc: "See the vegetation fire risk of any property in the Fairbanks North Star Borough: click the map or look up a parcel number for its 0-100 score.",
    data: "FNSB vegetation map and tax parcels · 63,884 parcel records · Google Earth Engine",
    icon: MapPinned,
    href: "/parcel-risk",
    developer: "Emma Heil and Darshan",
    role: "Parcel Fire Risk Score notebook · built into FireAID by Noah Bush",
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

// A screenshot of each app's main view with real data in it, captured from the
// live site; apps with no map to show fall back to their icon on UAF Blue.
const PREVIEWS: Record<string, StaticImageData> = {
  "Fire History": fireHistoryPreview,
  "Alaska Fire Risk": fireRiskPreview,
  "Forest Trends": forestTrendsPreview,
  "Burn Severity Recovery": burnSeverityPreview,
};

// Reference tools sit apart from the apps that map and model fire data.
const REFERENCE = new Set(["Publication", "Terminology"]);
const SECTIONS = [
  { title: "Fire and vegetation", note: "Map, forecast and model Alaska fire and its aftermath.", apps: APPS.filter((a) => !REFERENCE.has(a.label)), onBlue: false, backdrop: { backgroundColor: "var(--color-navy-deep)", backgroundImage: CONTOURS } },
  { title: "Reference", note: "Look up the research and the terms behind the apps.", apps: APPS.filter((a) => REFERENCE.has(a.label)), onBlue: true, backdrop: { backgroundColor: "var(--color-navy)", backgroundImage: PEAKS } },
];

// onBlue: the card sits on the UAF Blue section, so its icon panel goes navy to stay distinct.
function AppCard({ app, onBlue }: { app: (typeof APPS)[number]; onBlue: boolean }) {
  const { label, kind, desc, data, icon: Icon, href, developer, role } = app;
  const preview = PREVIEWS[label];
  return (
    <Link href={href} className="group flex h-full flex-col bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5">
      <div className={`relative aspect-[2/1] overflow-hidden ${onBlue ? "bg-navy-deep" : "bg-navy"}`}>
        {preview ? (
          <Image src={preview} alt={`${label} with real data`}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ backgroundImage: PEAKS }}>
            <Icon size={64} strokeWidth={1.25} className="text-white" aria-hidden="true" />
          </div>
        )}
      </div>
      {/* uaf.edu's rule: UAF light blue through grey to UAF Gold. */}
      <div className="h-1 bg-[linear-gradient(90deg,var(--color-uaf-sky)_0%,#c4cfda_50%,var(--color-gold)_100%)]" aria-hidden="true" />

      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-navy">{kind}</p>
        <h3 className="mt-1 text-2xl font-bold leading-tight text-navy-deep">{label}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>

        <div className="flex-1" />
        <dl className="mt-5 grid gap-1.5 text-xs">
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

        <span className="mt-5 inline-flex items-center justify-center gap-2 self-start bg-gold px-6 py-2.5 font-mono text-[15px] font-semibold uppercase tracking-wide text-navy-deep transition group-hover:bg-[#ffd633]">
          Open app
          <ArrowRight size={16} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export default function AppsPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-8 md:px-10">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">FireAID</p>
          <h1 className="mt-1 text-4xl font-bold leading-tight text-navy-deep">Apps</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
            Seven tools over Alaska wildfire data, each built and maintained by a researcher in the UAF Data/AI Lab.
          </p>
        </header>

        {SECTIONS.map(({ title, note, apps, onBlue, backdrop }, i) => (
          // The last section grows to meet the footer, so short pages leave no bare gap.
          <section key={title} className={`px-6 py-10 md:px-10 ${i === SECTIONS.length - 1 ? "flex-1" : ""}`} style={backdrop}>
            <div className="max-w-6xl">
              <h2 className="text-3xl font-bold text-white">{title}</h2>
              <p className="mt-1 text-sm text-slate-200">{note}</p>
              <ul className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {apps.map((app) => (
                  <li key={app.label} className="min-w-0">
                    <AppCard app={app} onBlue={onBlue} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
