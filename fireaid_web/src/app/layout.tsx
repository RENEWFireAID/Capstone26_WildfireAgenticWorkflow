import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import Topbar from "@/components/topbar/Topbar";
import "leaflet/dist/leaflet.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FireAID Web",
  description: "FireAID – UAF Wildfire Lab interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className + " bg-slate-50"}>
        <Topbar />

        {/* 主内容区域：不再在这里做 max-w 居中！ */}
        <div className="flex min-h-[calc(100vh-3.5rem)]">{children}</div>
      </body>
    </html>
  );
}
