"""Open-Meteo place search and daily 14:00 weather for Alaska.

The archive API (ERA5) covers dates up to about five days ago; the forecast API
covers the last week and the next 16 days. Archive values win where both exist.
"""

import datetime as dt
from zoneinfo import ZoneInfo

import httpx

TZ_NAME = "America/Anchorage"
TZ = ZoneInfo(TZ_NAME)
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_gusts_10m", "precipitation", "snow_depth"]
ARCHIVE_LAG_DAYS = 6


class OpenMeteoError(Exception):
    pass


def today() -> dt.date:
    return dt.datetime.now(TZ).date()


def _get(url: str, params: dict) -> dict:
    try:
        response = httpx.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as e:
        raise OpenMeteoError(f"Open-Meteo request failed: {e}") from e


def search_alaska_places(name: str, limit: int = 5) -> list[dict]:
    data = _get(GEOCODE_URL, {"name": name, "count": 20, "language": "en", "format": "json"})
    return [
        {"name": r["name"], "latitude": r["latitude"], "longitude": r["longitude"]}
        for r in data.get("results", [])
        if r.get("country_code") == "US" and r.get("admin1") == "Alaska"
    ][:limit]


def _hourly(url: str, params: dict, fields: list[str]) -> dict[str, dict]:
    data = _get(url, {**params, "hourly": ",".join(fields), "timezone": TZ_NAME})
    hourly = data["hourly"]
    return {t: {f: hourly[f][i] for f in fields} for i, t in enumerate(hourly["time"])}


def noon_weather(lat: float, lon: float, start: dt.date, end: dt.date) -> dict[dt.date, dict]:
    """The 14:00 observation for each day, with rain summed over the 24 h ending then."""
    now = today()
    archive_end = min(end, now - dt.timedelta(days=ARCHIVE_LAG_DAYS))
    rows: dict[str, dict] = {}
    if end > archive_end:
        rows.update(_hourly(FORECAST_URL, {"latitude": lat, "longitude": lon, "past_days": 7, "forecast_days": 16},
                            HOURLY + ["precipitation_probability"]))
    fetch_start = start - dt.timedelta(days=1)
    if fetch_start <= archive_end:
        archive = _hourly(ARCHIVE_URL, {"latitude": lat, "longitude": lon, "start_date": fetch_start.isoformat(),
                                        "end_date": archive_end.isoformat()}, HOURLY)
        rows.update({t: row for t, row in archive.items() if row["temperature_2m"] is not None})

    days = {}
    day = start
    while day <= end:
        noon = rows.get(f"{day.isoformat()}T14:00")
        if noon is None or noon["temperature_2m"] is None:
            raise OpenMeteoError(f"No weather available for {day.isoformat()}")
        window_start = dt.datetime.combine(day - dt.timedelta(days=1), dt.time(15))
        rain = sum(
            rows.get((window_start + dt.timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M"), {}).get("precipitation") or 0.0
            for h in range(24)
        )
        days[day] = {
            "temp_c": noon["temperature_2m"],
            "rh": noon["relative_humidity_2m"],
            "wind_kmh": noon["wind_speed_10m"],
            "gust_kmh": noon["wind_gusts_10m"],
            "rain_mm": rain,
            "snow_depth_m": noon["snow_depth"] or 0.0,
            "precip_probability": noon.get("precipitation_probability"),
        }
        day += dt.timedelta(days=1)
    return days
