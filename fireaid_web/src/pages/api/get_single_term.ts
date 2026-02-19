import { getDb } from '../../lib/mongo'

export async function getSingleTerm(term: String) {
    try {
        const db = await getDb();
        const result = await db.collection("terms").find({"term": term}).toArray();
        console.log(`In get_single_term(${term}), got: `);
        console.log(result);
        console.log(`Returning: ${result[0].def}`);
        return result[0].def;

    } catch (error) {
        console.error(error);
        return "None Found";
    }
}