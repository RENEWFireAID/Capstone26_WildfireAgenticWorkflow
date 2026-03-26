import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import ConditionalTopbar from "@/components/layout/ConditionalTopbar";
import ConditionalFooter from "@/components/layout/ConditionalFooter";
import "leaflet/dist/leaflet.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FireAID Web",
  description: "FireAID – UAF Wildfire Lab interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className + " bg-slate-50"}>
        <ConditionalTopbar />
        <div className="w-screen flex min-h-[calc(100vh-3.5rem)]">{children}</div>
        <ConditionalFooter />
      </body>
    </html>
  );
}
