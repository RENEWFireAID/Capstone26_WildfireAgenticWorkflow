from fastapi import FastAPI, Query
from tools.mongo_fire_tools import search_fire_points, count_by_year

app = FastAPI(title="FireMCP", version="0.1")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/search_fire_points")
def api_search_fire_points(
    year: int | None = Query(default=None),
    prescribed: str | None = Query(default=None, description="Y or N"),
    org: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    return search_fire_points(year=year, prescribed=prescribed, org=org, limit=limit)

@app.get("/count_by_year")
def api_count_by_year(year: int = Query(...)):
    return count_by_year(year)
