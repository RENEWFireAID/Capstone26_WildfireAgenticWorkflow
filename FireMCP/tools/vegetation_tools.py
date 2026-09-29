"""Annual summer vegetation and climate time series at a point, from Earth Engine.

Wraps the Forest Trend Mapper computation in forest_trend_core with a point
buffer, a MongoDB cache and an off-event-loop executor, since a cold Earth
Engine query takes roughly 5-60 seconds.
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import ee
from pymongo.errors import PyMongoError

from forest_trend_core import CLIMATE_BANDS, get_annual_composites, get_landsat_jja
from tools.gee_client import GeeNotConfigured, ensure_initialized
from tools.mongo_fire_tools import db

# Her composites clip to the ROI, so a zero-area point returns nothing.
# 90 m covers the 30 m Landsat pixel the sample is drawn from plus neighbours.
ROI_BUFFER_METERS = 90
SAMPLE_SCALE_METERS = 30

# Rounding the cache key to 3 decimals (~110 m) matches the ROI buffer: two
# points that round together sample effectively the same pixel neighbourhood.
CACHE_PRECISION = 3

EARLIEST_YEAR = 1984  # Landsat 5 C02 T1_L2 coverage begins here.
MAX_YEAR_SPAN = 50

DEFAULT_TIMEOUT_SECONDS = 120
DEFAULT_CACHE_TTL_DAYS = 30

BAND_NAMES = ["NDVI", "NBR", "NDMI"] + list(CLIMATE_BANDS.values())

cache_col = db["vegetation_timeseries"]
_index_ready = False


def _timeout_seconds() -> float:
    return float(os.getenv("GEE_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))


def _cache_ttl_days() -> float:
    return float(os.getenv("VEGETATION_CACHE_TTL_DAYS", DEFAULT_CACHE_TTL_DAYS))


def _ensure_index() -> None:
    global _index_ready
    if _index_ready:
        return
    try:
        cache_col.create_index(
            [
                ("lat", 1),
                ("lon", 1),
                ("start_year", 1),
                ("end_year", 1),
                ("reducer", 1),
            ],
            unique=True,
            name="veg_cache_key",
        )
    except PyMongoError:
        pass  # Cache is best effort; a missing index must not fail the query.
    _index_ready = True


def _cache_key(
    lat: float, lon: float, start_year: int, end_year: int, reducer: str
) -> Dict[str, Any]:
    return {
        "lat": round(lat, CACHE_PRECISION),
        "lon": round(lon, CACHE_PRECISION),
        "start_year": start_year,
        "end_year": end_year,
        "reducer": reducer,
    }


def _read_cache(key: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    _ensure_index()
    cutoff = datetime.now(timezone.utc) - timedelta(days=_cache_ttl_days())
    try:
        doc = cache_col.find_one({**key, "created_at": {"$gte": cutoff}})
    except PyMongoError:
        return None
    return doc.get("results") if doc else None


def _write_cache(key: Dict[str, Any], results: List[Dict[str, Any]]) -> None:
    _ensure_index()
    try:
        cache_col.update_one(
            key,
            {
                "$set": {
                    **key,
                    "results": results,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
    except PyMongoError:
        pass  # Cache is best effort.


def _round(v: Any) -> Any:
    return round(v, 6) if isinstance(v, float) else v


def _rows_to_records(
    rows: List[List[Any]], start_year: int, end_year: int
) -> List[Dict[str, Any]]:
    """Reshape a getRegion table into one record per year, nulls included."""
    header = rows[0]
    index = {name: i for i, name in enumerate(header)}

    by_year: Dict[int, Dict[str, Any]] = {}
    for row in rows[1:]:
        raw_year = row[index["year"]] if "year" in index else None
        if raw_year is None:
            continue
        year = int(raw_year)
        record = {"year": year}
        for band in BAND_NAMES:
            record[band] = _round(row[index[band]]) if band in index else None
        # Later rows for a year would only appear if the ROI covered several
        # pixels; keep the first, which is the one at the requested point.
        by_year.setdefault(year, record)

    return [
        by_year.get(year, {"year": year, **{band: None for band in BAND_NAMES}})
        for year in range(start_year, end_year + 1)
    ]


def _fetch_timeseries(
    lat: float, lon: float, start_year: int, end_year: int, reducer: str
) -> List[Dict[str, Any]]:
    """Blocking Earth Engine query. Must not run on the event loop."""
    ensure_initialized()

    roi = ee.Geometry.Point([lon, lat]).buffer(ROI_BUFFER_METERS)
    point = ee.Geometry.Point([lon, lat])

    landsat = get_landsat_jja(roi, start_year, end_year)
    annual = get_annual_composites(landsat, roi, start_year, end_year, reducer)

    rows = (
        annual.select(["year"] + BAND_NAMES)
        .getRegion(point, SAMPLE_SCALE_METERS)
        .getInfo()
    )

    if not rows or len(rows) <= 1:
        return []
    return _rows_to_records(rows, start_year, end_year)


async def get_vegetation_timeseries(
    lat: float,
    lon: float,
    start_year: int = 2000,
    end_year: int = 2024,
    reducer: str = "median",
) -> Dict[str, Any]:
    """Return annual summer NDVI/NBR/NDMI and TerraClimate values at a point."""
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        return {"ok": False, "error": f"Coordinates out of range: {lat}, {lon}."}

    start_year, end_year = int(start_year), int(end_year)
    if start_year > end_year:
        return {"ok": False, "error": "start_year must not be after end_year."}
    if start_year < EARLIEST_YEAR:
        return {
            "ok": False,
            "error": f"start_year must be {EARLIEST_YEAR} or later (Landsat coverage).",
        }
    if end_year - start_year + 1 > MAX_YEAR_SPAN:
        return {
            "ok": False,
            "error": f"Year span must be at most {MAX_YEAR_SPAN} years.",
        }
    if reducer not in ("median", "mean", "max"):
        return {"ok": False, "error": "reducer must be one of median, mean, max."}

    key = _cache_key(lat, lon, start_year, end_year, reducer)
    cached = _read_cache(key)
    if cached is not None:
        return {
            "ok": True,
            "cached": True,
            "lat": lat,
            "lon": lon,
            "start_year": start_year,
            "end_year": end_year,
            "reducer": reducer,
            "count": len(cached),
            "results": cached,
        }

    timeout = _timeout_seconds()
    try:
        results = await asyncio.wait_for(
            asyncio.to_thread(
                _fetch_timeseries, lat, lon, start_year, end_year, reducer
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        return {
            "ok": False,
            "error": (
                f"Earth Engine query timed out after {timeout:.0f}s. Try a shorter "
                "year range, or retry — the first query at a location is slowest."
            ),
        }
    except GeeNotConfigured as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"Earth Engine query failed: {e}"}

    if not results:
        return {
            "ok": False,
            "error": f"No Landsat data found at {lat}, {lon} for {start_year}-{end_year}.",
        }

    _write_cache(key, results)

    return {
        "ok": True,
        "cached": False,
        "lat": lat,
        "lon": lon,
        "start_year": start_year,
        "end_year": end_year,
        "reducer": reducer,
        "count": len(results),
        "results": results,
    }
