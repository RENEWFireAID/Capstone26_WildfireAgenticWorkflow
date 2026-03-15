export async function getHistoricData(
    yr_start: Number | null,
    yr_end: Number | null,
    prescr: String | null,
    lim: Number | null,
) {
    const res = await fetch( "/api/mcp/run",
        {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                year_start: yr_start,
                year_end: yr_end,
                prescribed: prescr,
                limit: lim,
            })
        }
    )

    if (!res.ok) {
        console.log("Bad MCP api response: ", res.status)
        return null
    }

    console.log(res)
    return res;
}