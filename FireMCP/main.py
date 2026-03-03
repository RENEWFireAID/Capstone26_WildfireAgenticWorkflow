from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from tools.mongo_fire_tools import search_fire_points, count_fire_points
from typing import Optional

mcp = FastMCP(
    "FireMCP",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp.tool()
def query_fire_points(
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    prescribed: Optional[str] = None,
    limit: int = 200,
) -> dict:
    """Query wildfire records from MongoDB."""
    total = count_fire_points(
        year_start=year_start, year_end=year_end, prescribed=prescribed
    )
    results = search_fire_points(
        year_start=year_start, year_end=year_end, prescribed=prescribed, limit=limit
    )
    return {"ok": True, "total": total, "count": len(results), "results": results}


@mcp.tool()
def count_fires(
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    prescribed: Optional[str] = None,
) -> dict:
    """Count wildfire records matching filters."""
    return {
        "ok": True,
        "total": count_fire_points(
            year_start=year_start, year_end=year_end, prescribed=prescribed
        ),
    }


@mcp.tool()
def list_available_years() -> dict:
    """List all years available in the fire_points collection."""
    from tools.mongo_fire_tools import col

    years = [
        r["year"]
        for r in col.aggregate(
            [
                {"$group": {"_id": "$year"}},
                {"$sort": {"_id": 1}},
                {"$project": {"_id": 0, "year": "$_id"}},
            ]
        )
        if r.get("year") is not None
    ]
    return {"ok": True, "years": years}


if __name__ == "__main__":
    import uvicorn

    app = mcp.streamable_http_app()
    uvicorn.run(app, host="0.0.0.0", port=8081)
