import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";

type Person = {
  name: string;
  role: string;
  lead?: boolean;
  app?: { label: string; href: string };
};

const INVESTIGATORS: Person[] = [
  { name: "Arghya Kusum Das", role: "Principal Investigator" },
  { name: "Orion Lawlor",     role: "Co-Investigator" },
  { name: "Santosh Panda",    role: "Co-Investigator" },
  { name: "Mario Muscarella", role: "Co-Investigator" },
  { name: "Liam Forbes",      role: "Co-Investigator" },
  { name: "Kevin Galloway",   role: "Co-Investigator" },
  { name: "Murat Kaceli",     role: "Co-Investigator" },
  { name: "Tanwi Mallick",    role: "Co-Investigator" },
];

const STUDENTS: Person[] = [
  { name: "Ivy Swenson",         role: "UAF Undergraduate Researcher", lead: true, app: { label: "Fire History", href: "/mcp-tools" } },
  { name: "Noah Bush",           role: "UAF Undergraduate Researcher", lead: true, app: { label: "Alaska Fire Risk", href: "/fire-risk" } },
  { name: "Sumana Sahoo",        role: "UAF PhD Student · Natural Resources and Sustainability", app: { label: "Forest Trends", href: "/forest-trends" } },
  { name: "Yara Hassan",         role: "UAA Undergraduate Researcher", app: { label: "Wildfire Prediction", href: "/wildfire-prediction" } },
  { name: "Utsav Dutta",         role: "UAA Undergraduate Researcher", app: { label: "Publication", href: "/publication" } },
  { name: "Jenae Matson",        role: "UAF Undergraduate Researcher", app: { label: "Terminology", href: "/library" } },
  { name: "Elliott Lewandowski", role: "UAF Undergraduate Researcher" },
  { name: "Andrew Winford",      role: "UAF Undergraduate Researcher" },
  { name: "Daniel Kim",          role: "UAF Undergraduate Researcher" },
  { name: "Malachi Retherford",  role: "UAA Undergraduate Researcher" },
];

// First and last name, so "Arghya Kusum Das" reads AD.
const initials = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

function PersonCard({ person }: { person: Person }) {
  return (
    <li className="flex min-w-0 gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-soft font-mono text-sm font-semibold text-navy"
        aria-hidden="true"
      >
        {initials(person.name)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{person.name}</span>
          {person.lead && (
            <span className="rounded border border-gold/70 bg-gold/15 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-navy">
              Framework lead
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm leading-snug text-slate-600">{person.role}</p>
        {person.app && (
          <Link
            href={person.app.href}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
          >
            Built {person.app.label}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

function Section({ title, count, people }: { title: string; count: string; people: Person[] }) {
  return (
    <section className="max-w-6xl">
      <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
        <h2 className="text-lg font-bold tracking-tight text-navy-deep">{title}</h2>
        <span className="font-mono text-xs text-slate-500">{count}</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.name} person={p} />
        ))}
      </ul>
    </section>
  );
}

export default function TeamPage() {
  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="FireAID"
          title="Team"
          description="FireAID is built at the UAF Data/AI Lab with Argonne National Laboratory, funded by the U.S. Department of Energy. Students design and build the apps; investigators guide the research."
        />

        <div className="flex flex-1 flex-col gap-10 px-6 py-8 md:px-10">
          <Section title="Principal Investigator and Co-Investigators" count={`${INVESTIGATORS.length} people`} people={INVESTIGATORS} />
          <Section title="Student researchers" count={`${STUDENTS.length} people`} people={STUDENTS} />
        </div>
      </main>
    </div>
  );
}
