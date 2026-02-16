import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "../../lib/mongo"; // MongoDB connection

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  try {
    // Get the chat data from the request body
    const { chats } = req.body;

    // Connect to MongoDB
    const db = await getDb();

    // Insert chat logs into the 'chats' collection
    const collection = db.collection("chats");
    const result = await collection.insertMany(chats); // Insert the chats into the database

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error saving chat:", error);
    return res.status(500).json({ error: "Failed to save chat" });
  }
}
