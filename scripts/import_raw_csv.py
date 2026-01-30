#!/usr/bin/env python3
import os
import sys
import datetime as dt
from typing import List

import pandas as pd
from pymongo import MongoClient


def main():
    # ---- Config (env overrides) ----
    csv_path = os.getenv("CSV_PATH", "data/AK_fire_location_points_NAD83.csv")
    mongo_uri = os.getenv(
        "MONGO_URI",
        # host-run default (Docker exposes 27017:27017 in your compose)
        "mongodb://root:password@localhost:27017/?authSource=admin",
    )
    db_name = os.getenv("DB_NAME", "fireaid")
    collection_name = os.getenv("COLLECTION", "ak_fire_location_points_raw")

    drop_first = os.getenv("DROP_FIRST", "true").lower() in ("1", "true", "yes", "y")
    batch_size = int(os.getenv("BATCH_SIZE", "2000"))

    log_dir = os.getenv("LOG_DIR", "scripts")
    os.makedirs(log_dir, exist_ok=True)
    bad_log_path = os.path.join(log_dir, "bad_rows.log")

    if not os.path.exists(csv_path):
        print(f"[ERROR] CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    # ---- Mongo ----
    client = MongoClient(mongo_uri)
    db = client[db_name]
    col = db[collection_name]

    if drop_first:
        print(f"[INFO] Dropping collection: {db_name}.{collection_name}")
        col.drop()

    ingested_at = dt.datetime.utcnow().isoformat() + "Z"

    bad_rows: List[str] = []

    # pandas python-engine can skip malformed CSV rows; we log them via callback
    def on_bad_lines(bad_line: List[str]) -> None:
        # bad_line is a list of fields (best-effort); join to preserve raw-ish
        bad_rows.append(",".join(bad_line))
        return None  # skip this line

    print(f"[INFO] Reading CSV (raw strings): {csv_path}")
    # dtype=str => keep everything raw as string; keep_default_na=False => don't auto-NA
    df = pd.read_csv(
        csv_path,
        dtype=str,
        keep_default_na=False,
        engine="python",
        on_bad_lines=on_bad_lines,
    )

    # Convert to list of dicts (raw)
    records = df.to_dict(orient="records")
    for r in records:
        r["_ingested_at"] = ingested_at
        r["_source_file"] = os.path.basename(csv_path)

    print(f"[INFO] Parsed rows (good): {len(records)}")
    print(f"[WARN] Skipped rows (bad): {len(bad_rows)}")

    # ---- Insert in batches ----
    inserted = 0
    for i in range(0, len(records), batch_size):
        chunk = records[i : i + batch_size]
        if chunk:
            col.insert_many(chunk, ordered=False)
            inserted += len(chunk)
            print(f"[INFO] Inserted: {inserted}/{len(records)}")

    # ---- Write bad rows log ----
    if bad_rows:
        with open(bad_log_path, "w", encoding="utf-8") as f:
            f.write("# Rows skipped due to malformed CSV quoting/format\n")
            f.write(f"# source={csv_path}\n")
            f.write(f"# time_utc={ingested_at}\n\n")
            for line in bad_rows:
                f.write(line + "\n")
        print(f"[WARN] Bad rows saved to: {bad_log_path}")

    # ---- Verify ----
    count = col.count_documents({})
    print(f"[OK] Mongo count: {db_name}.{collection_name} = {count}")


if __name__ == "__main__":
    main()
