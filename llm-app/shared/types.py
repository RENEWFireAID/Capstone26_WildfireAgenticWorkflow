from dataclasses import dataclass 
from typing import Any, Dict, Optional 

@dataclass(frozen=True)
class Document:
    doc_id: str
    text: str
    source_url: str
    metadata: dict[str, Any]

@dataclass(frozen=True)
class Chunk: 
    chunk_id: str
    doc_id: str 
    text: str 
    metadata: Dict[str, Any]
