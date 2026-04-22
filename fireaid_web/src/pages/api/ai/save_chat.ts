import type { NextApiRequest, NextApiResponse } from "next";
// Updated path: Added an extra '../' to go up from the 'ai' folder
import { getDb } from '../../../lib/mongo';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    // Validate that we have an array of messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "A non-empty messages array is required" });
    }

    const db = await getDb();
    
    // Insert the chat instance as a new document
    const result = await db.collection("chatlogs").insertOne({
      savedAt: new Date(), 
      messages: messages,  // Saves the entire chat as an array
    });

    res.status(201).json({
      message: "Chat saved successfully",
      data: {
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Error saving chat:", error);
    res.status(500).json({ message: "Error saving chatlog to database" });
  }
}