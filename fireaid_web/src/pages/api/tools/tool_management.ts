// tool_definitions.ts
// Tool definitions for the OpenAI API

import { Tool, ResponseFunctionToolCall, ResponseInput } from "openai/resources/responses/responses.mjs";
import { getWildfireTerm } from "../tools/handle_get_wildfire_term";

// **** TOOL DEFINITIONS *****

// Create a new tool using the format below, and add it to the query_tools list
// cast as a Tool object.

/*
const toolName = 
    {
        type: "function",
        name: "your_tool_name",
        description: "A plain text description of what your tool is for.",
        paramaters: {
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

// Exported list of tools for use in API query
export const query_tools = [wildfireTerminologyTool as Tool];


// ***** HANDLE TOOL CALLS *****

export async function make_tool_calls(tool_call_list: ResponseFunctionToolCall[]) {
    var tool_output = [] as ResponseInput;

    for (const item of tool_call_list) {

        if(item.name == "get_wildfire_term") {
            const def = await getWildfireTerm(JSON.parse(item.arguments).term)
            tool_output.push(item);

            tool_output.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: def
            });
        }

    };

    return tool_output;
}