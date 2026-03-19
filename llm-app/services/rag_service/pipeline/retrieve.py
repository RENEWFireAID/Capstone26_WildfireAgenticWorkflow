from typing import Any, Dict, List, Optional
from shared import Chunk
import chromadb
from chromadb.config import Settings
from .embed import embed_query, EmbedError

"""
[retrieve.py]
Retrieves chunks from a collection in the vector database given a user query.

Notes: This file acts as the bridge between the user query and the vector database,
handling the embedding of the query and the parsing of the returned vector database payload
into the standardized type: Chunk.
"""

class RetrievalError(Exception):
    pass

def retrieve_chunks(query: str, collection: str, top_k: int) -> list[Chunk]:
    """
    Retrieve:
        Main workflow function for retrieving chunks. Should be called by the pipeline.
    """
    try:
        query_embedding = embed_query(query)
    except Exception as e:
        raise EmbedError(f"Failed to embed query: {e}") from e

    try:
        raw_results = search_collection(query_embedding, collection, top_k)
    except Exception as e:
        raise RetrievalError(f"Failed to search collection '{collection}': {e}") from e

    try:
        chunks = parse_results(raw_results)
    except Exception as e:
        raise RetrievalError(f"Failed to parse retrieved results: {e}") from e

    return chunks




def search_collection(query_embedding: list[float], collection: str, top_k: int) -> list[Dict[str, Any]]:
    """
    Search a given collection in the vector DB for the k closest vectors using ChromaDB.
    """
    try:
        # Note: In a production application, the ChromaDB client should ideally be initialized 
        # once globally or injected instead of repeatedly instantiating on each query.
        client = chromadb.PersistentClient(path="./chroma_db")
        chroma_collection = client.get_collection(name=collection)
    except Exception as e:
        raise RetrievalError(f"Failed to connect to ChromaDB or retrieve collection '{collection}': {e}") from e

    try:
        results = chroma_collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
    except Exception as e:
        raise RetrievalError(f"Error querying ChromaDB collection '{collection}': {e}") from e

    raw_results = []
    
    if not results or not results.get("ids") or not results["ids"][0]:
        return raw_results
        
    ids = results["ids"][0]
    documents = results.get("documents", [[None]])[0]
    metadatas = results.get("metadatas", [[{}]])[0]
    
    for i, chunk_id in enumerate(ids):
        text = documents[i] if documents and i < len(documents) and documents[i] is not None else ""
        meta = metadatas[i] if metadatas and i < len(metadatas) and metadatas[i] is not None else {}
        
        raw_results.append({
            "chunk_id": chunk_id,
            "text": text,
            "metadata": meta
        })
        
    return raw_results


def parse_results(raw_results: list[Dict[str, Any]]) -> list[Chunk]:
    """
    Turn the list of raw hit outputs from the vector DB into structured
    Chunk classes as utilized across the pipeline.
    """
    chunks = []
    
    for i, res in enumerate(raw_results):
        text = res.get("text", "")
        if not text:
            continue
            
        meta: Dict[str, Any] = res.get("metadata", {})
        chunk_id = res.get("chunk_id", f"retrieved_chunk_{i}")
        doc_id = meta.get("doc_id") 
        if not doc_id:
            doc_id = chunk_id.split("::")[0] if "::" in chunk_id else res.get("doc_id", "unknown_doc")
        
        chunks.append(
            Chunk(
                chunk_id=chunk_id,
                doc_id=doc_id,
                text=text,
                metadata=meta
            )
        )

    return chunks
