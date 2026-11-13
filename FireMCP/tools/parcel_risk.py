""" Parcel fire risk for the Fairbanks North Star Borough.

Emma and Darshans Vegetation Fire Risk notebook. 
Map layers and point lookups query their Earth Engine assets live. Parcel

scores come from the notebook's per-parcel export (cell 1's reduceRegions),
"""
import asyncio
import os
import time
from typing import Any, Dict, List
import ee
from pymongo.errors import PyMongoError
from tools.gee_client import GeeNotConfigured, ensure_initialized
from tools.mongo_fire_tools import db

DATA_PROJECT = os.getenv("PARCEL_RISK_EE_PROJECT", "fireaid-507818")
VEG_ASSET = f"projects/{DATA_PROJECT}/assets/FNSB_veg"
PARCEL_ASSET = f"projects/{DATA_PROJECT}/assets/FNSB_Tax_Parcels"

TIMEOUT_SECONDS = 60
# Earth Engine map ids stop working after a while, so rebuild them hourly.
LAYER_CACHE_SECONDS = 3600
MAX_PARCEL_MATCHES = 20

parcel_col = db["parcel_risk"]

# Original vegetation classes (18 classes: 0-17)
# Format: {value: (Display Name, Hex Color)}
VEGETATION_LEGEND = {
    0: ("No Data", "#000000"),
    1: ("Open black spruce forest", "#004D40"),
    2: ("Black spruce woodland", "#1E88E5"),
    3: ("Closed black spruce forest", "#003300"),
    4: ("Closed white spruce forest", "#3949AB"),
    5: ("White spruce woodland", "#5E35B1"),
    6: ("Open paper birch forest", "#689F38"),
    7: ("Open quacking aspen forest", "#43A047"),
    8: ("Open balsam poplar forest", "#2E7D32"),
    9: ("Closed paper birch-quacking aspen forest", "#1565C0"),
    10: ("Open paper birch - quacking aspen forest", "#0288D1"),
    11: ("Open spruce - balsam poplar forest", "#6D4C41"),
    12: ("Open spruce - paper birch forest", "#8D6E63"),
    13: ("Closed spruce - paper birch- quacking aspen forest", "#FFA000"),
    14: ("Closed tall alder", "#8D6E63"),
    15: ("Others (bare/impervious/non-fuel)", "#424242"),
    16: ("Wetlands", "#01579B"),
    17: ("Grass / Shrub", "#7CB342"),
}

# Fire risk consolidation (5 classes: 4 risk + No Data)
VEGETATION_TO_FIRE_RISK = {
    0: 0,                                   # No Data / Water
    3: 1, 4: 1, 13: 1,                      # Very High: closed spruce
    1: 2, 2: 2, 5: 2, 11: 2, 12: 2, 17: 2,  # High: open conifer, mixes, grass/shrub
    6: 3, 7: 3, 8: 3, 9: 3, 10: 3,          # Moderate: pure deciduous
    14: 4, 15: 4, 16: 4,                    # Low: alder, others, wetlands
}

FIRE_RISK_LEGEND = {
    0: ("No Data/Water", "#000000"),
    1: ("Very High Risk - Dense Conifer", "#FF0000"),
    2: ("High Risk - Open Conifer / Mix / Grass-Shrub", "#FFA500"),
    3: ("Moderate Risk - Deciduous", "#FFFF00"),
    4: ("Low Risk - Alder / Wetland / Non-fuel", "#00FF00"),
}

# Risk weights (0-100) (Not set in stone)
VEGETATION_TO_WEIGHT = {
    0: 0,                                   # No Data / Water
    3: 100, 4: 100, 13: 100,                # Very High - closed conifer, max fuel
    1: 80, 2: 80, 5: 80, 17: 80,            # High - open conifer; flashy grass
    11: 65, 12: 65,                         # Mod-High - spruce-deciduous mix
    6: 45, 7: 45, 8: 45, 9: 45, 10: 45,     # Moderate - pure deciduous
    14: 20, 15: 20, 16: 20,                 # Low - alder / residual others / wetlands
}

RADIUS = 2  # focal_mean radius in pixels ("adjacent fuels matter")
FOCAL_PALETTE = ["green", "yellow", "orange", "red"]

_layers: Dict[str, Any] = {"at": 0.0, "value": None}


def _vegetation_layer() -> ee.Image:
    """Cell 0, Layer A: original vegetation, remapped to 0-based for the palette."""
    values = list(VEGETATION_LEGEND.keys())
    return ee.Image(VEG_ASSET).remap(values, list(range(len(values))))


def _fire_risk_layer() -> ee.Image:
    """Cell 0, Layer B: vegetation consolidated into the 5 fire risk classes."""
    veg_risk = ee.Image(VEG_ASSET).remap(
        list(VEGETATION_TO_FIRE_RISK.keys()), list(VEGETATION_TO_FIRE_RISK.values())
    )
    # Set any values outside 0-4 to 0 (No Data), then fill masked areas with 0
    valid_mask = veg_risk.gte(0).And(veg_risk.lte(4))
    veg_risk_clean = veg_risk.where(valid_mask, veg_risk).where(valid_mask.Not(), 0).unmask(0)
    values = list(FIRE_RISK_LEGEND.keys())
    return veg_risk_clean.remap(values, list(range(len(values))))


def _focal_risk_layer(parcels: ee.FeatureCollection) -> ee.Image:
    """Cell 1: weighted risk raster, focal mean, clipped to the parcels."""
    risk_weight_img = ee.Image(VEG_ASSET).select('b1').remap(
        list(VEGETATION_TO_WEIGHT.keys()), list(VEGETATION_TO_WEIGHT.values())
    ).unmask(0).float()
    return risk_weight_img.focal_mean(radius=RADIUS, units='pixels').clip(parcels)


def _tile_url(image: ee.Image, vis: Dict[str, Any]) -> str:
    return image.getMapId(vis)["tile_fetcher"].url_format


def _build_layers() -> List[Dict[str, Any]]:
    ensure_initialized()
    parcels = ee.FeatureCollection(PARCEL_ASSET)
    veg_palette = [color for _, color in VEGETATION_LEGEND.values()]
    risk_palette = [color for _, color in FIRE_RISK_LEGEND.values()]
    return [
        {"name": "Original Vegetation Classes (18)", "shown": False,
         "url": _tile_url(_vegetation_layer(), {"min": 0, "max": len(veg_palette) - 1, "palette": veg_palette})},
        {"name": "Fire Risk Classes (5)", "shown": True,
         "url": _tile_url(_fire_risk_layer(), {"min": 0, "max": len(risk_palette) - 1, "palette": risk_palette})},
        {"name": "Focal risk (weighted)", "shown": False,
         "url": _tile_url(_focal_risk_layer(parcels), {"min": 0, "max": 100, "palette": FOCAL_PALETTE})},
        {"name": "FNSB Tax Parcels", "shown": True,
         "url": _tile_url(parcels.style(color='#FF0000', fillColor='#00000000', width=0.9), {})},
    ]


def _sample_point(lat: float, lon: float) -> Dict[str, Any]:
    """The click inspector's sample, plus the parcel numbers under the point."""
    ensure_initialized()
    point = ee.Geometry.Point([lon, lat])
    return ee.Dictionary({
        "veg": ee.Image(VEG_ASSET).sample(point, scale=10).first(),
        "pans": ee.FeatureCollection(PARCEL_ASSET).filterBounds(point).aggregate_array("PAN"),
    }).getInfo()


async def _run_ee(fn, *args) -> Any:
    """Runs a blocking Earth Engine call off the event loop. Errors come back as {ok: False}."""
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=TIMEOUT_SECONDS)
    except GeeNotConfigured as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"Earth Engine query failed: {e!r}"}


def _find_parcels(query: Dict[str, Any], include_geometry: bool = False) -> List[Dict[str, Any]]:
    projection = {"_id": 0} if include_geometry else {"_id": 0, "geometry": 0}
    return list(parcel_col.find(query, projection).limit(MAX_PARCEL_MATCHES))


async def get_layers() -> Dict[str, Any]:
    """Tile URLs for the notebook's map layers, plus the fire risk legend."""
    if _layers["value"] is None or time.time() - _layers["at"] > LAYER_CACHE_SECONDS:
        layers = await _run_ee(_build_layers)
        if isinstance(layers, dict):
            return layers
        _layers.update(value=layers, at=time.time())
    legend = [{"name": n, "color": c} for n, c in FIRE_RISK_LEGEND.values()]
    return {"ok": True, "layers": _layers["value"], "legends": {"fire_risk": legend}}


async def vegetation_at(lat: float, lon: float) -> Dict[str, Any]:
    """What the notebook's click inspector shows, plus the parcel scores there."""
    sample = await _run_ee(_sample_point, lat, lon)
    if sample.get("ok") is False:
        return sample
    try:
        parcels = _find_parcels({"PAN": {"$in": sample.get("pans") or []}})
    except PyMongoError:
        parcels = []
    result: Dict[str, Any] = {"ok": True, "lat": lat, "lon": lon, "parcels": parcels}

    if sample.get("veg") is None:
        result.update(no_data=True, message="Water / No Data: this area contains no vegetation data.")
        return result

    veg_value = sample["veg"]["properties"].get("b1")
    risk_value = VEGETATION_TO_FIRE_RISK.get(veg_value, 0)
    risk_name, risk_color = FIRE_RISK_LEGEND.get(risk_value, ("Unknown", "#000000"))
    result.update(
        vegetation_class=veg_value,
        vegetation=VEGETATION_LEGEND.get(veg_value, (f"Unknown ({veg_value})",))[0],
        risk_level=risk_value,
        risk_name=risk_name,
        risk_color=risk_color,
        weight=VEGETATION_TO_WEIGHT.get(veg_value),
    )
    return result


def parcel_fire_risk(pan: int, include_geometry: bool = False) -> Dict[str, Any]:
    """Every exported record with this parcel number, as the notebook scored it."""
    try:
        parcels = _find_parcels({"PAN": pan}, include_geometry)
        total = parcel_col.count_documents({"PAN": pan})
    except PyMongoError as e:
        return {"ok": False, "error": f"Parcel lookup failed: {e}"}
    if not parcels:
        return {"ok": False, "error": f"No parcel with PAN {pan}."}
    return {"ok": True, "pan": pan, "total": total, "parcels": parcels}
