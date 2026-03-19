from dataclasses import dataclass 
from .ingest import ingest_sources
from .embed import embed_chunks 
from .retrieve import retrieve_chunks

import chromadb

@dataclass 
class RAGPipelineConfig:
    default_top_k: int = 5
    chunk_size: int = 1200
    chunk_overlap: int = 200
    embedding_model: str = "all-MiniLM-L6-v2"
    embed_batch_size: int = 32

def index_embeddings(embeddings: list[dict], collection: str, reindex: bool = False):
    """
    Index:
        Takes a list of dictionaries containing chunks and their embeddings,
        and indexes them into the ChromaDB collection.
    """
    try:
        client = chromadb.PersistentClient(path="./chroma_db")
        if reindex:
            try:
                client.delete_collection(name=collection)
            except Exception:
                pass
        chroma_collection = client.get_or_create_collection(name=collection)
    except Exception as e:
        raise Exception(f"Failed to connect to ChromaDB or retrieve collection '{collection}': {e}") from e

    if not embeddings:
        return

    ids = [item["chunk"].chunk_id for item in embeddings]
    docs = [item["chunk"].text for item in embeddings]
    metadatas = [item["chunk"].metadata for item in embeddings]
    embs = [item["embedding"] for item in embeddings]

    try:
        batch_size = 5000
        for i in range(0, len(ids), batch_size):
            chroma_collection.add(
                ids=ids[i:i+batch_size],
                embeddings=embs[i:i+batch_size],
                documents=docs[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size]
            )
    except Exception as e:
        raise Exception(f"Error indexing to ChromaDB collection: {e}") from e

class RAGPipeline:
    def __init__(self, config: RAGPipelineConfig):
        self.config = config 

    def ingest(self, sources, collection: str, reindex: bool = False, limit: int = None, offset: int = 0):
        """
        Ingest:
            Workflow function for ingesting documents. Should be called from the API point to
            download, embed, and index documents into vector DB.
        """

        # Take paths and turn them into type: Document to then pass to chunking
        documents = ingest_sources(
            sources=sources,
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
            limit=limit,
            offset=offset
        )

        # Takes the type: Document and embeds them
        embeddings = embed_chunks(
            documents=documents,
            model_name=self.config.embedding_model,
            batch_size=self.config.embed_batch_size,
        )

        index_embeddings(
            embeddings=embeddings,
            collection=collection,
            reindex=reindex
        )

    def retrieve(self, query: str, collection: str, top_k: int):
        """
        Retrieve: 
            Retrieve chunks from a collection in the vector DB from a query passed by the user. 
            Should be called from the API endpoint. 
        """
        return retrieve_chunks(
            query = query,
            collection = collection,
            top_k=top_k
        )


