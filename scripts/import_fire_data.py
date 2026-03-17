#!/usr/bin/env python3
"""
Import AK_fire_location_points_NAD83.csv into MongoDB fire_points collection.
Usage: python3 import_fire_data.py <path_to_csv>
"""
import sys
import csv
import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://root:password@localhost:27018/fireaid?authSource=admin")
DB_NAME   = os.getenv("MONGODB_DB", "fireaid")

def import_csv(filepath: str):
    client = MongoClient(MONGO_URI)
    db  = client[DB_NAME]
    col = db["fire_points"]

    print(f"Connecting to {MONGO_URI}")
    print(f"Reading {filepath}...")

    docs = []
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            doc = {}
            for k, v in row.items():
                if v == "" or v is None:
                    continue
                # Try to cast numbers
                try:
                    doc[k] = int(v)
                    continue
                except ValueError:
                    pass
                try:
                    doc[k] = float(v)
                    continue
                except ValueError:
                    pass
                doc[k] = v
            docs.append(doc)

    print(f"Read {len(docs)} records.")

    if not docs:
        print("No records found. Exiting.")
        return

    # Optional: clear existing data first
    existing = col.count_documents({})
    if existing > 0:
        ans = input(f"Collection already has {existing} documents. Clear before import? (y/N): ")
        if ans.strip().lower() == "y":
            col.delete_many({})
            print("Cleared existing data.")

    result = col.insert_many(docs)
    print(f"Successfully inserted {len(result.inserted_ids)} documents into fire_points.")
    client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 import_fire_data.py <path_to_csv>")
        sys.exit(1)
    import_csv(sys.argv[1])