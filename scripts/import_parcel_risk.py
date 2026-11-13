#!/usr/bin/env python3

"""
Import the parcel fire risk export (fnsb_parcel_risk.geojson) into MongoDB parcel_risk.
Each GeoJSON feature is stored as-is: its properties, geometry and Earth Engine id.
Replaces the collection, so rerun it with a fresh export when the notebook changes.
Usage: python3 import_parcel_risk.py <path_to_geojson>
"""

import json
import os
import sys

from pymongo import ASCENDING, MongoClient

MONGO_URI = os.getenv(
    "MONGODB_URI", "mongodb://root:password@localhost:27018/fireaid?authSource=admin"
)
DB_NAME = os.getenv("MONGODB_DB", "fireaid")


def import_geojson(filepath: str):
    with open(filepath, encoding="utf-8") as f:
        features = json.load(f)["features"]

    docs = [
        {**feat["properties"], "ee_id": feat.get("id"), "geometry": feat.get("geometry")}
        for feat in features
    ]
    client = MongoClient(MONGO_URI)
    col = client[DB_NAME]["parcel_risk"]
    col.delete_many({})
    col.insert_many(docs)
    col.create_index([("PAN", ASCENDING)])
    print(f"Inserted {col.count_documents({})} documents into parcel_risk.")
    client.close()


if __name__ == "__main__":
    import_geojson(sys.argv[1])
