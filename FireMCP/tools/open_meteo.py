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
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise OpenMeteoError("The weather service's free usage limit was reached. Try again in a few minutes.") from e
        raise OpenMeteoError(f"The weather service returned an error ({e.response.status_code}).") from e
    except (httpx.HTTPError, ValueError) as e:
        raise OpenMeteoError("Couldn't reach the weather service.") from e


def search_alaska_places(name: str, limit: int = 5) -> list[dict]:
    data = _get(GEOCODE_URL, {"name": name, "count": 20, "language": "en", "format": "json"})
    return [
        {"name": r["name"], "latitude": r["latitude"], "longitude": r["longitude"]}
        for r in data.get("results", [])
        if r.get("country_code") == "US" and r.get("admin1") == "Alaska"
    ][:limit]


BATCH_SIZE = 50  # locations per Open-Meteo request


def _hourly(url: str, points: list[tuple[float, float]], params: dict, fields: list[str]) -> list[dict[str, dict]]:
    """Hourly rows keyed by local time, one dict per point, batching many points per request."""
    out = []
    for i in range(0, len(points), BATCH_SIZE):
        chunk = points[i:i + BATCH_SIZE]
        data = _get(url, {**params, "latitude": ",".join(str(p[0]) for p in chunk),
                          "longitude": ",".join(str(p[1]) for p in chunk),
                          "hourly": ",".join(fields), "timezone": TZ_NAME})
        for loc in data if isinstance(data, list) else [data]:
            hourly = loc["hourly"]
            out.append({t: {f: hourly[f][j] for f in fields} for j, t in enumerate(hourly["time"])})
    return out


def _days_from_rows(rows: dict[str, dict], start: dt.date, end: dt.date) -> dict[dt.date, dict]:
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
        day_temps = [rows[t]["temperature_2m"] for t in (f"{day.isoformat()}T{h:02d}:00" for h in range(24))
                     if t in rows and rows[t]["temperature_2m"] is not None]
        days[day] = {
            "temp_c": noon["temperature_2m"],
            "tmax_c": max(day_temps),
            "rh": noon["relative_humidity_2m"],
            "wind_kmh": noon["wind_speed_10m"],
            "gust_kmh": noon.get("wind_gusts_10m") or 0.0,
            "rain_mm": rain,
            "snow_depth_m": noon["snow_depth"] or 0.0,
            "precip_probability": noon.get("precipitation_probability"),
        }
        day += dt.timedelta(days=1)
    return days


def noon_weather_many(points: list[tuple[float, float]], start: dt.date, end: dt.date,
                      gusts: bool = True) -> list[dict[dt.date, dict]]:
    """The 14:00 observation for each day at each point, with rain summed over the 24 h ending then.

    gusts=False skips wind gusts (display only) to keep big requests under the free usage limit.
    """
    fields = HOURLY if gusts else [f for f in HOURLY if f != "wind_gusts_10m"]
    now = today()
    archive_end = min(end, now - dt.timedelta(days=ARCHIVE_LAG_DAYS))
    rows: list[dict[str, dict]] = [{} for _ in points]
    if end > archive_end:
        forecast = _hourly(FORECAST_URL, points, {"past_days": 7, "forecast_days": 16},
                           fields + ["precipitation_probability"])
        for r, f in zip(rows, forecast):
            r.update(f)
    fetch_start = start - dt.timedelta(days=1)
    if fetch_start <= archive_end:
        archive = _hourly(ARCHIVE_URL, points, {"start_date": fetch_start.isoformat(),
                                                "end_date": archive_end.isoformat()}, fields)
        for r, a in zip(rows, archive):
            r.update({t: row for t, row in a.items() if row["temperature_2m"] is not None})
    return [_days_from_rows(r, start, end) for r in rows]


def noon_weather(lat: float, lon: float, start: dt.date, end: dt.date) -> dict[dt.date, dict]:
    return noon_weather_many([(lat, lon)], start, end)[0]
