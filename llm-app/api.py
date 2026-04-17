import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from functools import lru_cache
import uvicorn

try:
    import pandas as pd
    _pandas_available = True
except ImportError:
    _pandas_available = False

sys.path.append(str(Path(__file__).parent.resolve()))
from services.rag_service.pipeline.workflow import RAGPipeline, RAGPipelineConfig

app = FastAPI(title="FireAID RAG API")

config = RAGPipelineConfig(default_top_k=3)
pipeline = RAGPipeline(config)


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 3


class RetrieveResponse(BaseModel):
    chunks: list[dict]
    error: str | None = None


@app.post("/api/retrieve", response_model=RetrieveResponse)
def retrieve(req: RetrieveRequest):
    try:
        chunks = pipeline.retrieve(
            query=req.query, collection="wildfire_literature", top_k=req.top_k
        )

        results = []
        for i, chunk in enumerate(chunks):
            print(f"--- Retrieved Chunk {i + 1} ---")
            print(f"Metadata: {chunk.metadata}")
            print(
                f"Text Preview (first 200 chars): {chunk.text[:200] if chunk.text else ''}..."
            )
            print("----------------------------\n", flush=True)
            results.append({"text": chunk.text, "metadata": chunk.metadata})

        print(
            f"Total chunks retrieved and returned by RAG service: {len(results)}",
            flush=True,
        )
        return RetrieveResponse(chunks=results)
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


GRIDDED_CSV = Path("/app/data/ml_ready_scored_grid.csv")

@lru_cache(maxsize=1)
def _load_gridded() -> "pd.DataFrame":
    if not _pandas_available:
        raise RuntimeError("pandas is not installed")
    if not GRIDDED_CSV.exists():
        raise FileNotFoundError(
            f"Gridded predictions not found at {GRIDDED_CSV}. "
            "Run ml_model/train_model.py first."
        )
    df = pd.read_csv(GRIDDED_CSV, parse_dates=["date"])
    df["year"]  = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["fire_occurred"] = (df["risk_score"] > 0).astype(int)
    return df


@app.get("/api/ml-predictions")
def get_ml_predictions(
    year:  int = Query(..., description="Year (2000–2007)"),
    month: int = Query(..., description="Month (5=May … 8=Aug)"),
):
    try:
        df = _load_gridded()
    except (FileNotFoundError, RuntimeError) as e:
        raise HTTPException(status_code=404, detail=str(e))

    subset = df[(df["year"] == year) & (df["month"] == month)]
    if subset.empty:
        return {"points": [], "year": year, "month": month}

    agg = (
        subset.groupby(["grid_lat", "grid_lon"])
        .agg(
            avg_probability=("fire_probability", "mean"),
            max_probability=("fire_probability", "max"),
            fire_days=("fire_occurred", "sum"),
            total_days=("fire_occurred", "count"),
        )
        .reset_index()
    )

    points = [
        {
            "lat":             round(float(r["grid_lat"]),        4),
            "lng":             round(float(r["grid_lon"]),        4),
            "avg_probability": round(float(r["avg_probability"]), 4),
            "max_probability": round(float(r["max_probability"]), 4),
            "fire_days":       int(r["fire_days"]),
            "total_days":      int(r["total_days"]),
        }
        for _, r in agg.iterrows()
    ]

    return {"points": points, "year": year, "month": month}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
