import { OpenAI } from "openai";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, ResponseFunctionToolCall, Tool } from "openai/resources/responses/responses.mjs";
import { query_tools, make_tool_calls } from "../tools/tool_management";


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    console.log("Starting LLM query in query.ts ...");

    if (!process.env.OPENROUTER_API_KEY) {
        res.status(500).json({ error: "Missing API key" })
    }

    const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    // Format user input
    const { msg: text } = req.body
    const input = [
        { role: "system", content: "You are a wildfire intelligence assistant. When answering questions regarding fire risks, history, mitigation, or research, you MUST ALWAYS use the retrieve_rag_context tool to look up information from the literature database before answering. Delay responding until you have retrieved context." },
        {
            role: "user",
            content: text,
        },
    ] as unknown as ResponseInput;

    const all_tools = [...query_tools];
    var query_count = 1;

    try {
        // Send initial prompt with tools
        var response = await openai.responses.create({
            model: "openai/gpt-4o-mini",
            tools: all_tools,
            input,
            tool_choice: "auto",
        });

        // Add initial message as context to input for subsequent queries
        var new_input = [] as ResponseInput;
        new_input.push(input[0]);

        var found_term_tool_call = false;

        // Loop over response output and make queries while tool calls are needed.
        do {
            query_count += 1
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
                    model: "openai/gpt-4o",
                    instructions: "Respond using information retrieved from tool(s). YOU MUST CITE YOUR SOURCES AND INDICATE whether you have included information from a tool. Any information from a rag_tool_context must be MLA CITED. ALSO AT THE END OF EACH MESSAGE, PROVIDE A SOURCES LIST INCLUDING AN MLA CITED REFERENCE OF ALL INFORMATION AUTHOR, TITLE, ETC",
                    previous_response_id: response.id,
                    input: new_input,
                    tools: all_tools,
                });
            }

        } while (found_term_tool_call);

        res.status(200).json({ msg: response.output_text });

    } catch (e: any) {
        console.log("Error with query", query_count);
        console.log(e.error);
        console.log(e);
    }
}
