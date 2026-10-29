"""Daily Alaska fire danger: FWI codes from snowmelt to the requested days, rated
with the AICC adjective tables."""

import datetime as dt
import json
import time
from pathlib import Path
from typing import Optional

from tools import fwi
from tools.fire_danger_rating import rate, table_for
from tools.open_meteo import OpenMeteoError, noon_weather, noon_weather_many, search_alaska_places, today

EARLIEST = dt.date(2000, 1, 1)
MAX_LEAD_DAYS = 11  # keeps a 5-day window inside the 16-day forecast
ONE_DAY = dt.timedelta(days=1)
# Reanalysis snow depth lingers at about 1 cm for days after melt-out.
SNOW_FREE_M = 0.02
# CFFDRS start-up rule (Wotton & Flannigan 1993, cffdrs fire_season): 3 days with a daily max above 12C.
WARM_START_C = 12.0

# ~110 x 90 km land cells covering Alaska, generated from Natural Earth.
GRID = json.loads((Path(__file__).parent.parent / "data" / "alaska_grid.json").read_text())
MAP_REFRESH_S = 3600  # maps that include recent days are rebuilt hourly; older ones never change
_map_cache: dict[str, tuple[float, dict]] = {}


def _third_day(weather: dict[dt.date, dict], year: int, ok) -> Optional[dt.date]:
    run, day = 0, dt.date(year, 4, 1)
    while day in weather:
        run = run + 1 if ok(weather[day]) else 0
        if run == 3:
            return day
        day += ONE_DAY
    return None


def find_startup(weather: dict[dt.date, dict], year: int) -> tuple[Optional[dt.date], str]:
    """The first day on/after Apr 1 that completes 3 straight snow-free days.

    A grid cell that still shows snow on Jun 1 usually holds glaciers or peaks
    (Juneau's holds the icefield), so those fall back to the temperature rule.
    """
    melt = _third_day(weather, year, lambda w: w["snow_depth_m"] < SNOW_FREE_M)
    june = dt.date(year, 6, 1)
    if (melt is not None and melt < june) or june not in weather:
        return melt, "snowmelt"
    return _third_day(weather, year, lambda w: w["tmax_c"] > WARM_START_C), "temperature"


def _display(w: dict) -> dict:
    return {
        "temp_f": round(w["temp_c"] * 9 / 5 + 32),
        "humidity": round(w["rh"]),
        "wind_mph": round(w["wind_kmh"] * 0.621371),
        "gust_mph": round(w["gust_kmh"] * 0.621371),
        "rain_in": round(w["rain_mm"] / 25.4, 2),
        "precip_probability": w["precip_probability"],
    }


def _reasons(indices: dict, weather: dict) -> list[str]:
    reasons = []
    if indices["ffmc"] >= 89:
        reasons.append("surface fuels very dry")
    elif indices["ffmc"] >= 86:
        reasons.append("surface fuels dry")
    if indices["bui"] >= 90:
        reasons.append("deep fuels very dry")
    elif indices["bui"] >= 60:
        reasons.append("deep fuels dry")
    if weather["temp_f"] >= 80:
        reasons.append("hot")
    elif weather["temp_f"] >= 70:
        reasons.append("warm")
    if weather["wind_mph"] >= 15:
        reasons.append("windy")
    if weather["humidity"] <= 30:
        reasons.append("very dry air")
    if weather["rain_in"] >= 0.1:
        reasons.append("recent rain")
    return reasons or ["fuels are moist"]


def compute_days(weather: dict[dt.date, dict], window: list[dt.date], startup: Optional[dt.date],
                 today: dt.date, start_rule: str = "snowmelt") -> list[dict]:
    indices_by_day: dict[dt.date, dict] = {}
    if startup is not None:
        f, d, c = fwi.START_FFMC, fwi.START_DMC, fwi.START_DC
        day = startup
        while day <= window[-1]:
            w = weather[day]
            f = fwi.ffmc(f, w["temp_c"], w["rh"], w["wind_kmh"], w["rain_mm"])
            d = fwi.dmc(d, w["temp_c"], w["rh"], w["rain_mm"], day.month)
            c = fwi.dc(c, w["temp_c"], w["rain_mm"], day.month)
            i = fwi.isi(f, w["wind_kmh"])
            b = fwi.bui(d, c)
            indices_by_day[day] = {"ffmc": f, "dmc": d, "dc": c, "isi": i, "bui": b, "fwi": fwi.fwi(i, b)}
            day += ONE_DAY

    days = []
    for day in window:
        shown = _display(weather[day])
        table = table_for(day.month)
        entry = {"date": day.isoformat(), "observed": day < today, "weather": shown,
                 "table": table, "status": "rated", "rating": None, "indices": None, "reasons": []}
        if table is None:
            entry["status"] = "out_of_season"
        elif day not in indices_by_day:
            entry["status"] = "snow" if start_rule == "snowmelt" else "too_cold"
        else:
            ind = indices_by_day[day]
            entry["rating"] = rate(table, ffmc=ind["ffmc"], isi=ind["isi"], bui=ind["bui"], fwi=ind["fwi"],
                                   temp_f=shown["temp_f"])
            entry["indices"] = {k: round(v, 1) for k, v in ind.items()}
            entry["reasons"] = _reasons(ind, shown)
        days.append(entry)
    return days


def _check_date(target: dt.date, now: dt.date) -> Optional[str]:
    latest = now + dt.timedelta(days=MAX_LEAD_DAYS)
    if EARLIEST <= target <= latest:
        return None
    return f"date must be between {EARLIEST.isoformat()} and {latest.isoformat()}"


def _fetch_range(window: list[dt.date], in_season: bool, now: dt.date) -> tuple[dt.date, dt.date]:
    if not in_season:
        return window[0], window[-1]
    year = window[0].year
    # Spring dates also need weather through Jun 1 to tell lasting snow from glaciers.
    june = dt.date(year, 6, 1)
    end = max(window[-1], june) if june <= now + dt.timedelta(days=15) else window[-1]
    return min(dt.date(year, 4, 1), window[0]), end


def danger_forecast(lat: float, lon: float, target: Optional[dt.date] = None, days: int = 5) -> dict:
    now = today()
    target = target or now
    if error := _check_date(target, now):
        return {"ok": False, "error": error}
    window = [target + dt.timedelta(days=i) for i in range(days)]
    in_season = any(table_for(day.month) for day in window)
    weather = noon_weather(lat, lon, *_fetch_range(window, in_season, now))
    startup, start_rule = find_startup(weather, target.year) if in_season else (None, None)
    return {
        "ok": True,
        "latitude": lat,
        "longitude": lon,
        "date": target.isoformat(),
        "season_start": startup.isoformat() if startup else None,
        "season_start_rule": start_rule,
        "rating_system": "Canadian Fire Weather Index with Alaska (AICC) grass/spruce adjective ratings",
        "days": compute_days(weather, window, startup, now, start_rule),
    }


def forecast_for(place: Optional[str], lat: Optional[float], lon: Optional[float], date: Optional[str]) -> dict:
    """danger_forecast for a place name or coordinates, with errors as {ok: False}."""
    try:
        target = dt.date.fromisoformat(date) if date else None
        if lat is None or lon is None:
            matches = search_alaska_places(place) if place else []
            if not matches:
                return {"ok": False, "error": f"No Alaska place found for {place!r}"}
            place, lat, lon = matches[0]["name"], matches[0]["latitude"], matches[0]["longitude"]
        return {"place": place, **danger_forecast(lat, lon, target)}
    except ValueError:
        return {"ok": False, "error": "date must be YYYY-MM-DD"}
    except OpenMeteoError as e:
        return {"ok": False, "error": str(e)}


def danger_map(target: Optional[dt.date] = None) -> dict:
    """The rating for one day in every grid cell."""
    now = today()
    target = target or now
    if error := _check_date(target, now):
        return {"ok": False, "error": error}
    key = target.isoformat()
    cached = _map_cache.get(key)
    recent = target >= now - dt.timedelta(days=7)
    if cached and (not recent or time.time() - cached[0] < MAP_REFRESH_S):
        return cached[1]

    points = [(lat, lon) for lat, lon in GRID["cells"]]
    in_season = table_for(target.month) is not None
    cells = []
    if in_season:
        for (lat, lon), weather in zip(points, noon_weather_many(points, *_fetch_range([target], True, now), gusts=False)):
            startup, rule = find_startup(weather, target.year)
            day = compute_days(weather, [target], startup, now, rule)[0]
            cells.append({"lat": lat, "lon": lon, "status": day["status"], "rating": day["rating"],
                          "fwi": day["indices"]["fwi"] if day["indices"] else None})
    else:
        cells = [{"lat": lat, "lon": lon, "status": "out_of_season", "rating": None, "fwi": None}
                 for lat, lon in points]
    result = {"ok": True, "date": key, "cell_deg": GRID["cell_deg"], "cells": cells}
    _map_cache[key] = (time.time(), result)
    return result


def map_for(date: Optional[str]) -> dict:
    """danger_map with errors as {ok: False}."""
    try:
        target = dt.date.fromisoformat(date) if date else None
    except ValueError:
        return {"ok": False, "error": "date must be YYYY-MM-DD"}
    try:
        return danger_map(target)
    except OpenMeteoError as e:
        return {"ok": False, "error": str(e)}
