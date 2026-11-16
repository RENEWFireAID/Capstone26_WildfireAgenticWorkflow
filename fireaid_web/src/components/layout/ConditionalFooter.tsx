"use client";
import { usePathname } from "next/navigation";
import Footer from "@/components/layout/Footer";

// Every page ends on the footer except the chat, which fills the window with
// the conversation and keeps its input pinned to the bottom, and the admin tool.
const HIDE_FOOTER = ["/portal", "/admin"];

export default function ConditionalFooter() {
  const pathname = usePathname();
  const hide = HIDE_FOOTER.some((p) => pathname?.startsWith(p));
  if (hide) return null;
  return <Footer />;
}
