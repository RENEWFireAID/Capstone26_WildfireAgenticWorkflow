import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { csvResponse } from "@/lib/csvStream";

// The original column names, so a download reads like the source files.
const HEADER = ["Date", "Longitude", "Latitude", "Elevation", "Max Temperature", "Min Temperature",
  "Precipitation", "Wind", "Relative Humidity", "Solar"];

/**
 * GET                -> the grid points (loaded by FireMCP/scripts/import_weather.py)
 * GET ?station=ID    -> that point's daily record as CSV
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const db = await getDb();
    const station = url.searchParams.get("station");

    if (station != null) {
      if (!/^\d{3}-\d{4}$/.test(station)) {
        return NextResponse.json({ error: "station must look like 682-1478" }, { status: 400 });
      }
      const s = await db.collection("weather_stations").findOne({ _id: station as any });
      if (!s) return NextResponse.json({ error: `No grid point ${station}` }, { status: 404 });
      const cursor = db.collection("weather_daily")
        .find({ station }, { projection: { _id: 0, station: 0 } })
        .sort({ date: 1 });
      return csvResponse(`weatherdata-${station}.csv`, HEADER, cursor, (d: any) => [
        d.date, s.lon, s.lat, s.elevation_m, d.tmax_c, d.tmin_c, d.precip_mm, d.wind_ms, d.rh_frac, d.solar_mj_m2,
      ]);
    }

    const stations = await db.collection("weather_stations").find({}).sort({ lat: -1, lon: 1 }).toArray();
    return NextResponse.json({
      stations: stations.map((s) => ({
        id: s._id,
        lat: s.lat,
        lon: s.lon,
        elevation_m: s.elevation_m,
        first_date: s.first_date,
        last_date: s.last_date,
        days: s.days,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
