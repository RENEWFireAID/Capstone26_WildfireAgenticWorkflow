import os
from typing import Any, Dict, List, Optional
from pymongo import MongoClient

# ✅ Default for LOCAL run (Mac terminal)
# In Docker, set MONGODB_URI to: mongodb://root:password@mongo:27017/?authSource=admin
MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://root:password@mongo:27017/?authSource=admin"
)

# Small timeout so it fails fast instead of "silence"
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)

# ✅ Explicit DB name (no ambiguity)
db = client["fireaid"]
collection = db["ak_fire_location_points_raw"]


def search_fire_points(
    year: Optional[int] = None,
    prescribed: Optional[str] = None,   # "Y" / "N"
    org: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Search raw fire location points from MongoDB.
    """
    query: Dict[str, Any] = {}

    if year is not None:
        # FIRESEASON may be stored as "2024" or 2024; handle both
        query["$or"] = [{"FIRESEASON": str(year)}, {"FIRESEASON": year}]

    if prescribed in ("Y", "N"):
        query["PRESCRIBEDFIRE"] = prescribed

    if org:
        query["MGMTORGID"] = org

    limit = max(1, min(int(limit), 100))

    projection = {
        "_id": 0,
        "ID": 1,
        "NAME": 1,
        "FIRESEASON": 1,
        "MGMTORGID": 1,
        "PRESCRIBEDFIRE": 1,
        "LATITUDE": 1,
        "LONGITUDE": 1,
        "MAPNAME": 1,
    }

    return list(collection.find(query, projection).limit(limit))


def count_by_year(year: int) -> Dict[str, int]:
    query = {"$or": [{"FIRESEASON": str(year)}, {"FIRESEASON": year}]}
    return {"year": int(year), "count": collection.count_documents(query)}
