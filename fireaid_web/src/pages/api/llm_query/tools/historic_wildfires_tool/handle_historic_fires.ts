// TO-DO: This should probably move to lib so we dont have api endpoints for all tool definitions
import { getDb } from '../../../../../lib/mongo'

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function query_fire_points(
    yr_start: number | null = null,
    yr_end: number | null = null,
    prescr: string | null = null,
    lim: number | null = null,
    name: string | null = null,
) {
    const db = await getDb();
    const query: Record<string, unknown> = {
        "FIRESEASON": {
            $gte: yr_start ? yr_start : 0,
            $lte: yr_end ? yr_end : 9999,
        },
    };
    // Looking a fire up by name should find it whether or not it was prescribed.
    if (prescr || !name) query["PRESCRIBEDFIRE"] = prescr ? prescr : "N";
    if (name && name.trim()) query["NAME"] = { $regex: escapeRegex(name.trim()), $options: "i" };

    // Largest first, so a truncated list still holds the fires that matter most.
    const result = await db.collection("fire_points").find(query).sort({ ESTIMATEDTOTALACRES: -1 }).toArray();

    const trimmed_res = result.slice(0, lim ? lim : 5000)
    return { "ok": true, "total": result.length, "count": trimmed_res.length, "results": trimmed_res }
}
