import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import Topbar from "@/components/topbar/Topbar";

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
        {/* 顶部 UAF 蓝金风格 Topbar */}
        <Topbar />

        {/* 主内容区域：居中 + 最大宽度 */}
        <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl px-4 py-4 md:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}
