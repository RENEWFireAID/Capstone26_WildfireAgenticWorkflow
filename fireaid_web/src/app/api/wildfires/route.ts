// src/app/api/wildfires/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // docker/Node runtime, not edge

const INCIDENTS_LAYER =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/" +
  "WFIGS_Incident_Locations_Current/FeatureServer/0";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function escSqlLike(s: string) {
  // ArcGIS where clause: escape single quotes
  return s.replace(/'/g, "''");
}

function toISO(ms?: number | null) {
  if (!ms || typeof ms !== "number") return null;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const keyword = url.searchParams.get("keyword")?.trim() || "";
    const state = url.searchParams.get("state")?.trim().toUpperCase() || "";
    const limitRaw = url.searchParams.get("limit") || "10";
    const limit = clamp(parseInt(limitRaw, 10) || 10, 1, 50);

    const clauses: string[] = ["1=1"];

    if (keyword) {
      const kw = escSqlLike(keyword);
      // IMPORTANT: incident names are often ALL CAPS (e.g., "CARTER")
      clauses.push(`IncidentName LIKE '%${kw}%'`);
    }
    if (state) {
      // Dataset returns values like "US-CA", "US-AK"
      const st = escSqlLike(state);
      clauses.push(`POOState = 'US-${st}'`);
    }

    const where = clauses.join(" AND ");

    const outFields = [
      "IncidentName",
      "POOState",
      "IncidentTypeCategory",
      "IncidentSize",
      "PercentContained",
      "ModifiedOnDateTime",
      "POOCounty",
      "FireDiscoveryDateTime",
    ].join(",");

    const queryURL = `${INCIDENTS_LAYER}/query?` + new URLSearchParams({
      f: "json",
      where,
      outFields,
      returnGeometry: "false",
      resultRecordCount: String(limit),
      // ArcGIS uses "orderByFields" (your earlier typo caused 400)
      orderByFields: "FireDiscoveryDateTime DESC",
    });

    const r = await fetch(queryURL, {
      headers: { "User-Agent": "FireGPT/1.0" },
      cache: "no-store",
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: "ArcGIS request failed", status: r.status, detail: text },
        { status: 500 }
      );
    }

    const data = await r.json();
    if (data?.error) {
      return NextResponse.json(
        { error: "ArcGIS error", detail: data.error },
        { status: 500 }
      );
    }

    const feats = Array.isArray(data?.features) ? data.features : [];
    const result = feats.map((f: any) => {
      const a = f?.attributes || {};
      return {
        name: a.IncidentName ?? null,
        state: a.POOState ?? null,
        type: a.IncidentTypeCategory ?? null,
        size: a.IncidentSize ?? null,
        percent_contained: a.PercentContained ?? null,
        county: a.POOCounty ?? null,
        discovered: toISO(a.FireDiscoveryDateTime),
        last_updated: toISO(a.ModifiedOnDateTime),
      };
    });

    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
