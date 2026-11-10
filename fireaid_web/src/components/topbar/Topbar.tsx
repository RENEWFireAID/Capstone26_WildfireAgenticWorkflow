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
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-4 py-3 md:px-6 xl:grid-cols-[320px_minmax(0,1fr)_430px]">
        {/* Left: UAF Logo + FireAID */}
        <div className="flex items-center gap-4">
        <Image
            src={uafLogo}
            alt="UAF Logo"
            priority
            width={180}
            height={88}
          className="h-22 w-auto shrink-0 object-contain"
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
        <nav className="hidden items-center justify-center gap-7 text-sm font-semibold md:flex">
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
        <div className="flex items-center justify-start gap-6 xl:justify-end">
          <div className="hidden h-8 w-px bg-white/20 xl:block" />

          <div className="flex items-center gap-2">
            <Image
              src={argonneLogo}
              alt="Argonne National Laboratory"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
            />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Partner Lab
              </p>
              <p className="text-xs font-semibold leading-tight text-white">
                Argonne National Laboratory
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <Image
              src={doeLogo}
              alt="Department of Energy"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-contain"
            />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Federal Sponsor
              </p>
              <p className="text-xs font-semibold leading-tight text-white">
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
