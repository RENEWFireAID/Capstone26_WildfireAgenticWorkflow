"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, CloudSun, FileText, Flame, LandPlot, Snowflake, ThermometerSun, type LucideIcon } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { CONTOURS, PEAKS } from "@/components/layout/uafBackdrops";

type Dataset = {
  label: string;
  desc: string;
  detail: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
};

const FIREAID_DATA: Dataset[] = [
  {
    label: "Fire history",
    desc: "Every fire recorded by the Alaska Fire Service, with location, size, cause and agency.",
    detail: "33,596 fires · 1939–2024",
    icon: Flame,
    href: "/fire-history",
  },
  {
    label: "Research literature",
    desc: "Abstracts of papers on fire, climate and ecology, with title, authors, year and field.",
    detail: "101,856 abstracts",
    icon: FileText,
    href: "/publication",
  },
  {
    label: "Wildfire terminology",
    desc: "Definitions of the fire science and fire management terms used across FireAID.",
    detail: "Glossary",
    icon: BookOpen,
    href: "/library",
  },
];

const OTHER_DATA: Dataset[] = [
  {
    label: "Weather",
    desc: "Current weather conditions and the fire risk they imply.",
    detail: "Live",
    icon: CloudSun,
    href: "/weather",
  },
  {
    label: "Permafrost",
    desc: "Active layer thickness from the Circumpolar Active Layer Monitoring network.",
    detail: "External · CALM, George Washington University",
    icon: Snowflake,
    href: "https://www2.gwu.edu/~calm/data/north.htm",
    external: true,
  },
  {
    label: "FNSB parcels",
    desc: "The borough's parcel boundaries with tax roll information, used unaltered by Parcel Fire Risk.",
    detail: "External · Fairbanks North Star Borough",
    icon: LandPlot,
    href: "https://gis-data-fnsb.hub.arcgis.com/datasets/4af1635b48c1490784c5f9cb1e0a8a49_0/explore",
    external: true,
  },
  {
    label: "Fire weather",
    desc: "Daily weather and Fire Weather Index values from stations across Alaska, including 17 around Fairbanks.",
    detail: "External · Alaska Fire & Fuels, MesoWest",
    icon: ThermometerSun,
    href: "https://akff.mesowest.org/",
    external: true,
  },
];

/** uaf.edu's icon block: a white line icon over an underlined slab-serif link. */
function DatasetBlock({ data }: { data: Dataset }) {
  const { label, desc, detail, icon: Icon, href, external } = data;
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex flex-col items-center px-4 text-center text-white"
    >
      <Icon size={60} strokeWidth={1.25} aria-hidden="true" className="transition group-hover:text-gold" />
      <h3 className="mt-5 flex items-center gap-1.5 text-3xl font-bold underline decoration-2 underline-offset-[6px] transition group-hover:text-gold">
        {label}
        {external && <ArrowUpRight size={22} aria-label="Opens in a new tab" />}
      </h3>
      <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-slate-200">{desc}</p>
      <p className="mt-2 font-mono text-sm font-semibold uppercase tracking-wide text-uaf-sky">{detail}</p>
    </Link>
  );
}

// The last section grows to meet the footer, so short pages leave no bare gap.
function Section({ title, note, data, backdrop, columns, last = false }: {
  title: string;
  note: string;
  data: Dataset[];
  backdrop: React.CSSProperties;
  columns: string;
  last?: boolean;
}) {
  return (
    <section className={`px-6 py-14 md:px-10 ${last ? "flex-1" : ""}`} style={backdrop}>
      <div className="max-w-6xl">
        <h2 className="text-3xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-200">{note}</p>
        <ul className={`mt-10 grid grid-cols-1 gap-x-8 gap-y-12 ${columns}`}>
          {data.map((d) => (
            <li key={d.label}>
              <DatasetBlock data={d} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function DataPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-8 md:px-10">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">FireAID</p>
          <h1 className="mt-1 text-4xl font-bold leading-tight text-navy-deep">Data</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
            The datasets behind the apps and the assistant. Open one to browse or download it.
          </p>
        </header>

        <Section
          title="FireAID datasets"
          note="Collected and served by FireAID; the apps and the assistant read these."
          data={FIREAID_DATA}
          backdrop={{ backgroundColor: "var(--color-navy-deep)", backgroundImage: CONTOURS }}
          columns="md:grid-cols-3"
        />
        <Section
          title="Other sources"
          note="Live conditions and outside datasets alongside FireAID's own."
          data={OTHER_DATA}
          backdrop={{ backgroundColor: "var(--color-navy)", backgroundImage: PEAKS }}
          columns="md:grid-cols-2 xl:grid-cols-4"
          last
        />
      </main>
    </div>
  );
}
