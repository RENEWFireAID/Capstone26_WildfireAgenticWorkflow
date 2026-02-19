import { OpenAI } from "openai";
import { getSingleTerm } from "../get_single_term";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, Tool } from "openai/resources/responses/responses.mjs";

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

const termTool =
    {
        type: "function",
        name: "get_wildfire_term",
        description: "Get the definition of a term related to wildires.",
        parameters: {
            type: "object",
            properties: {
                term: {
                    type: "string",
                    description: "A term related to wildfires like fuel or prescribed fire",
                },
            },
            required: ["term"],
        },
    };

const tools = [termTool as Tool];

async function getWildfireTerm(term: string) {
    
    return getSingleTerm(term);
}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    console.log("Starting LLM query in term_query.js ...");

    if(!process.env.OPENROUTER_API_KEY) {
        res.status(500).json({error: "Missing API key"})
    }

    // User input
    const {msg: text} = req.body
    const input = [
        { role: "user", content: text },
    ] as ResponseInput;

    // Send prompt with tools
    const response = await openai.responses.create({
        model: "gpt-5",
        tools,
        input
    });

    console.log("Iterating over response output:")
    for (const item of response.output) {
        console.log(item);
        console.log();

        if (item.type == "function_call") {
            if(item.name == "get_wildfire_term") {
                const def = await getWildfireTerm(JSON.parse(item.arguments).term)

                res.status(200).json({msg: `Definition found: ${def}`});
            }
        }
    };

    res.status(200).json({msg: `LLM Response: ${response.output_text}`});
}
