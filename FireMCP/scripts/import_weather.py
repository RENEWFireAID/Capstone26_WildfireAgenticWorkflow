"""Load the weather grid behind the Weather data page into MongoDB.

The 35 daily weather files (1979 to 2013 or mid-2014, a 7 x 5 grid over the Brooks Range,
68.2-70.1 N, 147.8-149.1 W) were removed from the repo in March 2026 to keep
large CSVs out of git, which left the page's downloads broken. They are still
in git history, so this fetches them from GitHub at the commit that added them
and stores them in two collections the web app serves from:

  weather_stations  one document per grid point: id, lat, lon, elevation,
                    first and last date, day count
  weather_daily     one document per point per day, the original columns

Safe to run again: each point's rows are replaced, not appended. Run it once
inside the FireMCP container, which has MONGODB_URI and pymongo:

    docker exec firemcp python scripts/import_weather.py
"""

import csv
import io
import os
import ssl
import sys
import urllib.request
from datetime import datetime

from pymongo import ASCENDING, MongoClient

COMMIT = "d7952b4"  # feat: add portal, apps, data, weather ... pages
BASE = (
    "https://raw.githubusercontent.com/RENEWFireAID/Capstone26_WildfireAgenticWorkflow/"
    f"{COMMIT}/fireaid_web/public/weather/"
)
LATS = ["682", "685", "688", "692", "695", "698", "701"]
LONS = ["1478", "1481", "1484", "1488", "1491"]

# Original header -> stored field name.
COLUMNS = {
    "Max Temperature": "tmax_c",
    "Min Temperature": "tmin_c",
    "Precipitation": "precip_mm",
    "Wind": "wind_ms",
    "Relative Humidity": "rh_frac",
    "Solar": "solar_mj_m2",
}


try:  # Some Python installs (e.g. python.org on macOS) lack system CA certificates.
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = None


def parse_date(s: str) -> datetime:
    # M/D/YYYY in most files; 682-1478 uses two-digit years (1979-2013).
    m, d, y = (int(p) for p in s.split("/"))
    if y < 100:
        y += 1900 if y >= 70 else 2000
    return datetime(y, m, d)


def number(s: str):
    try:
        return float(s)
    except ValueError:
        return None


def load_station(station_id: str):
    url = f"{BASE}weatherdata-{station_id}.csv"
    with urllib.request.urlopen(url, timeout=60, context=SSL_CONTEXT) as r:
        text = r.read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise RuntimeError(f"{url} is empty")
    first = rows[0]
    station = {
        "_id": station_id,
        "lat": round(float(first["Latitude"]), 4),
        "lon": round(float(first["Longitude"]), 4),
        "elevation_m": number(first["Elevation"]),
    }
    daily = []
    for row in rows:
        doc = {"station": station_id, "date": parse_date(row["Date"])}
        for src, dst in COLUMNS.items():
            doc[dst] = number(row[src])
        daily.append(doc)
    daily.sort(key=lambda d: d["date"])
    station.update(
        first_date=daily[0]["date"],
        last_date=daily[-1]["date"],
        days=len(daily),
        source_file=f"weatherdata-{station_id}.csv",
    )
    return station, daily


def main() -> int:
    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("MONGODB_URI is not set.")
        return 2
    db = MongoClient(uri)["fireaid"]
    stations, daily_col = db["weather_stations"], db["weather_daily"]
    daily_col.create_index([("station", ASCENDING), ("date", ASCENDING)], unique=True)

    total = 0
    for lat in LATS:
        for lon in LONS:
            sid = f"{lat}-{lon}"
            station, daily = load_station(sid)
            daily_col.delete_many({"station": sid})
            daily_col.insert_many(daily, ordered=False)
            stations.replace_one({"_id": sid}, station, upsert=True)
            total += len(daily)
            print(f"{sid}: {len(daily):,} days, {station['first_date']:%Y-%m-%d} to {station['last_date']:%Y-%m-%d}")
    print(f"Loaded {len(LATS) * len(LONS)} grid points, {total:,} daily rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
