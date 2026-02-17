import os
from typing import Optional, List, Dict, Any
from pymongo import MongoClient

mongo_uri = os.getenv("MONGODB_URI")
if not mongo_uri:
    raise ValueError("MONGODB_URI not set")

client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)

db_name = os.getenv("MONGODB_DB", "fireaid")
db = client[db_name]
collection = db["ak_points"]


def search_fire_points(
    year: Optional[int] = None,
    prescribed: Optional[str] = None,  # "Y" / "N"
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
