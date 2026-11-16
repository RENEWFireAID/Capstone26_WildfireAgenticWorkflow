import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import PageHeader from "@/components/layout/PageHeader";

type Campus = "UAF" | "UAA";

type Student = {
  name: string;
  campus: Campus;
  // Degree level and major, as each person gave them.
  program: string;
  lead?: boolean;
  app?: { label: string; href: string };
  project?: string;
};

const INVESTIGATORS = [
  { name: "Arghya Kusum Das", role: "Principal Investigator" },
  { name: "Orion Lawlor",     role: "Co-Investigator" },
  { name: "Santosh Panda",    role: "Co-Investigator" },
  { name: "Mario Muscarella", role: "Co-Investigator" },
  { name: "Liam Forbes",      role: "Co-Investigator" },
  { name: "Kevin Galloway",   role: "Co-Investigator" },
  { name: "Murat Kaceli",     role: "Co-Investigator" },
  { name: "Tanwi Mallick",    role: "Co-Investigator" },
];

const STUDENTS: Student[] = [
  { name: "Ivy Swenson",         campus: "UAF", program: "Undergraduate · Computer Science", lead: true, app: { label: "Fire History", href: "/mcp-tools" } },
  { name: "Noah Bush",           campus: "UAF", program: "Undergraduate · Computer Science", lead: true, app: { label: "Alaska Fire Risk", href: "/fire-risk" } },
  { name: "Sumana Sahoo",        campus: "UAF", program: "Ph.D. · Natural Resources and Sustainability", app: { label: "Forest Trends", href: "/forest-trends" } },
  { name: "Muhammad Saffiullah", campus: "UAA", program: "Undergraduate · Computer Science", app: { label: "Burn Severity Recovery", href: "/burn-recovery" } },
  { name: "Yara Hassan",         campus: "UAA", program: "Undergraduate · Electrical Engineering", app: { label: "Wildfire Prediction", href: "/wildfire-prediction" } },
  { name: "Utsav Dutta",         campus: "UAA", program: "Undergraduate · Computer Science", app: { label: "Publication", href: "/publication" } },
  { name: "Jenae Matson",        campus: "UAF", program: "Undergraduate · Computer Science", app: { label: "Terminology", href: "/library" } },
  { name: "Kohlby Vierthaler",   campus: "UAF", program: "B.S./M.S. · Computer Science", project: "Wildfire Risk / Remote Sensing App" },
  { name: "Chloe Reynolds",      campus: "UAF", program: "Mechanical Engineering, Aerospace Engineering, and Applied Physics", project: "Wildfire Genome Data" },
  { name: "Emma Heil",           campus: "UAF", program: "Wildlife Biology and Conservation", project: "Parcel Fire Risk Score" },
  { name: "Elliott Lewandowski", campus: "UAF", program: "Undergraduate" },
  { name: "Andrew Winford",      campus: "UAF", program: "Undergraduate" },
  { name: "Daniel Kim",          campus: "UAF", program: "Undergraduate" },
  { name: "Malachi Retherford",  campus: "UAA", program: "Undergraduate" },
];

const LEADS = STUDENTS.filter((s) => s.lead);
const RESEARCHERS = STUDENTS.filter((s) => !s.lead);
const APPS_BUILT = STUDENTS.filter((s) => s.app).length;

// Each campus in its own colours; the only colour on this page.
const CAMPUS_STYLE: Record<Campus, { label: string; chip: string; dot: string }> = {
  UAF: { label: "UAF", chip: "bg-navy-soft text-navy", dot: "bg-gold" },
  UAA: { label: "UAA", chip: "bg-[#e6f1ec] text-[#00583d]", dot: "bg-[#ffc425]" },
};

// First and last name, so "Arghya Kusum Das" reads AD.
const initials = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-navy font-mono font-semibold text-white ${
        size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-sm"
      }`}
    >
      {initials(name)}
    </span>
  );
}

function CampusChip({ campus }: { campus: Campus }) {
  const style = CAMPUS_STYLE[campus];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${style.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}

function Work({ student }: { student: Student }) {
  if (student.app) {
    return (
      <Link href={student.app.href} className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline">
        Built {student.app.label}
        <ArrowRight size={12} aria-hidden="true" />
      </Link>
    );
  }
  if (student.project) {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-snug text-slate-600">
        <FlaskConical size={12} className="mt-px shrink-0 text-slate-500" aria-hidden="true" />
        <span>Working on <span className="font-semibold text-slate-800">{student.project}</span></span>
      </p>
    );
  }
  return null;
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
      <h2 className="text-lg font-bold tracking-tight text-navy-deep">{title}</h2>
      <span className="font-mono text-xs text-slate-500">{note}</span>
    </div>
  );
}

export default function TeamPage() {
  const [pi, ...coInvestigators] = INVESTIGATORS;
  const stats: [string, string][] = [
    [String(INVESTIGATORS.length), "Investigators"],
    [String(STUDENTS.length), "Student researchers"],
    [String(APPS_BUILT), "Apps built by students"],
    ["2", "Campuses: UAF and UAA"],
  ];

  return (
    <div className="flex min-h-screen w-full">
      <FireAIDSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          eyebrow="FireAID"
          title="Team"
          description="FireAID is built at the UAF Data/AI Lab with Argonne National Laboratory, funded by the U.S. Department of Energy. Students design and build the apps; investigators guide the research."
        />

        <div className="bg-navy px-6 md:px-10">
          <dl className="grid max-w-6xl grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label} className="border-white/10 py-5 pr-4 [&:not(:first-child)]:lg:border-l [&:not(:first-child)]:lg:pl-6">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-mono text-3xl font-semibold tabular text-gold">{value}</span>
                  <span className="mt-0.5 block text-xs text-slate-300">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-1 flex-col gap-10 px-6 py-8 md:px-10">
          <section className="max-w-6xl">
            <SectionHead title="Principal Investigator and Co-Investigators" note={`${INVESTIGATORS.length} people`} />
            <div className="mb-3 flex items-center gap-4 rounded-xl border border-slate-200 border-l-4 border-l-navy bg-white p-5">
              <Avatar name={pi.name} size="lg" />
              <div className="min-w-0">
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-navy">{pi.role}</p>
                <p className="mt-0.5 text-lg font-bold text-navy-deep">{pi.name}</p>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {coInvestigators.map((p) => (
                <li key={p.name} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <Avatar name={p.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{p.name}</p>
                    <p className="text-sm text-slate-600">{p.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="max-w-6xl">
            <SectionHead title="Framework leads" note="Own the shared platform the apps run on" />
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {LEADS.map((s) => (
                <li key={s.name} className="flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
                  <Avatar name={s.name} size="lg" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-navy-deep">{s.name}</span>
                      <CampusChip campus={s.campus} />
                    </div>
                    <p className="text-sm text-slate-600">{s.program}</p>
                    <Work student={s} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="max-w-6xl">
            <SectionHead title="Student researchers" note={`${RESEARCHERS.length} people`} />
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {RESEARCHERS.map((s) => (
                <li key={s.name} className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <Avatar name={s.name} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{s.name}</span>
                      <CampusChip campus={s.campus} />
                    </div>
                    <p className="text-sm leading-snug text-slate-600">{s.program}</p>
                    <Work student={s} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
