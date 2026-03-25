"use client";
import { usePathname } from "next/navigation";
import Topbar from "@/components/topbar/Topbar";

const HIDE_TOPBAR = ["/portal", "/apps", "/data", "/prompt"];

export default function ConditionalTopbar() {
  const pathname = usePathname();
  const hide = HIDE_TOPBAR.some((p) => pathname?.startsWith(p));
  if (hide) return null;
  return <Topbar />;
}
