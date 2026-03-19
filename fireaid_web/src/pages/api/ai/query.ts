import { OpenAI } from "openai";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, ResponseFunctionToolCall } from "openai/resources/responses/responses.mjs";
import { query_tools, make_tool_calls } from "../tools/tool_management";


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

    // Format user input
    const {msg: text} = req.body
    const input = [
        {
            role: "user",
            content: text,
        },
    ] as ResponseInput;

    try {
        // Send initial prompt with tools
        var response = await openai.responses.create({
            model: "gpt-5",
            tools: query_tools,
            input,
            tool_choice: "auto",
        });

        // Add initial message as context to input for subsequent queries
        var new_input = [] as ResponseInput;
        new_input.push(input[0]);

        var found_term_tool_call = false;

        // Loop over response output and make queries while tool calls are needed.
        do {
            var tool_requests: ResponseFunctionToolCall[] = [];
            found_term_tool_call = false;

            console.log("Iterating over response output:")
            for (const item of response.output) {
                console.log(item);
                console.log();

                if (item.type == "function_call") {
                    found_term_tool_call = true;
                    tool_requests.push(item);
                }
            };

            // Make new query with results from tool calling if necessary
            if (found_term_tool_call) {

                const tool_output = await make_tool_calls(tool_requests);
                new_input.push(...tool_output);

                response = await openai.responses.create({
                    model: "gpt-5",
                    instructions: "Respond using information retrieved from a tool. Indicate whether you have included information from a tool.",
                    previous_response_id: response.id,
                    input: new_input,
                    tools: query_tools,
                });
            }
            
        } while (found_term_tool_call);

        res.status(200).json({msg: response.output_text});

    } catch (e:any) {
        console.log("Error with first query");
        console.log(e.error);
        console.log(e);
    }
}
