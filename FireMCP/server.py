from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from tools.mongo_fire_tools import search_fire_points, count_by_year

app = FastAPI(title="FireMCP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/mcp/tools")
def tools():
    return {
        "tools": [
            {"name": "search_fire_points", "desc": "Search fire points"},
            {"name": "count_by_year", "desc": "Count by year"},
        ]
    }

@app.get("/mcp/search")
def search(year: int = 2024, prescribed: str = "Y", limit: int = 10):
    return {"results": search_fire_points(year=year, prescribed=prescribed, limit=limit)}

@app.get("/mcp/count")
def count(year: int = 2024):
    return {"year": year, "count": count_by_year(year)}
