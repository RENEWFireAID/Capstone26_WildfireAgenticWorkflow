import torch
from sentence_transformers import SentenceTransformer
from typing import Any, Dict, List
from shared import Chunk

"""
[embed.py]
Handles the embedding of chunks and plain string queries using the sentence-transformers model.
"""

class EmbedError(Exception):
    pass

_model = None

def get_model(model_name: str = "all-MiniLM-L6-v2") -> SentenceTransformer:
    global _model
    if _model is None:
        try:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[*] Loading embedding model {model_name} on device: {device.upper()}")
            _model = SentenceTransformer(model_name, device=device)
        except Exception as e:
            raise EmbedError(f"Failed to load embedding model '{model_name}': {e}") from e
    return _model

def embed_chunks(documents: list[Chunk], model_name: str = "all-MiniLM-L6-v2", batch_size: int = 32) -> list[Dict[str, Any]]:
    """
    Embed:
        Main pipeline function for embedding chunks of text.
    """
    try:
        model = get_model(model_name)
    except Exception as e:
        raise EmbedError(f"Error initializing model '{model_name}': {e}") from e
    
    if "e5" in model_name.lower():
        texts = [f"passage: {chunk.text}" for chunk in documents]
    else:
        texts = [chunk.text for chunk in documents]

    try:
        embeddings = model.encode(texts, batch_size=batch_size, show_progress_bar=True)
    except Exception as e:
        raise EmbedError(f"Failed to encode chunks: {e}") from e
    
    results = []
    for chunk, emb in zip(documents, embeddings):
        results.append({
            "chunk": chunk,
            "embedding": emb.tolist()
        })
    return results

def embed_query(query: str, model_name: str = "all-MiniLM-L6-v2") -> list[float]:
    """
    Embed:
        Embeds a single query string for retrieval vector matching.
    """
    try:
        model = get_model(model_name)
    except Exception as e:
        raise EmbedError(f"Error initializing model '{model_name}': {e}") from e
        
    if "e5" in model_name.lower():
        prefixed_query = f"query: {query}"
    else:
        prefixed_query = query
    
    try:
        embedding = model.encode([prefixed_query])[0]
    except Exception as e:
        raise EmbedError(f"Failed to encode query: {e}") from e
        
    return embedding.tolist()
