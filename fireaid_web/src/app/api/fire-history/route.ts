import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import { csvResponse } from "@/lib/csvStream";

// The source columns of the BLM AFS Alaska Fire Location Points, in the
// order the FGDC metadata lists them, then the few the metadata omits. The
// lowercase copies FireAID adds (year, lat, lon, name, prescribed, acres) are
// left out so the export matches the published dataset.
const FIRE_COLUMNS = [
  "ID", "RECORDNUMBER", "NAME", "FIRESEASON", "LASTUPDATETIME", "MGMTORGID", "MGMTOFFICEID", "MGMTOPTIONID",
  "PRESCRIBEDFIRE", "FALSEALARM", "LATITUDE", "LONGITUDE", "MAPNAME", "MAPNUMBER", "NEARESTWEATHERSTA",
  "ORIGINOWNERID", "OWNERKIND", "ORIGINADMINUNITID", "DISCOVERYDATETIME", "DISCOVERYSIZE", "IADATETIME", "IASIZE",
  "INITIALBEHAVIOR", "CONTROLDATETIME", "OUTDATE", "ESTIMATEDTOTALACRES", "ACTUALTOTALACRES", "ESTIMATEDTOTALCOST",
  "FIRECAUSE", "GENERALCAUSE", "SPECIFICCAUSE", "ORIGINSLOPE", "ORIGINASPECT", "ORIGINELEVATION", "ORIGINTOWNSHIP",
  "ORIGINRANGE", "ORIGINSECTION", "ORIGINQUARTER", "ORIGINMERIDIAN", "STRUCTURESTHREATENED", "STRUCTURESBURNED",
  "PRIMARYFUELTYPE", "AFSNUMBER", "DOFNUMBER", "USFSNUMBER", "ADDITIONALNUMBER", "FORCESITRPT", "COMPLEX",
  "IMPORT_NOTES", "WFUFIRE", "REPORTRECEIVEDDATE", "ISCOMPLEX", "CARRYOVER", "STATEADSID", "ORIGINAL_LATITUDE",
  "ORIGINAL_LONGITUDE", "IRWINID", "ISVALID", "SUPPRESSIONSTRATEGY", "FIREMGMTCOMPLEXITY", "ADSPERMISSIONSTATE",
  "FIRECODEREQUESTED", "ISREIMBURSABLE", "ISFSASSISTED", "ISTRESPASS", "FIRECODENOTES", "CONTAINMENTDATETIME",
  "CONFLICTIRWINID", "COMPLEXPARENTIRWINID", "MERGEDINTO", "MERGEDDATE", "MERGED_REL_IRWINIRID",
  "COMPLEX_REL_IRWINIRID", "ISQUARANTINED", "FIRESEASONS", "CERTIFIED_IN_INFORM", "WCE_INCIDENTID",
  "MGMTOPTION_PROTDATE",
];

function yearRange(url: URL) {
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  const range: Record<string, number> = {};
  if (url.searchParams.has("from") && Number.isInteger(from)) range.$gte = from;
  if (url.searchParams.has("to") && Number.isInteger(to)) range.$lte = to;
  // Two records are broken imports: a quote in a fire name ("4" Corners,
  // "40" Fire) made the original CSV parse swallow ~2,000 following rows into
  // their name field, leaving the year as text. Numeric years skip them.
  return { year: { $type: "number", ...range } };
}

/**
 * GET                      -> summary of the collection (records, years, acres)
 * GET ?download=1&from&to  -> the records as CSV, optionally for a range of years
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const db = await getDb();
    const col = db.collection("fire_points");
    const filter = yearRange(url);

    if (url.searchParams.get("download")) {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const name = from || to ? `alaska_fire_points_${from ?? "start"}-${to ?? "end"}.csv` : "alaska_fire_points.csv";
      const projection = Object.fromEntries(FIRE_COLUMNS.map((c) => [c, 1]));
      const cursor = col.find(filter, { projection: { _id: 0, ...projection } }).sort({ year: 1, ID: 1 });
      return csvResponse(name, FIRE_COLUMNS, cursor, (d: any) => FIRE_COLUMNS.map((c) => d[c]));
    }

    const [records, [s]] = await Promise.all([
      col.countDocuments(filter),
      col.aggregate([
        { $match: filter },
        { $group: { _id: null, first: { $min: "$year" }, last: { $max: "$year" }, acres: { $sum: "$acres" } } },
      ]).toArray(),
    ]);
    return NextResponse.json({
      records,
      firstYear: s?.first ?? null,
      lastYear: s?.last ?? null,
      totalAcres: s?.acres ?? 0,
      columns: FIRE_COLUMNS.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
