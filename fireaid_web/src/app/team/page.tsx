import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";
import { CONTOURS, PEAKS } from "@/components/layout/uafBackdrops";

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
  { name: "Yara Hassan",         campus: "UAA", program: "Undergraduate · Electrical Engineering" },
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
      <Link href={student.app.href} className="inline-flex items-center gap-1 text-sm font-semibold text-navy underline decoration-navy/40 underline-offset-2 hover:decoration-navy">
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

// uaf.edu's cards: white, square and lifted off a dark section by a soft shadow.
const CARD = "bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]";

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-3xl font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-200">{note}</p>
    </div>
  );
}

function StudentCard({ student, large = false }: { student: Student; large?: boolean }) {
  return (
    <div className={`flex h-full min-w-0 items-start gap-4 ${CARD} ${large ? "p-6" : "p-5"}`}>
      <Avatar name={student.name} size={large ? "lg" : "md"} />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className={`${large ? "text-xl" : "text-lg"} font-bold leading-tight text-navy-deep`}>{student.name}</h4>
          <CampusChip campus={student.campus} />
        </div>
        <p className="text-sm leading-snug text-slate-600">{student.program}</p>
        <Work student={student} />
      </div>
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
        <header className="border-b border-slate-200 bg-white px-6 py-8 md:px-10">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">FireAID</p>
          <h1 className="mt-1 text-4xl font-bold leading-tight text-navy-deep">Team</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
            FireAID is built at the UAF Data/AI Lab with Argonne National Laboratory, funded by the U.S. Department of Energy.
            Students design and build the apps; investigators guide the research.
          </p>
        </header>

        <div className="bg-navy px-6 md:px-10">
          <dl className="grid max-w-6xl grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label} className="border-white/15 py-6 pr-4 [&:not(:first-child)]:lg:border-l [&:not(:first-child)]:lg:pl-6">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-mono text-4xl font-semibold tabular text-gold">{value}</span>
                  <span className="mt-0.5 block text-sm text-slate-200">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="px-6 py-12 md:px-10" style={{ backgroundColor: "var(--color-navy-deep)", backgroundImage: CONTOURS }}>
          <div className="max-w-6xl">
            <SectionHead title="Principal Investigator and Co-Investigators" note="The faculty who guide the research." />
            <div className={`mb-5 flex items-center gap-5 border-l-4 border-navy p-6 ${CARD}`}>
              <Avatar name={pi.name} size="lg" />
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold uppercase tracking-wide text-navy">{pi.role}</p>
                <h3 className="mt-0.5 text-2xl font-bold text-navy-deep">{pi.name}</h3>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {coInvestigators.map((p) => (
                <li key={p.name} className={`flex min-w-0 items-center gap-3 p-5 ${CARD}`}>
                  <Avatar name={p.name} />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-navy-deep">{p.name}</h3>
                    <p className="text-sm text-slate-600">{p.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex-1 px-6 py-12 md:px-10" style={{ backgroundColor: "var(--color-navy)", backgroundImage: PEAKS }}>
          <div className="max-w-6xl">
            <SectionHead title="Students" note="Undergraduate and graduate researchers who design and build the apps." />

            <h3 className="mb-3 text-xl font-bold text-white">Framework leads</h3>
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {LEADS.map((s) => (
                <li key={s.name}><StudentCard student={s} large /></li>
              ))}
            </ul>

            <h3 className="mb-3 mt-10 text-xl font-bold text-white">Student researchers</h3>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {RESEARCHERS.map((s) => (
                <li key={s.name}><StudentCard student={s} /></li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
