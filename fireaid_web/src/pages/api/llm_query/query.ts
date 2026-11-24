import { OpenAI } from "openai";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, ResponseFunctionToolCall, Tool } from "openai/resources/responses/responses.mjs";
import { query_tools, make_tool_calls } from "./tools/tool_management";
import { appTools } from "@/lib/appTools";
import type { ChartSpec } from "@/lib/chartBuilder";
import { MODELS } from "@/lib/models";
import type { AnswerSource } from "@/lib/answerSources";

// The chat lists the papers and records each answer drew on, so the model
// cites papers by number and leaves the reference list to the interface.
const ANSWER_INSTRUCTIONS = `Answer the user's latest question using the tool results above.
- Quote figures exactly as the tools returned them; never estimate or invent numbers.
- Every figure must appear in a tool result. If a fire or value you need is not in the results, say it was not found or look it up again (e.g. by fire name). Never fill it in from memory, and never credit a source for a number it did not return.
- Research papers in the tool results are numbered like [1]. Cite them inline with those numbers, e.g. "Burn severity rose after 2004 [2]." Do not write a separate sources or references list.
- If you have received information from the rag tool, do not call the rag tool again.
- Tool results from an app (Forest Trends, Burn Severity Recovery, Alaska Fire Risk, Parcel Fire Risk, Lightning) are that app's data. Name the app in a sentence, e.g. "According to the Burn Severity Recovery app, ...", not in brackets. Follow any Note at the start of a tool result. Never show links or JSON.
- If the tool results do not answer the question, say so plainly instead of filling the gap.
- If any part of your answer comes from general knowledge rather than the tool results, say which part.`;

type Message = { role: "user" | "ai"; content: string; time: string };

const SYSTEM_PROMPT = `You are FireAID's wildfire intelligence assistant for Alaska. Address the user's most recent query, using the rest of the conversation as context. When answering questions related to wildfires, primarily use the provided wildfire data tools to provide an answer, and cite your tool usage.
Besides the fire records, research library and glossary, you can look up the data behind FireAID's apps:
- Forest Trends: Landsat vegetation (NDVI, NBR, NDMI) and climate at a point since 2000, which mapped fires burned a point, and greening or browning across an area.
- Burn Severity Recovery: burn severity and greenness recovery of the 2019 Shovel Creek, Swan Lake and Nugget Creek fires.
- Alaska Fire Risk: 5-day fire danger forecasts for Alaska places, and a model that rates fire risk.
- Parcel Fire Risk: daily fire risk of tax parcels in the Fairbanks North Star Borough.
- Lightning: Alaska lightning strikes per month, 1986-2012.
For a place name, use its approximate latitude and longitude and say which point you used. Longitudes west of Greenwich are negative: 148.25 W is -148.25, and all of mainland Alaska is between about -130 and -169.`;

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
        { role: "system", content: SYSTEM_PROMPT },
        ...historyInput
    ] as unknown as ResponseInput;

    console.log();
    console.log("INPUT");
    console.log(input);
    console.log();
  
    const all_tools = [...query_tools, ...(await appTools())];
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
