// Tool for accessing historic wildfire data from the MongoDB database
export const historicWildfireQuery = 
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

