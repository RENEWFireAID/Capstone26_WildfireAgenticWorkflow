import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

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
        for chunk in chunks:
            results.append({"text": chunk.text, "metadata": chunk.metadata})

        return RetrieveResponse(chunks=results)
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
