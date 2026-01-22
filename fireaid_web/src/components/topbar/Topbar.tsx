"use client";

export default function Topbar() {
  return (
    <header className="border-b border-slate-200 bg-[#003366]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        {/* 左侧 Logo + 文案 */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-2 ring-[#FFCC33]">
            <span className="text-xl font-bold text-[#FFCC33]">🔥</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wide text-[#FFCC33]">
              UAF Wildfire Lab
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              FireGPT
            </span>
          </div>
        </div>

        {/* 中间导航 */}
        <nav className="hidden items-center gap-5 text-xs font-medium text-slate-100 md:flex">
          {["Terminology", "Data", "Tools", "Apps", "Visualization", "Chat"].map(
            (item) => (
              <button
                key={item}
                className="border-b-2 border-transparent pb-1 transition hover:border-[#FFCC33] hover:text-white"
              >
                {item}
              </button>
            )
          )}
        </nav>

        {/* 右侧：搜索 + 上传 + 用户头像 */}
        <div className="flex items-center gap-3">
          <button className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-100 backdrop-blur hover:bg-white/15 md:flex">
            <span className="material-symbols-rounded text-base">search</span>
            <span>Search</span>
          </button>
          <button className="rounded-full bg-[#FFCC33] px-3 py-1 text-[11px] font-semibold text-[#003366] shadow hover:bg-amber-300">
            Upload data
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs font-semibold text-[#003366]">
            IS
          </div>
        </div>
      </div>

      {/* 底部金线 */}
      <div className="h-1 w-full bg-[#FFCC33]" />
    </header>
  );
}
