from __future__ import annotations

from typing import Any, Optional, Dict
import os
import requests

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Wildfire MCP HTTP", version="1.0.0")

# WFIGS Incident Locations Current (ArcGIS FeatureServer layer 0)
INCIDENTS_LAYER = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Incident_Locations_Current/FeatureServer/0"
)

# Optional: set this if you KNOW the field exists, e.g. "FireDiscoveryDateTime DESC"
ORDER_BY_FIELDS = os.getenv("ORDER_BY_FIELDS", "").strip()  # e.g. "FireDiscoveryDateTime DESC"


def _arcgis_query(where: str, out_fields: str, result_record_count: int) -> Dict[str, Any]:
    url = f"{INCIDENTS_LAYER}/query"
    params: Dict[str, Any] = {
        "f": "json",
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "false",
        "resultRecordCount": result_record_count,
    }

    # Only include orderByFields if configured (avoid 400 when field name differs)
    if ORDER_BY_FIELDS:
        params["orderByFields"] = ORDER_BY_FIELDS

    try:
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
    except requests.HTTPError as e:
        raise RuntimeError(f"ArcGIS HTTP error: {e} | {getattr(r, 'text', '')}")
    except Exception as e:
        raise RuntimeError(f"ArcGIS request failed: {e}")

    if "error" in data:
        raise RuntimeError(f"ArcGIS error: {data['error']}")
    return data


# --------------------------
# "Tool" implementation
# --------------------------
def search_wildfires_impl(
    keyword: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 50))

    clauses = ["1=1"]

    # Important: this dataset uses state like "US-CA" not "CA"
    # We will normalize:
    # - if user passes "CA" => "US-CA"
    # - if user passes "US-CA" keep it
    def normalize_state(s: str) -> str:
        s = s.strip().upper()
        if len(s) == 2:
            return f"US-{s}"
        return s

    if keyword:
        kw = keyword.replace("'", "''")
        clauses.append(f"IncidentName LIKE '%{kw}%'")

    if state:
        st = normalize_state(state).replace("'", "''")
        clauses.append(f"POOState = '{st}'")

    where = " AND ".join(clauses)

    out_fields = ",".join(
        [
            "IncidentName",
            "POOState",
            "IncidentTypeCategory",
            "IncidentSize",
            "PercentContained",
            "ModifiedOnDateTime",
            "POOCounty",
            "FireDiscoveryDateTime",
        ]
    )

    data = _arcgis_query(where=where, out_fields=out_fields, result_record_count=limit)
    feats = data.get("features", [])

    results: list[dict[str, Any]] = []
    for f in feats:
        a = f.get("attributes", {}) or {}
        results.append(
            {
                "name": a.get("IncidentName"),
                "state": a.get("POOState"),
                "type": a.get("IncidentTypeCategory"),
                "size": a.get("IncidentSize"),
                "percent_contained": a.get("PercentContained"),
                "county": a.get("POOCounty"),
                "discovered": a.get("FireDiscoveryDateTime"),
                "last_updated": a.get("ModifiedOnDateTime"),
            }
        )

    return results


# --------------------------
# HTTP schemas
# --------------------------
class RunRequest(BaseModel):
    toolId: str = Field(..., description="Tool identifier, e.g. 'search_wildfires'")
    args: Dict[str, Any] = Field(default_factory=dict)


# --------------------------
# HTTP endpoints
# --------------------------
@app.get("/health")
def health():
    return {"ok": True}


@app.get("/tools")
def tools():
    # Frontend expects a list or {tools:[...]}
    return {
        "tools": [
            {
                "id": "search_wildfires",
                "name": "Search Wildfires",
                "kind": "system",
                "tag": "NIFC/WFIGS",
                "description": "Search current wildland fire incidents (ArcGIS WFIGS). State format is typically 'US-CA'.",
                "rating": "Live data",
            }
        ]
    }


@app.post("/run")
def run_tool(req: RunRequest):
    try:
        if req.toolId == "search_wildfires":
            keyword = req.args.get("keyword")
            state = req.args.get("state")
            limit = req.args.get("limit", 10)
            result = search_wildfires_impl(keyword=keyword, state=state, limit=limit)
            return {"result": result}

        raise HTTPException(status_code=404, detail=f"Unknown toolId: {req.toolId}")

    except HTTPException:
        raise
    except Exception as e:
        # Return clear error for frontend
        raise HTTPException(status_code=500, detail=str(e))
