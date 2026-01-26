from __future__ import annotations

from typing import Any, Optional
import requests

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Wildfire Data MCP")

# NIFC / WFIGS (Open ArcGIS FeatureServer)
INCIDENTS_LAYER = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Incident_Locations/FeatureServer/0"
)


def _arcgis_query(
    where: str,
    out_fields: str,
    result_record_count: int
) -> dict[str, Any]:
    url = f"{INCIDENTS_LAYER}/query"
    params = {
        "f": "json",
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "false",
        "resultRecordCount": result_record_count,
        "orderByFields": "OBJECTID DESC", 

    }

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    if "error" in data:
        raise RuntimeError(f"ArcGIS error: {data['error']}")

    return data

@mcp.tool()
def search_wildfires(
    keyword: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    Search current wildland fire incidents (NIFC/WFIGS).

    - keyword: match incident name (contains)
    - state: state abbreviation (e.g., AK, TX)
    - limit: number of results (max 50 recommended for demo)
    """

    limit = max(1, min(int(limit), 50))

    clauses = ["OBJECTID IS NOT NULL"]


    if keyword:
        kw = keyword.replace("'", "''")
        clauses.append(f"IncidentName LIKE '%{kw}%'")

    if state:
        st = state.strip().upper().replace("'", "''")
        clauses.append(f"POOState = '{st}'")

    where = " AND ".join(clauses)

    out_fields = ",".join([
        "IncidentName",
        "POOState",
        "IncidentTypeCategory",
        "IncidentSize",
        "PercentContained",
        "ModifiedOnDateTime",
        "POOCounty",
        "FireDiscoveryDateTime",
    ])

    data = _arcgis_query(
        where=where,
        out_fields=out_fields,
        result_record_count=limit
    )

    features = data.get("features", [])

    results: list[dict[str, Any]] = []
    for f in features:
        a = f.get("attributes", {})
        results.append({
            "name": a.get("IncidentName"),
            "state": a.get("POOState"),
            "type": a.get("IncidentTypeCategory"),
            "size": a.get("IncidentSize"),
            "percent_contained": a.get("PercentContained"),
            "county": a.get("POOCounty"),
            "discovered": a.get("FireDiscoveryDateTime"),
            "last_updated": a.get("ModifiedOnDateTime"),
        })

    return results

if __name__ == "__main__":
    mcp.run(transport="stdio")
