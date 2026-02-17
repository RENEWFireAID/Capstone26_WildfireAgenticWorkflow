import type { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {

    if(!process.env.OPENROUTER_API_KEY) {
        res.status(500).json({error: "Missing API key"})
    }

    const {msg: text} = req.body

    const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    });

    const completion = await openai.chat.completions.create({
    model: 'google/gemini-3-flash-preview',
    messages: [
        {
        role: 'user',
        content: text,
        },
    ],
    });

    res.status(200).json({msg: completion.choices[0].message.content})
}

