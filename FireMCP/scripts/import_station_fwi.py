"""Import the Parcel Fire Risk app's station FWI into MongoDB station_fwi.

Reads one CSV per station, <STID>.csv, holding that station's tab of the
"Physical Station Daily Downloads" Sheet as the notebook reads it. Builds the
notebook's FWI table (2018 on, Feb 1 to Oct 31, gaps of up to 5 days filled)
and keeps each day's own Sheet values, which the app uses before the table.

One document per date:
  fwi    {station: FWI}  the Sheet value, else the table value
  sheet  stations whose value is the Sheet's own (the rest are table-filled)
  table  true for dates in the notebook's table

Usage, inside the FireMCP container:
    docker cp station_tabs firemcp:/tmp/
    docker exec firemcp python scripts/import_station_fwi.py /tmp/station_tabs
"""

import csv
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.parcel_risk import STIDS, YEAR_MIN, fwi_col  # noqa: E402


def canon(c):
    c = str(c).strip().lower()
    if c in ("stid", "station", "stationid", "stn", "code"): return "stid"
    if c in ("dattim", "valid", "datetime", "date", "time"): return "dattim"
    return c


def load_tab(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    clean = [r for r in rows if any(r) and not str(r[0]).strip().startswith(("!", "#"))]
    if len(clean) < 2:
        return pd.DataFrame()
    d = pd.DataFrame(clean[1:], columns=[canon(c) for c in clean[0]])
    return d.loc[:, ~d.columns.duplicated()]


def build(folder):
    frames = []
    for stid in STIDS:
        d = load_tab(os.path.join(folder, f"{stid}.csv"))
        if d.empty or "fwi" not in d.columns or "dattim" not in d.columns:
            print(f"  {stid}: no fwi or date column")
            continue
        d["stid"] = stid
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    df["date"] = pd.to_datetime(
        df["dattim"].astype(str).str.split(".").str[0]
          .str.replace(r"\D", "", regex=True).str[:8],
        format="%Y%m%d", errors="coerce")
    df["fwi"] = pd.to_numeric(df["fwi"], errors="coerce")
    raw = df.dropna(subset=["date", "fwi"]).drop_duplicates(["stid", "date"], keep="last")
    raw = raw[raw.date.dt.month.between(2, 10)]

    t = raw[raw.date.dt.year >= YEAR_MIN].sort_values(["stid", "date"])
    table = t.pivot(index="date", columns="stid", values="fwi").sort_index().reindex(columns=STIDS).ffill(limit=5)
    print(f"FWI table: {table.shape[0]:,} days x {table.shape[1]} stations "
          f"({table.index.min().date()} to {table.index.max().date()})")

    sheet = raw.pivot(index="date", columns="stid", values="fwi").reindex(columns=STIDS)
    docs = []
    for day in sheet.index.union(table.index):
        own = sheet.loc[day].dropna() if day in sheet.index else pd.Series(dtype=float)
        filled = table.loc[day].dropna() if day in table.index else pd.Series(dtype=float)
        fwi = {**{s: float(v) for s, v in filled.items()}, **{s: float(v) for s, v in own.items()}}
        docs.append({"_id": day.strftime("%Y-%m-%d"), "fwi": fwi, "sheet": list(own.index), "table": day in table.index})
    return docs


if __name__ == "__main__":
    docs = build(sys.argv[1])
    fwi_col.drop()
    fwi_col.insert_many(docs)
    print(f"station_fwi: {len(docs):,} documents")
