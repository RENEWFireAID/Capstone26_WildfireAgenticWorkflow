"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import uafLogo from "./assets/uaf-logo.png";
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

export default function Topbar() {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="bg-navy">
      {/* One row on wide screens; below xl the links drop to a second row under the logos. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3 md:px-6">
        {/* Left: UAF Logo + FireAID */}
        <div className="order-1 flex items-center gap-4">
          {/* The logo is UAF blue, which disappears on the navy bar, so show it reversed in white. */}
          <Image
            src={uafLogo}
            alt="University of Alaska Fairbanks"
            priority
            className="h-12 w-auto shrink-0 object-contain brightness-0 invert"
          />
          <div className="h-10 w-px bg-white/20" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wide text-[#FFCC33]">
              Data/AI Lab
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              FireAID
            </span>
            <span className="text-[10px] font-medium text-white/50 tracking-wide">
              Beta v1.0
            </span>
          </div>
        </div>

        {/* Middle: Nav */}
        <nav className="order-3 hidden w-full items-center justify-center gap-7 text-sm font-semibold md:flex xl:order-2 xl:w-auto xl:flex-1">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`border-b-2 pb-1 transition ${
                isActive(href)
                  ? "border-gold text-white"
                  : "border-transparent text-slate-300 hover:border-gold/60 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: ANL + DOE logos */}
        <div className="order-2 flex items-center gap-6 xl:order-3">
          <div className="hidden h-8 w-px bg-white/20 xl:block" />

          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm">
              <Image src={argonneLogo} alt="Argonne National Laboratory" className="h-full w-full object-contain" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Partner Lab
              </p>
              <p className="whitespace-nowrap text-xs font-semibold leading-tight text-white">
                Argonne National Laboratory
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
              <Image src={doeLogo} alt="U.S. Department of Energy" className="h-full w-full object-contain" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Federal Sponsor
              </p>
              <p className="whitespace-nowrap text-xs font-semibold leading-tight text-white">
                U.S. Department of Energy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom line */}
      <div className="h-1 w-full bg-gold" />
    </header>
  );
}
