"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CloudSun, FileText, Flame, Snowflake } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";

const DATA_ITEMS = [
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
];

export default function DataPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="FireAID"
          title="Data"
          description="The datasets behind the apps and the assistant. Open one to browse or download it."
        />

        <div className="flex-1 px-6 py-8 md:px-10">
          <ul className="max-w-4xl divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {DATA_ITEMS.map(({ label, desc, detail, icon: Icon, href, external }) => (
              <li key={label}>
                <Link
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-soft text-navy">
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900 group-hover:text-navy">{label}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-slate-600">{desc}</span>
                    <span className="mt-1 block font-mono text-[11px] text-slate-500">{detail}</span>
                  </span>
                  {external ? (
                    <ArrowUpRight size={18} className="shrink-0 text-slate-400 group-hover:text-navy" aria-label="Opens in a new tab" />
                  ) : (
                    <ArrowRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-navy" aria-hidden="true" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
