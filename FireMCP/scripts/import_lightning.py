"""Import data for the Lightning and Fire History app into MongoDB.

  lightning_strikes      AICC lightning strikes, 1986-2012
  lightning_fire_points  AICC fire history points

Usage, inside the FireMCP container:
    docker cp <lightning>.geojson <points>.geojson firemcp:/tmp/
    docker exec firemcp python scripts/import_lightning.py /tmp/<lightning>.geojson /tmp/<points>.geojson
"""

import json
import os
import sys

from pymongo import ASCENDING, MongoClient


def load(db, name: str, path: str, date_field: str) -> None:
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    docs = [{**feat["properties"], "geometry": feat.get("geometry")} for feat in features]
    col = db[name]
    col.drop()
    col.insert_many(docs)
    col.create_index([(date_field, ASCENDING)])
    print(f"{name}: {len(docs):,} documents")


if __name__ == "__main__":
    db = MongoClient(os.environ["MONGODB_URI"])["fireaid"]
    load(db, "lightning_strikes", sys.argv[1], "LOCALDATET")
    load(db, "lightning_fire_points", sys.argv[2], "DISCOVERYDATETIME")
