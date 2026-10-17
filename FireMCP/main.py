from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from tools.mongo_fire_tools import search_fire_points, count_fire_points
from tools.fire_risk_model import predict_risk
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


# The training weather comes from a grid at 68-70N in northern Alaska, so climate
 #   normals from elsewhere (e.g. Fairbanks) are outside what the models saw; prefer
  #  the defaults unless the user gives real weather values.

@mcp.tool()
def predict_fire_risk(
    features: dict, model: str = "random_forest", month: Optional[int] = None
) -> dict:
    """Predict a wildfire risk category: Very Low, Low, Moderate or High.

    model is one of random_forest, xgboost or svm. Always pass month (1-12) when
    the question is about a time of year: features you leave out are then filled
    with the training median for that month instead of across all fires.
    Leave out any feature you don't have a real value for. Filled values are listed
    under "defaulted", which also shows every feature name; an unknown name returns
    the units and ranges.

    Score lookups:
    IGNITION_WEATHER_SCORE by cause: Lightning 15, Natural 12, Undetermined 6,
    Human 4, Prescribed 0.
    ASPECT_SCORE: Flat 8, N 3, NE 4, E 9, SE 13, S 15, SW 14, W 10, NW 5, unknown 7.
    ELEVATION_SCORE, feet up to: 500 5, 1500 10, 2500 15, 3500 12, 4500 8, 5500 5,
    6500 3, 7500 2, higher 1, unknown 7.
    SLOPE_WIND_SCORE, slope % up to: 25 2, 40 4, 55 6, 75 8, higher 10, unknown 3.
    """
    return predict_risk(features, model, month)


if __name__ == "__main__":
    import uvicorn

    app = mcp.streamable_http_app()
    uvicorn.run(app, host="0.0.0.0", port=8081)
