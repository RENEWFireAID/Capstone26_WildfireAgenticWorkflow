import { OpenAI } from "openai";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, ResponseFunctionToolCall, Tool } from "openai/resources/responses/responses.mjs";
import { query_tools, make_tool_calls } from "./tools/tool_management";

type Message = { role: "user" | "ai"; content: string; time: string };

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
    const {msgs: historyMsgs} = req.body

    console.log();
    console.log("HISTORYMSGS");
    console.log(historyMsgs);
    console.log();

    const historyInput = historyMsgs.map((msg: Message) => ({
        role: msg.role == "ai" ? "assistant" : msg.role,
        content: msg.content,
    }));


    // Add initial system prompt to conversation
    const input = [
        { role: "system", content: "You are a wildfire intelligence assistant. Address the user's most recent query, using the rest of the conversation as context. When answering questions related to wildfires, primarily use the provided wildfire data tools to provide an answer, and cite your tool usage." },
        ...historyInput
    ] as unknown as ResponseInput;

    console.log();
    console.log("INPUT");
    console.log(input);
    console.log();
  
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
        var new_input = [...input];

        var found_tool_call = false;

        // Loop over response output and make queries while tool calls are needed.
        do {
            query_count += 1
            var tool_requests: ResponseFunctionToolCall[] = [];
            found_tool_call = false;

            console.log("Iterating over response output:")
            for (const item of response.output) {
                console.log(item);
                console.log();

                if (item.type == "function_call") {

                    found_tool_call = true;
                    tool_requests.push(item);
                }
            };

            // Make new query with results from tool calling if necessary
            if (found_tool_call) {

                const tool_output = await make_tool_calls(tool_requests);
                new_input.push(...tool_output);

                response = await openai.responses.create({
                    model: "openai/gpt-4o",
                    instructions: "Respond using information retrieved from tool(s). If you have received information from the rag tool, do not call the rag tool again. If the information you received is not sufficient to answer the user, indicate that to the user. Indicate whether you have included information from a tool. YOU MUST CITE YOUR SOURCES AND INDICATE whether you have included information from a tool. Any information from a rag_tool_context must be MLA CITED. ALSO AT THE END OF EACH MESSAGE, PROVIDE A SOURCES LIST INCLUDING AN MLA CITED REFERENCE OF ALL INFORMATION AUTHOR, TITLE, ETC",
                    input: new_input,
                    tools: all_tools,
                });
            }
            
        } while (found_tool_call);

        new_input.push({
            role: "assistant",
            content: response.output_text
        });

        res.status(200).json({msg: response.output_text, hist: new_input});

    } catch (e: any) {
        console.log("Error with query", query_count);
        console.log(e.error);
        console.log(e);
    }
}
