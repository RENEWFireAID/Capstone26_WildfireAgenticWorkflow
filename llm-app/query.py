import sys
import re
import requests
from pathlib import Path

# Provide resolving path context so modular imports from /services work
sys.path.append(str(Path(__file__).parent.resolve()))

from services.rag_service.pipeline.workflow import RAGPipeline, RAGPipelineConfig
from shared.types import Chunk

import os

ML_MODEL = "deepseek/deepseek-chat"  # Adjust as needed for OpenRouter


def call_llm(prompt: str, model: str = ML_MODEL) -> str:
    """
    Sends a query parameter to OpenRouter API endpoint.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise Exception("OPENROUTER_API_KEY is not set in the environment variables.")

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        raise Exception(f"Connection to OpenRouter failed. Details: {e}")


def build_prompt(query: str, chunks: list[Chunk]) -> str:
    """
    Constructs the context-augmented prompt using the retrieved Chunk objects.
    """
    context = ""
    for chunk in chunks:
        # Preprocess text to remove excessive whitespaces
        snippet = re.sub(r"\s+", " ", chunk.text)[:800]

        c_index = chunk.metadata.get("chunk_index", "N/A")
        title = chunk.metadata.get("title", "Unknown Title")
        authors = chunk.metadata.get("authors", "Unknown Author")
        filename = chunk.metadata.get("filename", chunk.doc_id)
        year = chunk.metadata.get("year", "Unknown Year")

        context += f"[File: {filename} | Title: {title} | Author: {authors} | Year: {year} | Chunk {c_index}]\n{snippet}\n\n"

    return f"""
You are an engineering research assistant.
Answer ONLY using the provided context.
Cite sources using inline citations in your text, and provide an MLA formatted 'Sources' section at the very end of your response. 
Use the File, Title, and Author provided in the context blocks to construct the citations. 
If not in context, say "Insufficient evidence."

QUESTION: {query}

CONTEXT:
{context}

ANSWER:
"""


def main():
    # 1. Initialize our application architecture's pipeline
    config = RAGPipelineConfig(default_top_k=3)
    pipeline = RAGPipeline(config)

    dataset_path = Path("data/wildfire_literature.csv").resolve()

    import chromadb

    client = chromadb.PersistentClient(path="./chroma_db")
    try:
        col = client.get_collection("wildfire_literature")
        count = col.count()
    except Exception:
        count = 0

    total_rows_to_ingest = 110000
    batch_size = 5000
    reindex_needed = count < total_rows_to_ingest
    """
    # 2. Ingest Source 
    if reindex_needed:
        print(f"Ingesting entire dataset {dataset_path.name} in batches of {batch_size}...")
        if dataset_path.exists():
            for offset in range(0, total_rows_to_ingest, batch_size):
                print(f"Ingesting batch {offset} to {offset + batch_size}...")
                try:
                    # Only reindex on the first batch if reindex behavior sweeps Chroma DB
                    is_first_batch = (offset == 0)
                    pipeline.ingest(
                        sources=[dataset_path],
                        collection="wildfire_literature",
                        reindex=is_first_batch,
                        limit=batch_size,
                        offset=offset
                    )
                except Exception as e:
                    print(f"Failed to ingest pipeline elements at offset {offset}: {e}")
                    return
            print("=> Ingestion completed and embedded to ChromaDB successfully.\n")
        else:
            print(f"Path does not exist: {dataset_path}")
            return
    else:
        print(f"Collection 'wildfire_literature' already has {count} documents. Skipping ingestion to save time!")
    """
    # 3. Retrieve Context
    query = "What are the key wildfire risks and near-term concerns following a high-intensity fire in Alaska, particularly for public safety, water supply, and infrastructure?"
    print(f"Querying: '{query}'")

    try:
        retrieved_chunks = pipeline.retrieve(
            query=query, collection="wildfire_literature", top_k=3
        )
    except Exception as e:
        print(f"Failed retrieval: {e}")
        return

    if not retrieved_chunks:
        print("No context chunks retrieved.")
        return

    # 4. Generate Answer via local LLM
    prompt = build_prompt(query, retrieved_chunks)

    print("\n----------------\n--- LLM PLAN ---\n----------------\n")
    print("PROMPT PREVIEW:\n", prompt)

    print("\n----------------\n--- RESPONSE ---\n----------------\n")
    try:
        answer = call_llm(prompt)
        print(answer)
    except Exception as e:
        print(f"Failed to call LLM: {e}")

    # 5. Format the sources strictly matching our Chunk architecture classes
    print("\n---------------\n--- SOURCES ---\n---------------\n")
    for chunk in retrieved_chunks:
        title = chunk.metadata.get("title", "Unknown Title")
        authors = chunk.metadata.get("authors", "Unknown Author")
        filename = chunk.metadata.get("filename", chunk.doc_id)
        c_idx = chunk.metadata.get("chunk_index", "N/A")

        print(
            f"- File: {filename} | Title: {title} | Author: {authors} (Chunk {c_idx})"
        )

        # Small preview snippet for verification
        preview = str(chunk.text).replace("\n", " ")
        print(f"  Snippet: {preview[:80]}...\n")


if __name__ == "__main__":
    main()
