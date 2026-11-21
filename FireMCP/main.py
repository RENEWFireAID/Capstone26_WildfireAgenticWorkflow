from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from tools.mongo_fire_tools import search_fire_points, count_fire_points
from tools.vegetation_tools import (
    get_vegetation_timeseries as _get_vegetation_timeseries,
)
from tools.fire_risk_model import predict_risk
from tools.fire_danger import forecast_for, map_for
from tools import burn_recovery
from tools import forest_trends
from tools import parcel_risk
from tools import lightning
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


@mcp.tool()
async def get_vegetation_timeseries(
    lat: float,
    lon: float,
    start_year: int = 2000,
    end_year: int = 2024,
    reducer: str = "median",
) -> dict:
    """Get annual summer vegetation and climate values at a point from Landsat.

    Returns one record per year with NDVI, NBR and NDMI (June-August composite,
    cloud masked) plus TerraClimate summer temperature, precipitation, spring
    snow water equivalent and soil moisture, including 1-year lagged climate.
    Use it to assess pre- and post-fire vegetation change at a fire point.
    Values may be null for years with no usable imagery. Requires Earth Engine
    credentials; a cold query can take up to a minute.
    """
    return await _get_vegetation_timeseries(
        lat=lat,
        lon=lon,
        start_year=start_year,
        end_year=end_year,
        reducer=reducer,
    )


@mcp.tool()
async def forest_trend_map(
    region: dict,
    start_year: int = 2000,
    end_year: int = 2024,
    index: str = "NDVI",
    reducer: str = "median",
) -> dict:
    """Map where vegetation has been greening or browning across a region.

    region is a GeoJSON Polygon in lon/lat (under 25,000 km2). For each pixel it
    fits Kendall's tau and the Theil-Sen slope of the annual June-August Landsat
    index (NDVI, NBR or NDMI; median, mean or max composite) over the years, as in
    Sumana Sahoo's Forest Trend Mapper. Returns map tile URLs (all pixels and
    p <= 0.05 only), MTBS and Alaska fire perimeter overlays, the number of
    fires in the region, and a summary: median tau and slope and the share of
    pixels significantly greening or browning. A cold query can take a minute.
    """
    return await forest_trends.forest_trend_map(region, start_year, end_year, index, reducer)


@mcp.tool()
async def forest_trend_downloads(
    region: dict,
    start_year: int = 2000,
    end_year: int = 2024,
    index: str = "NDVI",
    reducer: str = "median",
    significant_only: bool = False,
) -> dict:
    """GeoTIFF download links for a region's trend maps (Kendall tau, Sen slope).

    Same inputs as forest_trend_map; the region must be under 6,500 km2, since
    Earth Engine stops direct downloads near 32 MB. significant_only adds the
    p <= 0.05 masked versions.
    """
    return await forest_trends.forest_trend_downloads(
        region, start_year, end_year, index, reducer, significant_only
    )


@mcp.tool()
async def fire_history_at_point(lat: float, lon: float) -> dict:
    """Fires whose mapped perimeters contain a point, from MTBS and the Alaska
    fire history, with name, source and year. Use it to tell whether a
    location burned, and when, before reading its vegetation time series.
    """
    return await forest_trends.fire_history_at_point(lat, lon)


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


@mcp.tool()
def fire_danger_forecast(
    place: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    date: Optional[str] = None,
) -> dict:
    """5-day Alaska fire danger (Low to Extreme) from date (YYYY-MM-DD, default today).

    Pass an Alaska place name or latitude/longitude. Rated Apr 1-Sep 30 only; dates
    before today use observed weather. Weather is in F, mph and inches.
    """
    return forecast_for(place, latitude, longitude, date)


@mcp.tool()
def fire_danger_map(date: Optional[str] = None) -> dict:
    """Statewide Alaska fire danger for one date (YYYY-MM-DD, default today) on a ~110 km grid.

    Each cell has lat, lon, rating (Low to Extreme) and status. A new date can take ~20 s.
    """
    return map_for(date)


@mcp.tool()
def burn_recovery_overview(fire: Optional[str] = None) -> dict:
    """Burn severity and post-fire recovery of the 2019 Shovel Creek, Swan Lake and Nugget Creek fires.

    Use this to answer questions about these three fires: sampled locations, mean NDVI
    by dNBR severity group for 2020-2024, how well models trained on two fires predict
    the third (R², RMSE vs a training-mean baseline), agreement with MTBS, and field
    CBI checks. Omit fire for all three. Small; contains no images.
    """
    return burn_recovery.overview(fire)


@mcp.tool()
def burn_recovery_imagery(
    fire: str, layer: str, year: Optional[str] = None, contrast: str = "percentile"
) -> dict:
    """A saved satellite preview of one of the three 2019 fires, as a PNG data URL (large).

    For drawing the Burn Severity Recovery page, not for answering questions.
    layer: rgb_2018, rgb_2020, rgb_2024, dnbr, ndvi or observations. year (2018,
    2020-2024) applies to ndvi and observations. contrast (percentile, brighter,
    original) applies to the natural-color rgb layers only.
    """
    return burn_recovery.imagery(fire, layer, year, contrast)


@mcp.tool()
def burn_recovery_samples(fire: str, period: str = "2020", model: str = "full") -> dict:
    """Per-location values for one of the three 2019 fires (large arrays, ~1,000-1,700 points).

    For drawing the Burn Severity Recovery page. Returns sample coordinates, dNBR,
    annual NDVI, severity-group curves, and the observed and predicted NDVI slopes for
    period (2020 or 2021, through 2024) and model (full, initial_NDVI_only,
    full_plus_initial_NDVI).
    """
    return burn_recovery.samples(fire, period, model)


@mcp.tool()
def burn_recovery_diagnostic(figure: str) -> dict:
    """A saved Shovel Creek diagnostic figure as a PNG data URL (large).

    figure: residual_maps, joint_climate_support, slope_stability or mtbs_class_iou.
    """
    return burn_recovery.diagnostic(figure)


@mcp.tool()
async def parcel_risk_layers(date: Optional[str] = None) -> dict:
    """Fairbanks North Star Borough parcel fire risk map for a date (YYYY-MM-DD; default the latest).

    Tile URLs, station FWI and sources, and the borough's median and 90th percentile risk.
    """
    return await parcel_risk.get_layers(date)


@mcp.tool()
async def parcel_vegetation_at(lat: float, lon: float, date: Optional[str] = None, include_geometry: bool = False) -> dict:
    """Daily fire risk (0-100) of the Fairbanks North Star Borough tax parcel at a point.

    date: YYYY-MM-DD, Feb 1-Oct 31 only; default the latest date with station data.
    Returns the risk, its band, the fuel, exposure, slope and FWI parts, the fire protection level and FWI station.
    """
    return await parcel_risk.parcel_at(lat, lon, date, include_geometry)


@mcp.tool()
async def parcel_fire_risk(pan: int | str, date: Optional[str] = None, include_geometry: bool = False) -> dict:
    """Daily fire risk (0-100) of a Fairbanks North Star Borough tax parcel by PAN (parcel number).

    date: YYYY-MM-DD, Feb 1-Oct 31 only; default the latest date with station data.
    Returns the risk, its band, the fuel, exposure, slope and FWI parts, the fire protection level and FWI station.
    """
    return await parcel_risk.parcel_by_pan(pan, date, include_geometry)


@mcp.tool()
async def lightning_embedding_layer(years: list[int]) -> dict:
    """Map tile URL for the mean Google satellite embedding over the selected years (2017-2024)."""
    return await lightning.embedding_layer(years)


@mcp.tool()
def lightning_strike_counts(start_date: str, end_date: str) -> dict:
    """Alaska lightning strikes per month between two dates (YYYY-MM-DD). Records cover 1986-2012."""
    return lightning.strike_counts(start_date, end_date)


if __name__ == "__main__":
    import threading

    import uvicorn

    # Build the page's example-day map in the background so the demo loads instantly.
    threading.Thread(target=map_for, args=("2022-06-15",), daemon=True).start()
    # Verify and load the burn recovery study up front; it checks every saved file.
    threading.Thread(target=burn_recovery.overview, daemon=True).start()

    app = mcp.streamable_http_app()
    uvicorn.run(app, host="0.0.0.0", port=8081)
