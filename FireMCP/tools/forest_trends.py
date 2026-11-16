"""Area trend maps, fire perimeters and GeoTIFF exports for Forest Trends.

Wraps the Forest Trend Mapper computation in forest_trend_core: for a drawn
region it returns Earth Engine map tiles of the Kendall tau and Sen slope
trends (all pixels and p <= 0.05 only), the fire perimeter overlays, and a
summary of the trend across the region. Earth Engine calls block for seconds
to a minute, so each runs in a thread under the shared GEE timeout.
"""

import asyncio
import hashlib
import json
import math
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import ee

from forest_trend_core import (
    SLOPE_PALETTE,
    SLOPE_VIS,
    TAU_PALETTE,
    TAU_VIS,
    ak_fire_perimeters,
    compute_trends,
    download_url,
    ak_fires_at,
    mtbs_fires_at,
    get_annual_composites,
    get_landsat_jja,
    mtbs_perimeters,
)
from tools.gee_client import GeeNotConfigured, ensure_initialized

INDICES = ("NDVI", "NBR", "NDMI")
REDUCERS = ("median", "mean", "max")
EARLIEST_YEAR = 1984  # Landsat 5 C02 T1_L2 coverage begins here.

# Tiles render on demand at any size, but the summary statistics and the
# exports scale with area. 25,000 km2 holds the largest Alaska fire complexes.
MAX_AREA_KM2 = 25_000
# Earth Engine refuses direct downloads over about 32 MB. A float32 band at
# 30 m is 4 bytes per 900 m2, so 32 MB is roughly 7,000 km2; stay under it.
MAX_DOWNLOAD_AREA_KM2 = 6_500
# The region summary samples a coarser grid so large regions return quickly.
SUMMARY_SCALE_METERS = 120

# Map ids stay valid for hours; reuse them so toggling a view is instant.
MAP_CACHE_SECONDS = 3600
_map_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _timeout_seconds() -> float:
    return float(os.getenv("GEE_TIMEOUT_SECONDS", 120))


def _ring_area_km2(ring: List[List[float]]) -> float:
    """Area of a lon/lat ring on a sphere, accurate to well under 1% here."""
    radius_km = 6371.0088
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(ring, ring[1:] + ring[:1]):
        total += math.radians(lon2 - lon1) * (
            2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2))
        )
    return abs(total) * radius_km * radius_km / 2


def _parse_region(region: Any) -> Tuple[Optional[List[List[float]]], Optional[str]]:
    """Validate a GeoJSON Polygon (or a bare ring) and return its outer ring."""
    if isinstance(region, str):
        try:
            region = json.loads(region)
        except ValueError:
            return None, "region must be GeoJSON."
    if isinstance(region, dict) and region.get("type") == "Feature":
        region = region.get("geometry")
    if isinstance(region, dict):
        if region.get("type") != "Polygon":
            return None, "region must be a GeoJSON Polygon."
        rings = region.get("coordinates") or []
        ring = rings[0] if rings else []
    else:
        ring = region
    try:
        ring = [[float(p[0]), float(p[1])] for p in ring]
    except (TypeError, ValueError, IndexError):
        return None, "region coordinates must be [lon, lat] pairs."
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    if len(ring) < 3:
        return None, "region needs at least three corners."
    if len(ring) > 500:
        return None, "region has too many corners (500 at most)."
    for lon, lat in ring:
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            return None, f"Coordinates out of range: {lon}, {lat}."
    return ring, None


def _validate(start_year: int, end_year: int, index: str, reducer: str) -> Optional[str]:
    this_year = time.gmtime().tm_year
    if start_year > end_year:
        return "start_year must not be after end_year."
    if start_year < EARLIEST_YEAR or end_year > this_year:
        return f"Years must fall within {EARLIEST_YEAR}-{this_year} (Landsat coverage)."
    # Kendall tau and Sen slope need several years to mean anything.
    if end_year - start_year + 1 < 5:
        return "Use a range of at least five years for a trend."
    if index not in INDICES:
        return f"index must be one of {', '.join(INDICES)}."
    if reducer not in REDUCERS:
        return f"reducer must be one of {', '.join(REDUCERS)}."
    return None


def _tile_url(image: ee.Image, vis: Optional[Dict[str, Any]] = None) -> str:
    return image.getMapId(vis or {})["tile_fetcher"].url_format


def _round(v: Any, digits: int = 4) -> Any:
    return round(v, digits) if isinstance(v, (int, float)) else v


def _build(
    ring: List[List[float]], start_year: int, end_year: int, index: str, reducer: str
):
    roi = ee.Geometry.Polygon([ring])
    col = get_landsat_jja(roi, start_year, end_year)
    annual_col = get_annual_composites(col, roi, start_year, end_year, reducer)
    tau, slope, sig_mask = compute_trends(annual_col, index)
    return roi, tau, slope, sig_mask


def _trend_map(
    ring: List[List[float]], start_year: int, end_year: int, index: str, reducer: str
) -> Dict[str, Any]:
    """Blocking. Builds the trend tiles, overlays and region summary."""
    ensure_initialized()
    roi, tau, slope, sig_mask = _build(ring, start_year, end_year, index, reducer)

    layers = {
        "tau": _tile_url(tau.clip(roi), TAU_VIS),
        "slope": _tile_url(slope.clip(roi), SLOPE_VIS),
        "sig_tau": _tile_url(tau.updateMask(sig_mask).clip(roi), TAU_VIS),
        "sig_slope": _tile_url(slope.updateMask(sig_mask).clip(roi), SLOPE_VIS),
    }

    mtbs, mtbs_styled = mtbs_perimeters(roi)
    layers["mtbs"] = _tile_url(mtbs_styled)
    fires: Dict[str, Any] = {"mtbs": mtbs.size().getInfo(), "ak": None}
    notes: List[str] = []
    try:
        ak_fire, ak_styled = ak_fire_perimeters(roi)
        fires["ak"] = ak_fire.size().getInfo()
        layers["ak_fire"] = _tile_url(ak_styled)
    except Exception:
        # The Alaska layer is Sumana's own Earth Engine asset; if it is not
        # shared with this account, the rest of the analysis still stands.
        layers["ak_fire"] = None
        notes.append("The Alaska fire history layer could not be read by this server's Earth Engine account.")

    # How much of the region is trending, and which way, at p <= 0.05.
    summary_img = ee.Image.cat([
        tau.rename("tau"),
        slope.rename("slope"),
        sig_mask.And(tau.gt(0)).rename("greening"),
        sig_mask.And(tau.lt(0)).rename("browning"),
        tau.mask().rename("valid"),
    ])
    summary = None
    try:
        stats = summary_img.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.median(), sharedInputs=True),
            geometry=roi,
            scale=SUMMARY_SCALE_METERS,
            bestEffort=True,
            maxPixels=1e8,
        ).getInfo()
        valid = stats.get("valid_mean") or 0
        summary = {
            "median_tau": _round(stats.get("tau_median")),
            "median_slope_per_year": _round(stats.get("slope_median"), 6),
            # Shares are of the pixels that have a trend at all.
            "share_significant_greening": _round((stats.get("greening_mean") or 0) / valid) if valid else None,
            "share_significant_browning": _round((stats.get("browning_mean") or 0) / valid) if valid else None,
            "sample_scale_m": SUMMARY_SCALE_METERS,
        }
    except Exception as e:
        notes.append(f"The region summary could not be computed: {e}")

    return {
        "layers": layers,
        "fires_in_region": fires,
        "summary": summary,
        "notes": notes,
    }


def _downloads(
    ring: List[List[float]], start_year: int, end_year: int, index: str, reducer: str,
    significant_only: bool,
) -> Dict[str, str]:
    """Blocking. GeoTIFF links clipped to the region, as in her MapDownloader."""
    ensure_initialized()
    roi, tau, slope, sig_mask = _build(ring, start_year, end_year, index, reducer)
    urls = {
        "Trend Map (Kendall τ)": download_url(tau, roi),
        "Slope Map (Sen Slope)": download_url(slope, roi),
    }
    if significant_only:
        urls["Significant Trend Map"] = download_url(tau.updateMask(sig_mask), roi)
        urls["Significant Slope Map"] = download_url(slope.updateMask(sig_mask), roi)
    return urls


async def _run(fn, *args) -> Tuple[Optional[Any], Optional[str]]:
    timeout = _timeout_seconds()
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=timeout), None
    except asyncio.TimeoutError:
        return None, (
            f"Earth Engine took longer than {timeout:.0f}s. Try a smaller region "
            "or a shorter year range."
        )
    except GeeNotConfigured as e:
        return None, str(e)
    except Exception as e:
        return None, f"Earth Engine query failed: {e}"


async def forest_trend_map(
    region: Any,
    start_year: int = 2000,
    end_year: int = 2024,
    index: str = "NDVI",
    reducer: str = "median",
) -> Dict[str, Any]:
    ring, err = _parse_region(region)
    if err:
        return {"ok": False, "error": err}
    start_year, end_year = int(start_year), int(end_year)
    err = _validate(start_year, end_year, index, reducer)
    if err:
        return {"ok": False, "error": err}
    area = _ring_area_km2(ring)
    if area > MAX_AREA_KM2:
        return {
            "ok": False,
            "error": f"The region is {area:,.0f} km²; draw one under {MAX_AREA_KM2:,} km².",
        }

    key = hashlib.sha1(
        json.dumps([ring, start_year, end_year, index, reducer]).encode()
    ).hexdigest()
    hit = _map_cache.get(key)
    if hit and time.time() - hit[0] < MAP_CACHE_SECONDS:
        result = hit[1]
    else:
        result, err = await _run(_trend_map, ring, start_year, end_year, index, reducer)
        if err:
            return {"ok": False, "error": err}
        _map_cache[key] = (time.time(), result)

    return {
        "ok": True,
        "region_area_km2": round(area, 1),
        "start_year": start_year,
        "end_year": end_year,
        "index": index,
        "reducer": reducer,
        "legend": {
            "tau": {"min": -1, "max": 1, "palette": TAU_PALETTE},
            "slope": {"min": -0.01, "max": 0.01, "palette": SLOPE_PALETTE, "unit": f"{index}/year"},
        },
        **result,
    }


async def forest_trend_downloads(
    region: Any,
    start_year: int = 2000,
    end_year: int = 2024,
    index: str = "NDVI",
    reducer: str = "median",
    significant_only: bool = False,
) -> Dict[str, Any]:
    ring, err = _parse_region(region)
    if err:
        return {"ok": False, "error": err}
    start_year, end_year = int(start_year), int(end_year)
    err = _validate(start_year, end_year, index, reducer)
    if err:
        return {"ok": False, "error": err}
    area = _ring_area_km2(ring)
    if area > MAX_DOWNLOAD_AREA_KM2:
        return {
            "ok": False,
            "error": (
                f"The region is {area:,.0f} km²; Earth Engine downloads stop near 32 MB, "
                f"so draw one under {MAX_DOWNLOAD_AREA_KM2:,} km² to export GeoTIFFs."
            ),
        }
    urls, err = await _run(
        _downloads, ring, start_year, end_year, index, reducer, bool(significant_only)
    )
    if err:
        return {"ok": False, "error": err}
    return {"ok": True, "region_area_km2": round(area, 1), "downloads": urls}


async def fire_history_at_point(lat: float, lon: float) -> Dict[str, Any]:
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        return {"ok": False, "error": f"Coordinates out of range: {lat}, {lon}."}

    def query():
        ensure_initialized()
        geom = ee.Geometry.Point([lon, lat])
        fires = mtbs_fires_at(geom)
        notes = []
        try:
            fires += ak_fires_at(geom)
        except Exception:
            notes.append("The Alaska fire history layer could not be read by this server's Earth Engine account.")
        # Remove exact duplicates if both datasets recorded it
        return list(dict.fromkeys(fires)), notes

    result, err = await _run(query)
    if err:
        return {"ok": False, "error": err}
    fires, notes = result
    records = [{"name": n, "source": s, "year": y} for n, s, y in fires]
    records.sort(key=lambda r: (r["year"] is None, r["year"] or 0))
    return {"ok": True, "lat": lat, "lon": lon, "count": len(records), "fires": records, "notes": notes}
