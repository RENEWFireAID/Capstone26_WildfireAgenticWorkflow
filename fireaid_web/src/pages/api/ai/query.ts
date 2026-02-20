import { OpenAI } from "openai";
import { getSingleTerm } from "../get_single_term";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, Tool } from "openai/resources/responses/responses.mjs";

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
    console.log("Starting LLM query in query.ts ...");

    if(!process.env.OPENROUTER_API_KEY) {
        res.status(500).json({error: "Missing API key"})
    }

    const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    // User input
    const {msg: text} = req.body
    const input = [
        {
            role: "user",
            content: text,
        },
    ] as ResponseInput;

    // Send prompt with tools
    try {
        const response = await openai.responses.create({
            model: "gpt-5",
            tools,
            input,
            tool_choice: "auto",
        });

        var follow_up = [] as ResponseInput;
        follow_up.push(input[0]);

        console.log("Iterating over response output:")
        var found_term_tool_call = false;
        for (const item of response.output) {
            console.log(item);
            console.log();

            if (item.type == "function_call") {
                if(item.name == "get_wildfire_term") {
                    found_term_tool_call = true;
                    const def = await getWildfireTerm(JSON.parse(item.arguments).term)
                    follow_up.push(item);

                    follow_up.push({
                        type: "function_call_output",
                        call_id: item.call_id,
                        output: def
                    });
                }
            }
        };

        // Make second query to integrate tool response.
        if (found_term_tool_call) {
            console.log();
            console.log("NEW input for Query 2");
            console.log(follow_up);
            console.log();

            try {
                const response2 = await openai.responses.create({
                    model: "gpt-5",
                    instructions: "Respond using information retrieved from a tool. Indicate whether you have included information from a tool. Do not make anymore tool calls.",
                    previous_response_id: response.id,
                    input: follow_up,
                    tools,
                });

                for (const item of response2.output) {
                    console.log(item);
                    console.log();
                }

                res.status(200).json({msg: response2.output_text});
            } catch (e: any) {
                console.log("Error with second query");
                console.log(e.error);
            }

        // If no tool call, return regular query response.
        } else {
            res.status(200).json({msg: response.output_text});
        }

    } catch (e:any) {
        console.log("Error with first query");
        console.log(e.error);
        console.log(e);
    }
}
