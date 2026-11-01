"use client";
import { FileText, Download } from "lucide-react";
import FireAIDSidebar from "@/components/layout/FireAIDSidebar";

const FILES = [
  { name: "AK Fire Location Points (NAD83)", filename: "AK_fire_location_points_NAD83.txt", size: "17 MB" },
  { name: "Alaska Fire History Metadata", filename: "AlaskaFireHistory_LocationPoints_FGDG_metadata.xml", size: "37 KB" },
];

export default function FireHistoryPage() {
  return (
    <div className="flex w-full min-h-screen">
      <FireAIDSidebar />
      <main className="flex-1 flex flex-col">
        <div className="bg-slate-50 px-12 py-10 border-b border-slate-200">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">FireAID · Data</p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Historical Records</h1>
          <p className="text-slate-400 text-sm mt-1">Alaska historical fire location data</p>
        </div>
        <div className="flex-1 bg-slate-50 px-12 py-10">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-6">Available Dataset</p>
          <div className="flex flex-col gap-4 max-w-2xl">
            {FILES.map((file) => (
              <a
                key={file.filename}
                href={"/downloads/" + file.filename}
                download
                className="group flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={26} className="text-orange-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{file.name}</div>
                    <div className="text-slate-400 text-sm mt-0.5">{file.filename} · {file.size}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[#003366] font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Download size={16} />
                  Download
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
