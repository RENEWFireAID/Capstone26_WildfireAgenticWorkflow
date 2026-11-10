import { OpenAI } from "openai";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, ResponseFunctionToolCall, Tool } from "openai/resources/responses/responses.mjs";
import { query_tools, make_tool_calls } from "./tools/tool_management";
import type { ChartSpec } from "@/lib/chartBuilder";
import { MODELS } from "@/lib/models";
import type { AnswerSource } from "@/lib/answerSources";

// The chat lists the papers and records each answer drew on, so the model
// cites papers by number and leaves the reference list to the interface.
const ANSWER_INSTRUCTIONS = `Answer the user's latest question using the tool results above.
- Quote figures exactly as the tools returned them; never estimate or invent numbers.
- Research papers in the tool results are numbered like [1]. Cite them inline with those numbers, e.g. "Burn severity rose after 2004 [2]." Do not write a separate sources or references list.
- If you have received information from the rag tool, do not call the rag tool again.
- If the tool results do not answer the question, say so plainly instead of filling the gap.
- If any part of your answer comes from general knowledge rather than the tool results, say which part.`;

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

    // Charts are structured, so they travel to the client separately from the
    // assistant's text; a function_call_output can only carry a string.
    const charts: ChartSpec[] = [];
    const sources: AnswerSource[] = [];
    let papersCited = 0;

    try {
        // Send initial prompt with tools
        // Temperature 0 so the same question gets the same answer.
        var response = await openai.responses.create({
            model: MODELS.agentTools,
            temperature: 0,
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

                const { tool_output, charts: newCharts, sources: newSources } = await make_tool_calls(tool_requests, papersCited + 1);
                new_input.push(...tool_output);
                charts.push(...newCharts);
                sources.push(...newSources);
                for (const src of newSources) if (src.kind === "papers") papersCited += src.papers.length;

                response = await openai.responses.create({
                    model: MODELS.agentAnswer,
                    temperature: 0,
                    instructions: ANSWER_INSTRUCTIONS,
                    input: new_input,
                    tools: all_tools,
                });
            }
            
        } while (found_tool_call);

        new_input.push({
            role: "assistant",
            content: response.output_text
        });

        res.status(200).json({msg: response.output_text, hist: new_input, charts, sources});

    } catch (e: any) {
        console.log("Error with query", query_count);
        console.log(e.error);
        console.log(e);
        // Without this the request hangs until the client times out.
        res.status(500).json({ error: e?.message ?? "LLM query failed" });
    }
}
