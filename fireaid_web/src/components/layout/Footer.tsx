import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";
import uafMark from "@/components/topbar/assets/uaf-mark.png";
import topoBorder from "./assets/uaf-topo-border.svg";

// Laid out and linked as uaf.edu's footer is; every URL was checked against it.
const CONTACT = [
  { label: "Contact information", href: "https://www.uaf.edu/uaf/contact/index.php" },
  { label: "Emergency information", href: "https://uafalert.alaska.edu/" },
  { label: "Title IX & confidential reporting", href: "https://www.uaf.edu/titleix/index.php" },
  { label: "Website help", href: "https://www.uaf.edu/uaf/help/index.php" },
];
const MORE = [
  { label: "About", href: "https://www.uaf.edu/uaf/about/index.php" },
  { label: "Academics", href: "https://www.uaf.edu/academics/index.php" },
  { label: "Admissions", href: "https://www.uaf.edu/admissions/index.php" },
  { label: "Financial aid", href: "https://www.uaf.edu/finaid/index.php" },
  { label: "Athletics", href: "https://alaskananooks.com/" },
  { label: "Indigenous programs", href: "https://www.uaf.edu/indigenous/index.php" },
  { label: "Research", href: "https://www.uaf.edu/research/index.php" },
  { label: "Giving", href: "https://www.uaf.edu/giving/index.php" },
];
const FIREAID = [
  { label: "Apps", href: "/apps" },
  { label: "Data", href: "/data" },
  { label: "Team", href: "/team" },
  { label: "Send feedback", href: "/feedback" },
];

// X and TikTok are not in lucide; these are their marks from Simple Icons (CC0).
const XMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);
const TikTokMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);
const SOCIAL = [
  { label: "UAF on Facebook", href: "https://www.facebook.com/uafairbanks/", icon: <Facebook className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden="true" /> },
  { label: "UAF on Instagram", href: "https://www.instagram.com/uafairbanks/", icon: <Instagram className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" /> },
  { label: "UAF on TikTok", href: "https://www.tiktok.com/@uafairbanks", icon: <TikTokMark /> },
  { label: "UAF on X", href: "https://twitter.com/uafairbanks/", icon: <XMark /> },
];

// Links to other sites open in a new tab so FireAID stays open behind them.
const external = { target: "_blank", rel: "noopener noreferrer" } as const;
const linkClass = "underline decoration-white/60 underline-offset-2 transition hover:text-gold hover:decoration-gold";

function Column({ title, links, internal = false }: { title: string; links: { label: string; href: string }[]; internal?: boolean }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] marker:text-white/70">
        {links.map(({ label, href }) => (
          <li key={label}>
            {internal ? (
              <Link href={href} className={linkClass}>{label}</Link>
            ) : (
              <a href={href} className={linkClass} {...external}>{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 pb-12 pt-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="text-2xl font-bold leading-tight">University of Alaska Fairbanks</h2>
          <p className="mt-1 text-sm font-semibold text-gold">FireAID · UAF Data/AI Lab</p>
          <address className="mt-3 text-[15px] not-italic leading-relaxed text-white/90">
            1731 South Chandalar Dr.<br />
            Fairbanks, AK 99775<br />
            907-474-7034 <span className="text-xs">(general info)</span><br />
            1-800-478-1823 <span className="text-xs">(admissions)</span>
          </address>
        </div>
        <Column title="FireAID" links={FIREAID} internal />
        <Column title="Contact us" links={CONTACT} />
        <Column title="Find out more" links={MORE} />
      </div>

      {/* uaf.edu's lower band: a darker blue closed by its Troth Yeddha' topographic border. */}
      <div
        className="bg-[#1e5c8d] bg-bottom bg-no-repeat px-6 pb-40 pt-10 text-center"
        style={{ backgroundImage: `url(${topoBorder.src})`, backgroundSize: "100%" }}
      >
        <div className="mx-auto max-w-5xl">
          <a href="https://www.uaf.edu/" {...external} aria-label="University of Alaska Fairbanks" className="inline-block">
            <Image src={uafMark} alt="" className="mx-auto h-10 w-auto" />
          </a>
          <ul className="mt-3 flex justify-center gap-2">
            {SOCIAL.map(({ label, href, icon }) => (
              <li key={label}>
                <a href={href} {...external} aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-[5px] bg-white text-navy transition hover:bg-gold hover:text-navy-deep">
                  {icon}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">#NanookNation</p>

          <p className="mx-auto mt-6 max-w-4xl text-xs leading-relaxed text-white/85">
            FireAID is funded in part by DOE RENEW #DE-SC0025715; NSF MRI #2320196; NSF EPSCoR RII Track-4 #2327456; USGS NIWR
            G00014344; the UAF Arctic Fellow Grant (UAF Center of ICE / Office of Naval Research); AIM-AHEAD PAIR (NIH Agreement No.
            1OT2OD032581); and Google Summer of Code 2024, 2025 and 2026. It also uses high-performance computing and storage operated
            by the Research Computing Systems Group at the UAF Geophysical Institute. Views and conclusions are the authors&apos; own and
            do not represent the official policies of the funding agencies.
          </p>

          <div className="mt-5 space-y-1.5 text-sm leading-relaxed">
            <p>
              The <a href="https://www.alaska.edu/alaska/" className={linkClass} {...external}>University of Alaska</a> is an equal
              opportunity/equal access employer and educational institution. The university is committed to a{" "}
              <a href="https://www.alaska.edu/nondiscrimination" className={linkClass} {...external}>policy of nondiscrimination</a>{" "}
              against individuals on the basis of any legally protected status.
            </p>
            <p>
              UA is committed to providing accessible websites. Learn more about UA&apos;s{" "}
              <a href="https://www.alaska.edu/webaccessibility/" className={linkClass} {...external}>notice of web accessibility</a>.
            </p>
            <p>
              <a href="https://www.alaska.edu/records/records/compliance/gdpr/ua-privacy-statement/" className={linkClass} {...external}>Privacy Statement</a>
            </p>
            <p>
              Questions or problems with FireAID? <Link href="/feedback" className={linkClass}>Send the team feedback</Link>.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
