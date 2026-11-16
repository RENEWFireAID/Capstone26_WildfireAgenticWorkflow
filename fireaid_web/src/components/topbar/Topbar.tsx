"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
// uaf.edu's own header artwork: a blue mark with white outlines that reads as an
// outline on UAF Blue, and the white wordmark beside it.
import uafMark from "./assets/uaf-mark.png";
import uafWordmark from "./assets/uaf-wordmark.png";
import argonneLogo from "./assets/argonne.jpg";
import doeLogo from "./assets/doe-logo.png";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Chat", href: "/portal" },
  { label: "Apps", href: "/apps" },
  { label: "Data", href: "/data" },
  { label: "Prompt", href: "/prompt" },
  { label: "Team", href: "/team" },
];

const PARTNERS = [
  { logo: argonneLogo, alt: "Argonne National Laboratory", kicker: "Partner Lab", name: "Argonne National Laboratory", pad: "p-1.5" },
  { logo: doeLogo, alt: "U.S. Department of Energy", kicker: "Federal Sponsor", name: "U.S. Department of Energy", pad: "p-1" },
];

/**
 * Laid out like uaf.edu's header: the UAF lockup on UAF Blue, the light blue to
 * gold rule, then the menu on UAF navy.
 */
export default function Topbar() {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header>
      <div className="bg-navy">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-2.5 md:px-6">
          <Link href="/" className="flex items-center gap-4" aria-label="FireAID home, University of Alaska Fairbanks">
            <span className="flex items-center gap-2.5">
              <Image src={uafMark} alt="" priority className="h-10 w-auto" />
              <Image src={uafWordmark} alt="" priority className="hidden h-10 w-auto sm:block" />
            </span>
            <span className="h-9 w-px bg-white/30" aria-hidden="true" />
            <span className="flex flex-col leading-tight">
              <span className="text-[11px] font-semibold tracking-wide text-gold">Data/AI Lab</span>
              <span className="text-lg font-bold tracking-tight text-white">FireAID</span>
            </span>
          </Link>

          <div className="flex items-center gap-5">
            {PARTNERS.map(({ logo, alt, kicker, name, pad }, i) => (
              <div key={name} className="flex items-center gap-5">
                {i > 0 && <span className="hidden h-7 w-px bg-white/25 sm:block" aria-hidden="true" />}
                <div className="flex items-center gap-2">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ${pad}`}>
                    <Image src={logo} alt={alt} className="h-full w-full object-contain" />
                  </span>
                  <div className="hidden min-w-0 lg:block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">{kicker}</p>
                    <p className="whitespace-nowrap text-xs font-semibold leading-tight text-white">{name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* uaf.edu's rule: UAF light blue through grey to UAF Gold. */}
      <div className="h-1 w-full bg-[linear-gradient(90deg,var(--color-uaf-sky)_0%,#c4cfda_50%,var(--color-gold)_100%)]" aria-hidden="true" />

      <nav className="bg-navy-deep" aria-label="Main">
        {/* Scrolls sideways on phones instead of hiding the links. */}
        <div className="mx-auto flex max-w-7xl justify-start gap-1 overflow-x-auto px-2 md:justify-center md:gap-4 md:px-6">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm font-semibold transition ${
                isActive(href)
                  ? "border-gold text-white"
                  : "border-transparent text-slate-200 hover:border-gold/60 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
