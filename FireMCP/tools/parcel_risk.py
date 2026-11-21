"""Parcel fire risk for the Fairbanks North Star Borough.

The main map of the parcel fire risk notebook (cells 2-3 and 7-10), live from Earth Engine:
RISK = 0.35 FUEL + 0.15 EXPO + 0.15 SLOPE + 0.35 FWI, at 10 m on EPSG:3338.
A day's station FWI comes from live AKFF first, then Mongo station_fwi
(the notebook's Sheet and table, loaded by scripts/import_station_fwi.py).
"""
import asyncio
import io
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from functools import lru_cache
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import ee
import httpx
import pandas as pd
from pymongo.errors import PyMongoError
from tools.gee_client import GeeNotConfigured, ensure_initialized
from tools.mongo_fire_tools import db

DATA_PROJECT = os.getenv("PARCEL_RISK_EE_PROJECT", "fireaid-507818")
VEG_ASSET = f"projects/{DATA_PROJECT}/assets/FNSB_veg"
PARCEL_ASSET = f"projects/{DATA_PROJECT}/assets/FNSB_Tax_Parcels"
MGMT_ASSET = "projects/fireaid-508301/assets/AK_Fire_Management_Options_FNSB"
DEM_ID = "USGS/3DEP/10m_collection"
MTBS_ID = "USFS/GTAC/MTBS/burned_area_boundaries/v1"

TIMEOUT_SECONDS = 60
# Earth Engine map ids stop working after a while, so rebuild them hourly.
LAYER_CACHE_SECONDS = 3600

fwi_col = db["station_fwi"]

# Cell 2
WORK_CRS, WORK_SCALE = "EPSG:3338", 10
W_FUEL, W_EXPO, W_SLOPE, W_FWI = 0.35, 0.15, 0.15, 0.35
# Cell 6's caps (p95 slope, p98 FWI) as the notebook's saved cache holds them.
SLOPE_CAP, FWI_CAP = 28.0, 30.7
STIDS = ["CPKA2", "CHTA2", "PAFA", "FRBA2", "BKSA2",
         "PAEI", "LXRA2", "STUA2", "AGLA2", "SLRA2", "BDRA2", "BONA2", "BENA2"]
STATION_META = {
    "PAFA":  (64.80389, -147.87611), "FRBA2": (64.84869, -147.57446),
    "PAEI":  (64.65000, -147.10000), "LXRA2": (64.65417, -146.92606),
    "CHTA2": (65.01933, -148.58333), "AGLA2": (65.02000, -146.22806),
    "CPKA2": (65.19183, -147.50017), "SLRA2": (64.59392, -146.14583),
    "STUA2": (64.71828, -146.50183), "BKSA2": (64.38583, -147.69528),
    "BDRA2": (64.64451, -146.44540), "BONA2": (64.74296, -148.31635),
    "BENA2": (65.28333, -143.06667),
}
R_OUT, R_IN = 100, 15
YEAR_MIN = 2018
AKFF_URL = "https://akff.mesowest.org/download/"
# AKFF rejects a bare request; without the Referer and Origin it returns an error page.
AKFF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": "https://akff.mesowest.org/download/",
    "Origin": "https://akff.mesowest.org",
}

# Cell 3: class -> (name, colour, fuel weight)
VEGETATION = {
    0:  ("No Data / Water", "#000000", 0),
    1:  ("Open black spruce forest", "#004D40", 80),
    2:  ("Black spruce woodland", "#1E88E5", 80),
    3:  ("Closed black spruce forest", "#003300", 100),
    4:  ("Closed white spruce forest", "#3949AB", 100),
    5:  ("White spruce woodland", "#5E35B1", 80),
    6:  ("Open paper birch forest", "#689F38", 45),
    7:  ("Open quaking aspen forest", "#43A047", 45),
    8:  ("Open balsam poplar forest", "#2E7D32", 45),
    9:  ("Closed paper birch - quaking aspen forest", "#1565C0", 45),
    10: ("Open paper birch - quaking aspen forest", "#0288D1", 45),
    11: ("Open spruce - balsam poplar forest", "#6D4C41", 65),
    12: ("Open spruce - paper birch forest", "#8D6E63", 65),
    13: ("Closed spruce - paper birch - quaking aspen forest", "#FFA000", 100),
    14: ("Closed tall alder", "#5D4037", 20),
    15: ("Others (bare / impervious / non-fuel)", "#424242", 20),
    16: ("Wetlands", "#01579B", 20),
    17: ("Grass / Shrub", "#7CB342", 80),
}

# Cell 9
BANDS = [(0, 25, "2c7bb6", "Low"),
         (25, 40, "abd9e9", "Moderate"),
         (40, 55, "ffffbf", "Elevated"),
         (55, 70, "fdae61", "High"),
         (70, 101, "d7191c", "Very high")]
POLICY = {
    "C": ("CRITICAL (Highest Priority)", "#FF0000"),
    "F": ("FULL (High Priority)",        "#FFA500"),
    "M": ("MODIFIED (Flexible/Seasonal)", "#B59B00"),
    "L": ("LIMITED (Lowest Priority)",   "#00AA00"),
    "U": ("UNPLANNED",                   "#888888"),
}
MEAN_BANDS = ["RISK", "FUEL", "EXPO", "SLOPE_PCT", "FWI_PCT"]

_layers: Dict[str, Any] = {"at": 0.0, "value": None}
# The notebook keeps each fetched day in memory; clicks reuse the last Update Map's values.
_days: Dict[str, Dict[str, Any]] = {}


def _circle_mean(img: ee.Image, radius: int) -> ee.Image:
    return img.convolve(ee.Kernel.circle(radius=radius, units="meters", normalize=True))


def _dist2(x: ee.Image, y: ee.Image, stid: str) -> ee.Image:
    c = ee.Geometry.Point([STATION_META[stid][1], STATION_META[stid][0]]).transform(WORK_CRS, 1).coordinates()
    return (x.subtract(ee.Image.constant(ee.Number(c.get(0)))).pow(2)
             .add(y.subtract(ee.Image.constant(ee.Number(c.get(1)))).pow(2)).toDouble())


@lru_cache(maxsize=1)
def _model() -> Dict[str, Any]:
    """Cells 7-9's fixed images and collections."""
    ensure_initialized()
    parcels = ee.FeatureCollection(PARCEL_ASSET)
    bound = (parcels.geometry().convexHull(100)
             .transform(WORK_CRS, 1).buffer(150).transform("EPSG:4326", 1))
    # Same outline, computed once; left lazy, every clipped layer recomputes the hull.
    bound = ee.Geometry(bound.getInfo())
    dem = (ee.ImageCollection(DEM_ID).select("elevation").mosaic()
           .setDefaultProjection(WORK_CRS, None, WORK_SCALE))
    veg = ee.Image(VEG_ASSET).select("b1").setDefaultProjection(WORK_CRS, None, WORK_SCALE)
    fuel = veg.remap(list(VEGETATION), [w for _, _, w in VEGETATION.values()],
                     defaultValue=0).clamp(0, 100).rename("FUEL")
    k = (R_IN ** 2) / (R_OUT ** 2)
    expo = (_circle_mean(fuel, R_OUT).subtract(_circle_mean(fuel, R_IN).multiply(k))
            .divide(1 - k).clamp(0, 100).rename("EXPO"))
    slope_pct = (ee.Terrain.slope(dem).rename("slope")
                 .multiply(100.0 / SLOPE_CAP).clamp(0, 100).rename("SLOPE_PCT"))
    static = (fuel.multiply(W_FUEL).add(expo.multiply(W_EXPO))
              .add(slope_pct.multiply(W_SLOPE)).rename("STATIC"))

    xy = ee.Image.pixelCoordinates(ee.Projection(WORK_CRS).atScale(WORK_SCALE))
    x, y = xy.select("x").multiply(WORK_SCALE), xy.select("y").multiply(WORK_SCALE)
    d2 = {s: _dist2(x, y, s) for s in STIDS}
    all_d2, all_id = ee.Image(1e30).toDouble(), ee.Image(0).toByte()
    for i, s in enumerate(STIDS, start=1):
        closer = d2[s].lt(all_d2)
        all_d2, all_id = all_d2.where(closer, d2[s]), all_id.where(closer, i)

    try:
        ee.data.getAsset(MGMT_ASSET)
        mgmt = (ee.FeatureCollection(MGMT_ASSET)
                .map(lambda f: f.setGeometry(f.geometry().transform("EPSG:4326", 1)))
                .filterBounds(bound))
    except ee.EEException:
        mgmt = None  # the notebook leaves the protection line at UNPLANNED
    return {"parcels": parcels, "bound": bound, "dem": dem, "veg": veg, "fuel": fuel, "expo": expo,
            "slope_pct": slope_pct, "static": static, "d2": d2, "dom_all": all_id.rename("DOM_SID_ALL"),
            "mgmt": mgmt}


def _tile_url(image: ee.Image, vis: Dict[str, Any]) -> str:
    return image.getMapId(vis)["tile_fetcher"].url_format


def _build_layers() -> Dict[str, Any]:
    """Cells 9-10's fixed layers, in the notebook's order."""
    m = _model()
    empty, bound = ee.Image().byte(), m["bound"]
    base = [
        {"name": "elevation", "shown": False,
         "url": _tile_url(m["dem"].clip(bound), {"min": 100, "max": 800, "palette": ["black", "white"]})},
        {"name": "vegetation", "shown": False,
         "url": _tile_url(m["veg"].clip(bound), {"min": 0, "max": 17, "palette": [c for _, c, _ in VEGETATION.values()]})},
    ]
    if m["mgmt"] is not None:
        def tag(f):
            p = ee.String(f.get("PROT")).trim()
            return f.set("mgmt_code", ee.Algorithms.If(p.equals("C"), 1, ee.Algorithms.If(p.equals("F"), 2,
                         ee.Algorithms.If(p.equals("M"), 3, ee.Algorithms.If(p.equals("L"), 4, 5)))))
        fill = empty.paint(featureCollection=m["mgmt"].map(tag), color="mgmt_code")
        fill = fill.updateMask(fill.gt(0)).clip(bound)
        base += [
            {"name": "mgmt options (filled)", "shown": False,
             "url": _tile_url(fill, {"min": 1, "max": 5, "opacity": 0.35,
                                     "palette": ["#FF0000", "#FFA500", "#FFFF00", "#00AA00", "#888888"]})},
            {"name": "mgmt boundaries", "shown": False,
             "url": _tile_url(empty.paint(m["mgmt"], 1, 2).clip(bound), {"palette": ["#222222"]})},
        ]
    # Cell 10's AFS branch always fails (geemap.geojson_to_ee is missing), so the map shows MTBS.
    fires = ee.FeatureCollection(MTBS_ID).filterBounds(bound).filter(ee.Filter.gte("Ig_Date", 946684800000))
    base.append({"name": "fire perimeters", "shown": True,
                 "url": _tile_url(empty.paint(fires, 1, 3), {"palette": ["#ff5500"]})})
    parcels = {"name": "parcels", "shown": True, "opacity": 0.45,
               "url": _tile_url(m["parcels"].style(color="000000", fillColor="00000000", width=0.7), {})}
    return {"base": base, "parcels": parcels}


def _akff(stid: str, day: date) -> Optional[float]:
    """Cell 9's live AKFF fetch of one station's FWI for one day."""
    ymd = day.strftime("%Y%m%d")
    yr, mo, dy = day.strftime("%Y"), day.strftime("%m"), str(day.day)
    payload = [
        ("dtype", "daily"), ("stid", stid),
        ("sy-h", yr), ("sm-h", mo), ("sd-h", dy), ("sh-h", "0"),
        ("ey-h", yr), ("em-h", mo), ("ed-h", dy), ("eh-h", "23"),
        ("sy-h", yr), ("sm-h", mo), ("sd-h", dy), ("sh-h", "0"),
        ("ey-h", yr), ("em-h", mo), ("ed-h", dy), ("eh-h", "23"),
        ("sy-d", yr), ("sm-d", mo), ("sd-d", dy),
        ("ey-d", yr), ("em-d", mo), ("ed-d", dy),
        ("daily-startdate", ymd), ("daily-enddate", ymd),
    ]
    try:
        r = httpx.post(AKFF_URL, headers=AKFF_HEADERS, content=urlencode(payload), timeout=6, follow_redirects=True)
        if r.status_code == 200:
            lines = [l for l in r.text.splitlines() if l.strip() and not l.startswith(("!", "#"))]
            if len(lines) >= 2:
                sep = "\t" if "\t" in lines[0] else ","
                d = pd.read_csv(io.StringIO("\n".join(lines)), dtype=str, sep=sep, on_bad_lines="skip", engine="python")
                d.columns = [c.strip().upper() for c in d.columns]
                if "FWI" in d.columns:
                    v = pd.to_numeric(d["FWI"], errors="coerce").dropna()
                    if len(v):
                        return float(v.iloc[-1])
    except Exception:
        pass
    return None


def _fetch_day(day: str) -> Dict[str, Any]:
    """Cell 9's fetch_fwi_with_sources: live AKFF, then the Sheet, then the cached table."""
    with ThreadPoolExecutor(len(STIDS)) as pool:
        live = dict(zip(STIDS, pool.map(lambda s: _akff(s, date.fromisoformat(day)), STIDS)))
    doc = fwi_col.find_one({"_id": day}) or {"fwi": {}, "sheet": []}
    # The notebook's in-memory table holds the last fetch of this day, else the imported table.
    cached = _days[day]["fwi"] if day in _days else {s: v for s, v in doc["fwi"].items() if s not in doc["sheet"]}
    fwi, sources = {}, {}
    for s in STIDS:
        if live[s] is not None:
            fwi[s], sources[s] = live[s], "🌐 Live MesoWest Web"
        elif s in doc["sheet"]:
            fwi[s], sources[s] = doc["fwi"][s], "📊 Google Sheet"
        elif s in cached:
            fwi[s], sources[s] = cached[s], "📊 Google Sheet (Cached)"
        else:
            sources[s] = "⚠️ Offline"
    entry = {"fwi": fwi, "sources": sources}
    if fwi:
        _days[day] = entry
    return entry


def _day_stack(fwi: Dict[str, float]) -> ee.Image:
    """Cell 8's build_day_stack: each pixel takes the nearest station that reported."""
    m = _model()
    best_d2, best_fwi = ee.Image(1e30).toDouble(), ee.Image(0.0).toDouble()
    for s in (s for s in STIDS if s in fwi):
        val_pct = min(max(fwi[s] * (100.0 / FWI_CAP), 0.0), 100.0)
        closer = m["d2"][s].lt(best_d2)
        best_d2 = best_d2.where(closer, m["d2"][s])
        best_fwi = best_fwi.where(closer, val_pct)
    fwi_pct = best_fwi.rename("FWI_PCT")
    risk = m["static"].add(fwi_pct.multiply(W_FWI)).clamp(0, 100).rename("RISK")
    return (risk.addBands(m["fuel"]).addBands(m["expo"]).addBands(m["slope_pct"])
            .addBands(fwi_pct).addBands(m["dom_all"]))


def _render(day: str) -> Dict[str, Any]:
    """Cell 9's render for an in-season date: risk bands, station dots and the borough line."""
    m, entry = _model(), _fetch_day(day)
    fwi, sources = entry["fwi"], entry["sources"]
    stations = [{"stid": s, "lat": STATION_META[s][0], "lon": STATION_META[s][1],
                 "fwi": fwi.get(s), "source": sources[s]} for s in STIDS]
    if not fwi:
        return {"status": "no_data", "stations": stations}

    risk = _day_stack(fwi).select("RISK")
    img = (ee.Image(0).where(risk.gte(25), 1).where(risk.gte(40), 2)
           .where(risk.gte(55), 3).where(risk.gte(70), 4))
    img = img.updateMask(m["veg"].neq(0)).rename("risk").clip(m["bound"])
    dots = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Point([STATION_META[s][1], STATION_META[s][0]]),
                   {"style": {"color": c, "pointSize": 8, "width": 2, "fillColor": c}})
        for s, c in ((s, "#0055ff" if s in fwi else "#888888") for s in STIDS)])
    pct = risk.updateMask(m["veg"].neq(0)).reduceRegion(
        reducer=ee.Reducer.percentile([50, 90]), geometry=m["bound"], crs=WORK_CRS,
        scale=100, maxPixels=1e7, bestEffort=True, tileScale=4).getInfo() or {}
    return {
        "status": "ok", "stations": stations,
        "risk": {"name": "risk", "shown": True, "opacity": 0.75,
                 "url": _tile_url(img, {"min": 0, "max": 4, "palette": [c for _, _, c, _ in BANDS]})},
        "dots": {"name": "stations", "shown": True, "url": _tile_url(dots.style(styleProperty="style"), {})},
        "p50": float(pct.get("RISK_p50", 0.0) or 0.0), "p90": float(pct.get("RISK_p90", 0.0) or 0.0),
    }


def _last_date() -> Optional[str]:
    try:
        doc = fwi_col.find_one({"table": True}, sort=[("_id", -1)])
    except PyMongoError as e:
        raise ValueError(f"Station FWI database unavailable: {e}") from e
    return doc["_id"] if doc else None


def _in_season(day: str) -> bool:
    """Stations only record FWI from Feb 1 to Oct 31."""
    return 2 <= int(day[5:7]) <= 10


def _check_day(day: Optional[str]) -> str:
    """The date as YYYY-MM-DD; the notebook's map opens on the table's last date."""
    day = day or _last_date()
    if not day:
        raise ValueError("No station FWI loaded; run scripts/import_station_fwi.py.")
    return date.fromisoformat(day).isoformat()


async def _run_ee(fn, *args) -> Any:
    """Runs a blocking Earth Engine call off the event loop. Errors come back as {ok: False}."""
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=TIMEOUT_SECONDS)
    except GeeNotConfigured as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"Earth Engine query failed: {e!r}"}


async def get_layers(day: Optional[str] = None) -> Dict[str, Any]:
    """Cell 9's Update Map for one date: map layers, station dots, sources and the borough line."""
    try:
        day, last_date = _check_day(day), _last_date()
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    if _layers["value"] is None or time.time() - _layers["at"] > LAYER_CACHE_SECONDS:
        fixed = await _run_ee(_build_layers)
        if fixed.get("ok") is False:
            return fixed
        _layers.update(value=fixed, at=time.time())
    fixed = _layers["value"]
    out = {"ok": True, "date": day, "last_date": last_date, "fwi_cap": FWI_CAP,
           "legend": [{"name": n, "color": f"#{c}"} for _, _, c, n in BANDS]}
    if not _in_season(day):
        return {**out, "status": "off_season", "layers": fixed["base"] + [fixed["parcels"]]}
    day_layers = await _run_ee(_render, day)
    if day_layers.get("ok") is False:
        return day_layers
    if day_layers["status"] == "no_data":
        return {**out, **day_layers, "layers": fixed["base"] + [fixed["parcels"]]}
    risk, dots = day_layers.pop("risk"), day_layers.pop("dots")
    return {**out, **day_layers, "layers": fixed["base"] + [risk, fixed["parcels"], dots]}


def _score(hit: Optional[Dict[str, Any]], day: str, pan_default: Any, include_geometry: bool) -> Dict[str, Any]:
    """Cell 8's score_parcel_geom and cell 9's show_parcel readout for one parcel."""
    if not hit:
        return {"ok": True, "date": day, "pan": None}
    m, props = _model(), hit["properties"]
    geom = ee.Geometry(hit["geometry"])
    # Only the PAN and use leave this function; the asset also holds owner names and addresses.
    out = {"ok": True, "date": day, "pan": props.get("PAN", pan_default),
           "primary_use": props.get("PRIMARY_US", props.get("USE_CLASS", props.get("CLASS", props.get("LAND_USE", "Not Specified")))),
           "score": None}
    if include_geometry:
        out["geometry"] = hit["geometry"]

    fwi = (_days.get(day) or _fetch_day(day))["fwi"]
    if not fwi:
        return out
    stack = _day_stack(fwi)
    kw = dict(geometry=geom, crs=WORK_CRS, scale=WORK_SCALE, maxPixels=1e8, bestEffort=True, tileScale=2)
    info = ee.Dictionary({
        "means": stack.select(MEAN_BANDS).reduceRegion(reducer=ee.Reducer.mean(), **kw),
        "hist": stack.select("DOM_SID_ALL").reduceRegion(reducer=ee.Reducer.frequencyHistogram(), **kw),
        "zone": m["mgmt"].filterBounds(geom.centroid(1)).select(["PROT"], None, False).first() if m["mgmt"] else ee.String("none"),
        "center": geom.centroid(0.001).coordinates(),
    }).getInfo()
    means = info.get("means") or {}
    lon, lat = info["center"]
    out["center"] = [lat, lon]
    if means.get("RISK") is None:
        return out

    dom = (info.get("hist") or {}).get("DOM_SID_ALL") or {}
    if dom:
        top_k, top_cnt = max(dom.items(), key=lambda kv: kv[1])
        total = sum(dom.values())
        stn, share = STIDS[int(float(top_k)) - 1], (float(top_cnt) / float(total) if total > 0 else 1.0)
    else:
        stn, share = "-", 0.0
    zone = info.get("zone")
    code = str(zone["properties"].get("PROT", "U")).strip() if isinstance(zone, dict) else "U"
    label, colour = POLICY.get(code, POLICY["U"])
    r = {b: float(means.get(b, 0.0)) for b in MEAN_BANDS}
    r["RISK"] = round(r["RISK"], 1)
    out["score"] = {
        **r, "NO_VEG": int(r["FUEL"] < 1.0), "STN": stn, "STN_SHARE": share, "STN_ABSENT": stn not in fwi,
        "band": next((n for lo, hi, _, n in BANDS if lo <= r["RISK"] < hi), "-"),
        "points": {"fuel": r["FUEL"] * W_FUEL, "exposure": r["EXPO"] * W_EXPO,
                   "slope": r["SLOPE_PCT"] * W_SLOPE, "fwi": r["FWI_PCT"] * W_FWI},
        "fwi_raw": r["FWI_PCT"] * FWI_CAP / 100,
        "protection_label": label, "protection_color": colour,
    }
    return out


def _parcel_at(lat: float, lon: float, day: str, include_geometry: bool) -> Dict[str, Any]:
    parcels = _model()["parcels"]  # initializes Earth Engine before any ee object is built
    pt = ee.Geometry.Point([lon, lat])
    try:
        hit = parcels.filter(ee.Filter.contains(leftField=".geo", rightValue=pt)).first().getInfo()
    except Exception:
        hit = None
    return _score(hit, day, "Unknown", include_geometry)


def _parcel_by_pan(raw: str, day: str, include_geometry: bool) -> Dict[str, Any]:
    parcels = _model()["parcels"]  # initializes Earth Engine before any ee object is built
    f = ee.Filter.Or(ee.Filter.eq("PAN", raw), ee.Filter.eq("PAN", raw.zfill(7)), ee.Filter.eq("PAN", int(raw)))
    try:
        hit = parcels.filter(f).first().getInfo()
    except Exception:
        hit = None
    return _score(hit, day, int(raw), include_geometry)


def _season_error(day: str) -> Optional[Dict[str, Any]]:
    if not _in_season(day):
        return {"ok": False, "error": f"{day} is off-season: FNSB stations only record FWI from Feb 1 to Oct 31."}
    return None


async def parcel_at(lat: float, lon: float, day: Optional[str] = None, include_geometry: bool = False) -> Dict[str, Any]:
    """The parcel under a point, scored for a day (cell 9's click)."""
    try:
        day = _check_day(day)
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    return _season_error(day) or await _run_ee(_parcel_at, lat, lon, day, include_geometry)


async def parcel_by_pan(pan: str, day: Optional[str] = None, include_geometry: bool = False) -> Dict[str, Any]:
    """A parcel by PAN, scored for a day (cell 9's search)."""
    raw = str(pan).strip().replace("-", "")
    if not raw.isdigit():
        return {"ok": False, "error": f"PAN {pan} not found"}
    try:
        day = _check_day(day)
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    return _season_error(day) or await _run_ee(_parcel_by_pan, raw, day, include_geometry)
