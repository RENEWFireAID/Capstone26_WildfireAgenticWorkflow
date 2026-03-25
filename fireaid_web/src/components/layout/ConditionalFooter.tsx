"use client";
import { usePathname } from "next/navigation";
import Footer from "@/components/layout/Footer";

const HIDE_FOOTER = ["/portal", "/apps", "/data", "/prompt"];

export default function ConditionalFooter() {
  const pathname = usePathname();
  const hide = HIDE_FOOTER.some((p) => pathname?.startsWith(p));
  if (hide) return null;
  return <Footer />;
}
