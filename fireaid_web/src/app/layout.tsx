import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import ConditionalTopbar from "@/components/layout/ConditionalTopbar";
import ConditionalFooter from "@/components/layout/ConditionalFooter";
import "leaflet/dist/leaflet.css";

// Public Sans is the U.S. Web Design System typeface; Plex Mono sets data readouts.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "FireAID · UAF Data/AI Lab",
  description: "Alaska wildfire intelligence from the UAF Data/AI Lab: fire history, risk forecasts, research literature and an AI assistant over them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} ${plexMono.variable} font-sans antialiased`}>
        <ConditionalTopbar />
        <div className="w-screen flex min-h-[calc(100vh-3.5rem)]">{children}</div>
        <ConditionalFooter />
      </body>
    </html>
  );
}
