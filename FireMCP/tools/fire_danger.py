"""Daily Alaska fire danger: FWI codes from snowmelt to the requested days, rated
with the AICC adjective tables."""

import datetime as dt
from typing import Optional

from tools import fwi
from tools.fire_danger_rating import rate, table_for
from tools.open_meteo import OpenMeteoError, noon_weather, search_alaska_places, today

EARLIEST = dt.date(2000, 1, 1)
MAX_LEAD_DAYS = 11  # keeps a 5-day window inside the 16-day forecast
ONE_DAY = dt.timedelta(days=1)
# Reanalysis snow depth lingers at about 1 cm for days after melt-out.
SNOW_FREE_M = 0.02


def find_startup(snow_by_date: dict[dt.date, float], year: int) -> Optional[dt.date]:
    """The first day on/after Apr 1 that completes 3 straight snow-free days."""
    run, day = 0, dt.date(year, 4, 1)
    while day in snow_by_date:
        run = run + 1 if snow_by_date[day] < SNOW_FREE_M else 0
        if run == 3:
            return day
        day += ONE_DAY
    return None


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
                 today: dt.date) -> list[dict]:
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
            entry["status"] = "snow"
        else:
            ind = indices_by_day[day]
            entry["rating"] = rate(table, ffmc=ind["ffmc"], isi=ind["isi"], bui=ind["bui"], fwi=ind["fwi"],
                                   temp_f=shown["temp_f"])
            entry["indices"] = {k: round(v, 1) for k, v in ind.items()}
            entry["reasons"] = _reasons(ind, shown)
        days.append(entry)
    return days


def danger_forecast(lat: float, lon: float, target: Optional[dt.date] = None, days: int = 5) -> dict:
    now = today()
    target = target or now
    latest = now + dt.timedelta(days=MAX_LEAD_DAYS)
    if not EARLIEST <= target <= latest:
        return {"ok": False, "error": f"date must be between {EARLIEST.isoformat()} and {latest.isoformat()}"}
    window = [target + dt.timedelta(days=i) for i in range(days)]
    in_season = any(table_for(day.month) for day in window)
    fetch_start = min(dt.date(target.year, 4, 1), window[0]) if in_season else window[0]
    weather = noon_weather(lat, lon, fetch_start, window[-1])
    startup = find_startup({d: w["snow_depth_m"] for d, w in weather.items()}, target.year) if in_season else None
    return {
        "ok": True,
        "latitude": lat,
        "longitude": lon,
        "date": target.isoformat(),
        "season_start": startup.isoformat() if startup else None,
        "rating_system": "Canadian Fire Weather Index with Alaska (AICC) grass/spruce adjective ratings",
        "days": compute_days(weather, window, startup, now),
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
