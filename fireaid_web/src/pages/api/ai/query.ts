import { OpenAI } from "openai";
import type { NextApiRequest, NextApiResponse } from "next";
import { ResponseInput, ResponseFunctionToolCall, Tool } from "openai/resources/responses/responses.mjs";
import { query_tools, make_tool_calls } from "../tools/tool_management";

const ragTool = {
    type: "function",
    name: "retrieve_rag_context",
    description: "ALWAYS use this tool to retrieve relevant context from the wildfire literature database whenever the user asks about wildfire risks, scenarios, mitigation, or scientific phenomena. If you do not have sufficient information to answer the question, or if you are guessing, you MUST use this tool first.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The targeted search query to look up in the vector database.",
            },
        },
        required: ["query"],
    },
};

async function retrieveRagContext(query: string) {
    try {
        const url = process.env.RAG_API_URL || "http://host.docker.internal:8000/api/retrieve";
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, top_k: 3 })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return JSON.stringify(data.chunks);
    } catch (e) {
        console.error("Failed to retrieve context:", e);
        return "Failed to retrieve context.";
    }
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

    // Format user input
    const {msg: text} = req.body
    const input = [
        { role: "system", content: "You are a wildfire intelligence assistant. When answering questions regarding fire risks, history, mitigation, or research, you MUST ALWAYS use the retrieve_rag_context tool to look up information from the literature database before answering. Delay responding until you have retrieved context." },
        {
            role: "user",
            content: text,
        },
    ] as unknown as ResponseInput;

    const all_tools = [...query_tools, ragTool as Tool];

    try {
        // Send initial prompt with tools
        var response = await openai.responses.create({
            model: "gpt-5",
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
            var tool_requests: ResponseFunctionToolCall[] = [];
            found_term_tool_call = false;

            console.log("Iterating over response output:")
            for (const item of response.output) {
                console.log(item);
                console.log();

                if (item.type == "function_call") {
                    if (item.name == "retrieve_rag_context") {
                        const context = await retrieveRagContext(JSON.parse(item.arguments).query)

                        console.log("Synthesizing RAG context with OpenRouter...");
                        const synthReq = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                model: "deepseek/deepseek-chat",
                                messages: [
                                    { 
                                        role: "system", 
                                        content: "You are an engineering research assistant. Answer ONLY using the provided context. Cite sources using inline citations in your text, and provide an MLA formatted 'Sources' section at the very end of your response. Use the File, Title, and Author provided in the context blocks to construct the citations. If not in context, say 'Insufficient evidence.'" 
                                    },
                                    { 
                                        role: "user", 
                                        content: `QUESTION: ${text}\n\nCONTEXT:\n${context}\n\nANSWER:` 
                                    }
                                ]
                            })
                        });

                        if (synthReq.ok) {
                            const data = await synthReq.json();
                            res.status(200).json({msg: data.choices[0].message.content});
                        } else {
                            res.status(500).json({msg: "Failed to synthesize response with OpenRouter LLM."});
                        }
                        return;
                    }

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
                    tools: all_tools,
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
