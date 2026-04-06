// tool_definitions.ts
// Tool definitions for the OpenAI API

import { Tool, ResponseFunctionToolCall, ResponseInput } from "openai/resources/responses/responses.mjs";

import { getWildfireTerm } from "./handlers/handle_get_wildfire_term";
import { query_fire_points } from "./handlers/handle_historic_fires";
import { retrieveRagContext } from "../tools/handle_rag_search";


// **** TOOL DEFINITIONS *****

// Create a new tool using the format below, and add it to the query_tools list
// cast as a Tool object.

/*
const toolName = 
    {
        type: "function",
        name: "your_tool_name",
        description: "A plain text description of what your tool is for.",
        parameters: {
            type: "object",
            properties: {
                yourParameterToPass: {
                    type: "type of your parameter",
                    description: "A plain text description of what the parameter is"
                },
            },
            required: ["yourParameterToPass"], // Include here if the parameter is required
        },
    };

query_tools = [toolName as Tool]
*/

// Tool for accessing the definiton of a term from the wildfire terminology database.
const wildfireTerminologyTool =
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

const historicWildfireQuery = 
    {
        type: "function",
        name: "query_fire_points",
        description: "Get detailed information on fires over a range of time in Alaska. Limit represents the maximum number of fires that information will be returned for",
        parameters: {
            type: "object",
            properties: {
                year_start: {
                    type: [ "integer", "null" ],
                    description: "The starting year to retrieve wildfires for."
                },
                year_end: {
                    type: [ "integer", "null" ],
                    description: "The ending year to retrieve wildfires for."
                },
                prescribed: {
                    type: [ "string", "null" ],
                    description: "Filters for prescribed fires, expects 'Y' or 'N'."
                },
                limit: {
                    type: [ "integer", "null" ],
                    description: "Limits the number of fires returned."
                },
            },
            required: [ "year_start", "year_end", "prescribed", "limit" ],
        },
    };

// Tool for retrieving RAG context from database of wildfire literature
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



// Exported list of tools for use in API query
export const query_tools = [
    wildfireTerminologyTool as Tool, 
    historicWildfireQuery as Tool,
    ragTool as Tool
];


// ***** HANDLE TOOL CALLS *****

export async function make_tool_calls(tool_call_list: ResponseFunctionToolCall[]) {
    var tool_output = [] as ResponseInput;

    for (const item of tool_call_list) {

        if (item.name == "get_wildfire_term") {
            const def = await getWildfireTerm(JSON.parse(item.arguments).term)
            tool_output.push(item);

            tool_output.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: def // This needs to be a string value or you will get an API error
            });
        }

        if(item.name == "query_fire_points") {
            const args = JSON.parse(item.arguments);
            const data = await query_fire_points(args["year_start"], args["year_end"], args["prescribed"], args["limit"]);
            tool_output.push(item);
          
            tool_output.push({
                  type: "function_call_output",
                  call_id: item.call_id,
                  output: JSON.stringify(data)
            });
        }
          
        if (item.name == "retrieve_rag_context") {
            const context = await retrieveRagContext(JSON.parse(item.arguments).query)
            tool_output.push(item)

            tool_output.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: context
            })
        }
    };

    return tool_output;
}