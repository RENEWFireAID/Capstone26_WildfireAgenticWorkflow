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

    const completion = await openai.responses.create({
        model: 'google/gemini-3-flash-preview',
        tools: [
            {
                type: "mcp",
                server_label: "fire_terms",
                server_description: "A MongoDB database MCP server to provide wildire terminology",
                server_url: process.env.TERMS_MCP_URL,
                require_approval: "never"
            },
        ],
        input: text,
    });

    console.log("COMPLETION RESULT:");
    console.log(completion);

    res.status(200).json({msg: completion.output_text})
}

