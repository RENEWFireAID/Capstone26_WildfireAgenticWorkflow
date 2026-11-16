import type { Metadata } from "next";
import "./globals.css";
import { Barlow, Barlow_Condensed, Zilla_Slab } from "next/font/google";
import ConditionalTopbar from "@/components/layout/ConditionalTopbar";
import ConditionalFooter from "@/components/layout/ConditionalFooter";
import "leaflet/dist/leaflet.css";

// uaf.edu's type: Barlow for text and Zilla Slab for headings, both from Google
// Fonts as uaf.edu loads them. Its labels and buttons use Dharma Gothic, an Adobe
// font that needs a licence, so Barlow Condensed stands in for it.
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow-condensed" });
const zillaSlab = Zilla_Slab({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-zilla-slab" });

export const metadata: Metadata = {
  title: "FireAID · UAF Data/AI Lab",
  description: "Alaska wildfire intelligence from the UAF Data/AI Lab: fire history, risk forecasts, research literature and an AI assistant over them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variables go on <html> because the theme reads them at :root.
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${zillaSlab.variable}`}>
      <body className="font-sans antialiased">
        <ConditionalTopbar />
        <div className="w-screen flex min-h-[calc(100vh-3.5rem)]">{children}</div>
        <ConditionalFooter />
      </body>
    </html>
  );
}
