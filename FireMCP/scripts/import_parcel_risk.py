#!/usr/bin/env python3

"""
Import the parcel fire risk export (fnsb_parcel_risk.geojson) into MongoDB parcel_risk.
Only the fields the app uses are stored. The borough's parcel data also has owner
names, mailing addresses and assessed values, which must stay out of the database.
Replaces the collection, so rerun it with a fresh export when the notebook changes.
Usage, inside the FireMCP container, which has MONGODB_URI and pymongo:
    docker cp fnsb_parcel_risk.geojson firemcp:/tmp/
    docker exec firemcp python scripts/import_parcel_risk.py /tmp/fnsb_parcel_risk.geojson
"""

import json
import os
import sys

from pymongo import ASCENDING, MongoClient

MONGO_URI = os.getenv(
    "MONGODB_URI", "mongodb://root:password@localhost:27018/fireaid?authSource=admin"
)
DB_NAME = os.getenv("MONGODB_DB", "fireaid")
FIELDS = ("PAN", "PARCEL_SUB", "PARCEL_BLO", "PARCEL_LOT", "PARCEL_TYP", "risk_score")


def import_geojson(filepath: str):
    with open(filepath, encoding="utf-8") as f:
        features = json.load(f)["features"]

    docs = [
        {**{k: v for k, v in feat["properties"].items() if k in FIELDS}, "geometry": feat.get("geometry")}
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
