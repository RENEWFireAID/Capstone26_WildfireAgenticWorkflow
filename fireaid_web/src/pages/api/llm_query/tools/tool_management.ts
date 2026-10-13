// tool_definitions.ts
// Tool definitions for the OpenAI API

import { Tool, ResponseFunctionToolCall, ResponseInput } from "openai/resources/responses/responses.mjs";

import { getWildfireTerm } from "./terminology_tool/handle_get_wildfire_term";
import { query_fire_points } from "./historic_wildfires_tool/handle_historic_fires";
import { retrieveRagContext } from "./rag_tool/handle_rag_search";
import { generateChart } from "./chart_tool/handle_generate_chart";
import type { ChartSpec } from "@/lib/chartBuilder";


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


// Tool for plotting a chart from the historic fire database, rendered in chat.
const chartTool = {
    type: "function",
    name: "generate_chart",
    description: "Plot a chart of the Alaska wildfire database and show it to the user in the chat. Use this whenever the user asks to see, plot, graph, visualise or chart the fire data, or asks how a quantity changes over time or compares across categories. The chart is displayed automatically, so never say you are unable to show charts.",
    parameters: {
        type: "object",
        properties: {
            request: {
                type: "string",
                description: "A plain English description of the chart to plot, naming the quantity, the grouping and any year range. For example 'total acres burned per year since 2000'.",
            },
        },
        required: ["request"],
    },
};


// Exported list of tools for use in API query
export const query_tools = [
    wildfireTerminologyTool as Tool, 
    historicWildfireQuery as Tool,
    ragTool as Tool,
    chartTool as Tool
];


// ***** HANDLE TOOL CALLS *****

export async function make_tool_calls(tool_call_list: ResponseFunctionToolCall[]) {
    var tool_output = [] as ResponseInput;
    const charts: ChartSpec[] = [];

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
          
        if (item.name == "generate_chart") {
            const result = await generateChart(JSON.parse(item.arguments).request);
            if (result.chart) charts.push(result.chart);
            tool_output.push(item);

            tool_output.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: result.output
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

    return { tool_output, charts };
}