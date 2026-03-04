import os
from typing import Any, Dict, List, Optional
from pymongo import MongoClient
import uuid

mongo_uri = os.getenv("MONGODB_URI")
if not mongo_uri:
    raise ValueError("MONGODB_URI not set")
client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db_name = os.getenv("MONGODB_DB", "fireaid")
db = client[db_name]
col = db["fire_points"]


def _sanitize(doc: Dict) -> Dict:
    """Convert non-JSON-serializable types to strings."""
    result = {}
    for k, v in doc.items():
        if isinstance(v, bytes):
            try:
                result[k] = v.decode("utf-8")
            except Exception:
                result[k] = v.hex()
        elif isinstance(v, uuid.UUID):
            result[k] = str(v)
        elif hasattr(v, "__str__") and type(v).__name__ in (
            "UUID",
            "Decimal128",
            "ObjectId",
        ):
            result[k] = str(v)
        else:
            result[k] = v
    return result


def _build_query(
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    prescribed: Optional[str] = None,
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if year_start is not None or year_end is not None:
        yr: Dict[str, Any] = {}
        if year_start is not None:
            yr["$gte"] = int(year_start)
        if year_end is not None:
            yr["$lte"] = int(year_end)
        q["year"] = yr
    if prescribed in ("Y", "N"):
        q["prescribed"] = prescribed
    return q


def search_fire_points(
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    prescribed: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    q = _build_query(year_start, year_end, prescribed)
    limit = max(1, min(int(limit), 5000))
    proj = {"_id": 0}
    return [_sanitize(doc) for doc in col.find(q, proj).limit(limit)]


def count_fire_points(
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    prescribed: Optional[str] = None,
) -> int:
    q = _build_query(year_start, year_end, prescribed)
    return int(col.count_documents(q))
