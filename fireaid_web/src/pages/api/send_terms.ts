import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from '../../lib/mongo'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const debug = process.env.ALLOW_INSERT?.toLowerCase() === "false" ? false : true
  if (!debug) {
    res.status(403).json({message: "Inserting new terms not allowed"})
    return
  }

  try {
    const terms = req.body;

    const db = await getDb();
    const result = await db.collection("terms").insertMany(terms);

    res.status(201).json({
      message: "Record created successfully",
      insertedCount: result.insertedCount,
      insertedIds: result.insertedIds,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating records" });
  }
}
