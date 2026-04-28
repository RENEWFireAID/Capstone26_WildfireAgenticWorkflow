// TO-DO: This should probably move to lib so we dont have api endpoints for all tool definitions
import { getDb } from '../../../../../lib/mongo'

export async function query_fire_points(
    yr_start: Number | null = null,
    yr_end: Number | null = null,
    prescr: String | null = null,
    lim: Number | null = null,
) {
    const db = await getDb();
    const yr_filter = {}
    const query = {
        "FIRESEASON": { 
            $gte: yr_start ? yr_start : 0,
            $lte: yr_end ? yr_end : 9999,
        },
        "PRESCRIBEDFIRE": prescr ? prescr : "N",
    };

    const result = await db.collection("fire_points").find(query).toArray();

    const trimmed_res = result.slice(0, lim ? lim : 5000)
    return { "ok": true, "total": result.length, "count": trimmed_res.length, "results": trimmed_res }
}