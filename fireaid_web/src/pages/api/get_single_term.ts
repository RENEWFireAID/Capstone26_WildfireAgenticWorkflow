import { getDb } from '../../lib/mongo'

export async function getSingleTerm(term: String) {
    try {
        const db = await getDb();
        const result = await db.collection("terms").find({"term": { $regex: "^"+term+"$", $options: "i"}}).toArray();
        if (result.length > 0) {
            console.log(`In get_single_term(${term}), got: `);
            console.log(result);
            console.log(`Returning: ${result[0].def}`);
            return result[0].def;
        } else {
            console.log(`In get_single_term(${term}), got nothing`);
            return "No term found";
        }

    } catch (error) {
        console.error(error);
        return "None Found";
    }
}