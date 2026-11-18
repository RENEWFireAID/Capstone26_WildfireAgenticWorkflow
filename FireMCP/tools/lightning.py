"""Lightning and Fire History: satellite embedding layer and lightning summaries."""
import asyncio
import time
from datetime import date, datetime, timezone
from typing import Any, Dict, List

import ee
from tools.gee_client import GeeNotConfigured, ensure_initialized
from tools.mongo_fire_tools import db

TIMEOUT_SECONDS = 60
# Earth Engine map ids stop working after a while, so rebuild them hourly.
LAYER_CACHE_SECONDS = 3600
_layers: Dict[str, Any] = {}


def _ms(day: str, end: bool = False) -> int:
    d = datetime.combine(date.fromisoformat(day), datetime.max.time() if end else datetime.min.time())
    return int(d.replace(tzinfo=timezone.utc).timestamp() * 1000)


def _embedding_url(first: int, last: int) -> str:
    ensure_initialized()
    image = (
        ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL")
        .filterDate(f"{first}-01-01", f"{last + 1}-01-01")
        .mean()
    )
    return image.getMapId({"bands": ["A10", "A32", "A55"], "min": -0.3, "max": 0.3})["tile_fetcher"].url_format


async def embedding_layer(years: List[int]) -> Dict[str, Any]:
    """Tile URL for the mean satellite embedding from the first to the last selected year."""
    key = (min(years), max(years))
    cached = _layers.get(key)
    if cached and time.time() - cached[0] < LAYER_CACHE_SECONDS:
        return {"ok": True, "url": cached[1]}
    try:
        url = await asyncio.wait_for(asyncio.to_thread(_embedding_url, *key), timeout=TIMEOUT_SECONDS)
    except GeeNotConfigured as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"Earth Engine query failed: {e!r}"}
    _layers[key] = (time.time(), url)
    return {"ok": True, "url": url}


def strike_counts(start_date: str, end_date: str) -> Dict[str, Any]:
    """Lightning strikes per year and month between two dates."""
    rows = db["lightning_strikes"].aggregate([
        {"$match": {"LOCALDATET": {"$gte": _ms(start_date), "$lte": _ms(end_date, True)}}},
        {"$group": {"_id": {"$substrCP": ["$STRIKETIME", 0, 7]}, "strikes": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ])
    months = [{"month": r["_id"].replace("/", "-"), "strikes": r["strikes"]} for r in rows]
    return {"ok": True, "total": sum(m["strikes"] for m in months), "by_month": months,
            "note": "Records cover 1986-2012; 1987 and 1989 are missing."}

