import Link from "next/link";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";
import { ArrowUpRight, BookOpen, FileText, Flame, Sprout, TrendingUp, TriangleAlert } from "lucide-react";

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

export default function AppsPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="FireAID"
          title="Apps"
          description="Six tools over Alaska wildfire data, each built and maintained by a researcher in the UAF Data/AI Lab."
        />

        <div className="flex-1 px-6 py-8 md:px-10">
          <ul className="grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {APPS.map(({ label, kind, desc, data, icon: Icon, href, developer, role }) => (
              <li key={label} className="min-w-0">
                <Link
                  href={href}
                  className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-navy/40 hover:shadow-[0_6px_24px_-12px_rgba(0,51,102,0.35)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-soft text-navy">
                      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <ArrowUpRight
                      size={18}
                      className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-navy"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="mt-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{kind}</p>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-navy-deep">{label}</h2>
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
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
