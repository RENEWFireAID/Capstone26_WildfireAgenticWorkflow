import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from '../../lib/mongo'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
  try {
    const db = await getDb();
    const result = await db.collection("terms").find({}).toArray();

    res.status(200).json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving terms" });
  }
}