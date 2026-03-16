// Tool for accessing historic wildfire data from the MongoDB database
export const historicWildfireQuery = 
{
    type: "function",
    name: "query_fire_points",
    description: "Get total number of fires over a range of time in Alaska and more detailed information about subset of fires whose size is specified by limit.",
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

