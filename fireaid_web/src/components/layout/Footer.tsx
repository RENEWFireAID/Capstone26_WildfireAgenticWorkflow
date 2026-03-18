import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#003366] text-white">
      {/* Main grid */}
      <div className="mx-auto max-w-7xl px-6 py-12 grid grid-cols-1 gap-10 md:grid-cols-3">
        {/* Left */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-2 ring-[#FFCC33]">
              <span className="text-xl font-bold text-[#FFCC33]">🔥</span>
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold tracking-wide text-[#FFCC33]">UAF Data/AI Lab</div>
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
          <div className="text-base font-bold text-[#FFCC33] mb-4">Contact us</div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li><a href="https://www.uaf.edu/uaf/contact/index.php" className="hover:text-[#FFCC33] transition">Contact information</a></li>
            <li><a href="https://uafalert.alaska.edu/" className="hover:text-[#FFCC33] transition">Emergency information</a></li>
            <li><a href="https://www.uaf.edu/titleix/index.php" className="hover:text-[#FFCC33] transition">Title IX &amp; confidential reporting</a></li>
            <li><a href="https://www.uaf.edu/uaf/help/index.php" className="hover:text-[#FFCC33] transition">Website help</a></li>
          </ul>
        </div>

        {/* Right */}
        <div>
          <div className="text-base font-bold text-[#FFCC33] mb-4">Find out more</div>
          <ul className="space-y-2 text-sm text-slate-300">
            <li><a href="https://www.uaf.edu/about/" className="hover:text-[#FFCC33] transition">About</a></li>
            <li><a href="https://www.uaf.edu/academics/" className="hover:text-[#FFCC33] transition">Academics</a></li>
            <li><a href="https://www.uaf.edu/admissions/" className="hover:text-[#FFCC33] transition">Admissions</a> &amp; <a href="https://www.uaf.edu/finaid/" className="hover:text-[#FFCC33] transition">financial aid</a></li>
            <li><a href="https://www.uaf.edu/athletics/" className="hover:text-[#FFCC33] transition">Athletics</a></li>
            <li><a href="https://www.uaf.edu/indigenous/" className="hover:text-[#FFCC33] transition">Indigenous programs</a></li>
            <li><a href="https://www.uaf.edu/research/" className="hover:text-[#FFCC33] transition">Research</a></li>
            <li><a href="https://www.uaf.edu/giving/" className="hover:text-[#FFCC33] transition">Giving</a></li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Social + hashtag */}
      <div className="flex flex-col items-center gap-2 py-6">
        <div className="flex gap-5 text-slate-300 text-sm">
          <a href="https://www.facebook.com/uafairbanks" className="hover:text-[#FFCC33] transition">Facebook</a>
          <a href="https://www.instagram.com/uafairbanks" className="hover:text-[#FFCC33] transition">Instagram</a>
          <a href="https://www.tiktok.com/@uafairbanks" className="hover:text-[#FFCC33] transition">TikTok</a>
          <a href="https://twitter.com/uafairbanks" className="hover:text-[#FFCC33] transition">X</a>
        </div>
        <div className="text-xs text-slate-400">#NanookNation</div>
      </div>

      {/* Legal */}
      <div className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-400 leading-relaxed">
        <p>
          The <a href="https://www.alaska.edu/" className="text-[#FFCC33] hover:underline">University of Alaska</a> is an equal opportunity/equal access employer and educational institution.
          The university is committed to a <a href="https://www.alaska.edu/nondiscrimination/" className="text-[#FFCC33] hover:underline">policy of nondiscrimination</a> against individuals on the basis of any legally protected status.
        </p>
        <p className="mt-1">
          UA is committed to providing accessible websites. Learn more about UA&apos;s{" "}
          <a href="https://www.alaska.edu/webaccessibility/" className="text-[#FFCC33] hover:underline">notice of web accessibility</a>.{" "}
          <a href="https://www.alaska.edu/privacy/" className="text-[#FFCC33] hover:underline">Privacy Statement</a>
        </p>
        <p className="mt-2">
          For questions or comments regarding this page, contact{" "}
          <a href="mailto:uaf-web@alaska.edu" className="text-[#FFCC33] hover:underline">uaf-web@alaska.edu</a> | © UA
        </p>
      </div>
    </footer>
  );
}
