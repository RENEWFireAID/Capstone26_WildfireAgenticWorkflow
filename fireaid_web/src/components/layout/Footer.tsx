import { Flame } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-navy text-white">
      {/* Main grid */}
      <div className="mx-auto max-w-7xl px-6 py-12 grid grid-cols-1 gap-10 md:grid-cols-3">
        {/* Left */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-gold/70">
              <Flame size={18} className="text-gold" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold tracking-wide text-gold">UAF Data/AI Lab</div>
              <div className="text-lg font-semibold text-white">FireAID</div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            University of Alaska Fairbanks<br />
            1731 South Chandalar Dr.<br />
            Fairbanks, AK 99775<br />
            907-474-7034 <span className="text-xs">(general info)</span><br />
            1-800-478-1823 <span className="text-xs">(admissions)</span>
          </p>
        </div>

        {/* Center */}
        <div>
          <div className="text-base font-bold text-gold mb-4">Contact us</div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li><a href="https://www.uaf.edu/uaf/contact/index.php" className="hover:text-gold transition">Contact information</a></li>
            <li><a href="https://uafalert.alaska.edu/" className="hover:text-gold transition">Emergency information</a></li>
            <li><a href="https://www.uaf.edu/titleix/index.php" className="hover:text-gold transition">Title IX &amp; confidential reporting</a></li>
            <li><a href="https://www.uaf.edu/uaf/help/index.php" className="hover:text-gold transition">Website help</a></li>
          </ul>
        </div>

        {/* Right */}
        <div>
          <div className="text-base font-bold text-gold mb-4">Find out more</div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li><a href="https://www.uaf.edu/about/" className="hover:text-gold transition">About</a></li>
            <li><a href="https://www.uaf.edu/academics/" className="hover:text-gold transition">Academics</a></li>
            <li><a href="https://www.uaf.edu/admissions/" className="hover:text-gold transition">Admissions</a> &amp; <a href="https://www.uaf.edu/finaid/" className="hover:text-gold transition">financial aid</a></li>
            <li><a href="https://www.uaf.edu/athletics/" className="hover:text-gold transition">Athletics</a></li>
            <li><a href="https://www.uaf.edu/indigenous/" className="hover:text-gold transition">Indigenous programs</a></li>
            <li><a href="https://www.uaf.edu/research/" className="hover:text-gold transition">Research</a></li>
            <li><a href="https://www.uaf.edu/giving/" className="hover:text-gold transition">Giving</a></li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Social + hashtag */}
      <div className="flex flex-col items-center gap-2 py-6">
        <div className="flex gap-5 text-slate-300 text-sm">
          <a href="https://www.facebook.com/uafairbanks" className="hover:text-gold transition">Facebook</a>
          <a href="https://www.instagram.com/uafairbanks" className="hover:text-gold transition">Instagram</a>
          <a href="https://www.tiktok.com/@uafairbanks" className="hover:text-gold transition">TikTok</a>
          <a href="https://twitter.com/uafairbanks" className="hover:text-gold transition">X</a>
        </div>
        <div className="text-xs text-slate-400">#NanookNation</div>
      </div>

      {/* Legal */}
      <div className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-400 leading-relaxed">
        <p>
          The <a href="https://www.alaska.edu/" className="text-gold hover:underline">University of Alaska</a> is an equal opportunity/equal access employer and educational institution.
          The university is committed to a <a href="https://www.alaska.edu/nondiscrimination/" className="text-gold hover:underline">policy of nondiscrimination</a> against individuals on the basis of any legally protected status.
        </p>
        <p className="mt-1">
          UA is committed to providing accessible websites. Learn more about UA&apos;s{" "}
          <a href="https://www.alaska.edu/webaccessibility/" className="text-gold hover:underline">notice of web accessibility</a>.{" "}
          <a href="https://www.alaska.edu/privacy/" className="text-gold hover:underline">Privacy Statement</a>
        </p>
        <p className="mt-2">
          For questions or comments regarding this page, contact{" "}
          <a href="mailto:uaf-web@alaska.edu" className="text-gold hover:underline">uaf-web@alaska.edu</a> | © UA
        </p>
      </div>
    </footer>
  );
}
