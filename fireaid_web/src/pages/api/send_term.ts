import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from '../../lib/mongo'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { term, def } = req.body;

    if (!term) {
      return res.status(400).json({ message: "term is required" });
    }

    if (!def) {
      return res.status(400).json({message: "definition is required" });
    }

    const db = await getDb();
    const result = await db.collection("terms").insertOne({
      term,
      def,
    });

    res.status(201).json({
      message: "Record created successfully",
      data: {
        _id: result.insertedId,
        term,
        def,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating record" });
  }
}