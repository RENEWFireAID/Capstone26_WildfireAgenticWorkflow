from PyPDF2 import PdfReader
from pathlib import Path
import os
import csv
import ast
from shared import Document, Chunk
from typing import Any, Dict, List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter

"""
[ingest.py]
Takes sources, passed as paths, and turns all accepted file types into 
type Document, and then passes them into a chunking function to chunk all the text
in the Document class.

Notes: PDF ingestion is abstract and can accept most cases of PDF documents. CSV ingestion
is a hard coded case specific ingestion accepting a certain formatted CSV table. 
"""


def ingest_sources(
    sources: list[Path],
    chunk_size: int,
    chunk_overlap: int,
    limit: int = None,
    offset: int = 0,
):
    docs = []

    for src in sources:
        docs.extend(load_documents(src, limit=limit, offset=offset))

    chunks = []

    chunks.extend(
        chunk_documents(docs, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    )

    return chunks


def validate_source_path(path: Path):
    if not path.exists():
        raise SourceNotFoundError(f"The path was not found: '{path}'")


def load_documents(source: Path, limit: int = None, offset: int = 0) -> list[Document]:
    documents = []

    if source.is_dir():
        for file_path in source.rglob("*"):
            if not file_path.is_file():
                continue
            if file_path.name.startswith("."):
                continue
            try:
                documents.extend(load_file(file_path, limit=limit, offset=offset))
            except Exception as e:
                print(f"Skipping {file_path}: {e}")
    elif source.is_file():
        try:
            documents.extend(load_file(source, limit=limit, offset=offset))
        except Exception as e:
            print(f"Skipping {source}: {e}")

    return documents


def load_file(file_path: Path, limit: int = None, offset: int = 0) -> list[Document]:
    ext = file_path.suffix.lower()
    if ext == ".pdf":
        return parse_pdf(file_path, limit=limit, offset=offset)
    if ext == ".csv":
        return parse_csv(file_path, limit=limit, offset=offset)
    return []


def parse_pdf(path: Path, limit: int = None, offset: int = 0) -> list[Document]:
    try:
        reader = PdfReader(str(path))
    except Exception as e:
        raise ParseError(f"Failed to open PDF '{path}': {e}") from e

    text = ""
    for page in reader.pages:
        try:
            page_text = page.extract_text()
        except Exception as e:
            raise ParseError(f"Failed extracting text from '{path}': {e}") from e

        if page_text:
            text += page_text + "\n"

    doc_id = str(path)
    meta: Dict[str, Any] = {
        "filetype": "pdf",
        "filename": path.name,
        "path": str(path.resolve()),
    }

    return [
        Document(
            doc_id=doc_id,
            text=text,
            source_url=f"file://{path.resolve()}",
            metadata=meta,
        )
    ]


def parse_csv(path: Path, limit: int = None, offset: int = 0) -> list[Document]:
    try:
        f = path.open("r", encoding="utf-8", newline="")
    except Exception as e:
        raise Exception(f"Failed to open CSV '{path}': {e}") from e

    with f:
        reader = csv.DictReader(f)
        docs = []
        for i, row in enumerate(reader):
            if i < offset:
                continue
            if limit is not None and i >= offset + limit:
                break

            abstract = str(row.get("abstract", "")).strip()
            if not abstract:
                continue

            # Store metadata as primitive types supported by vector databases
            meta: Dict[str, Any] = {
                "filetype": "csv",
                "year": str(row.get("year", "")),
                "title": str(row.get("title", "")),
                "field": str(row.get("field", "")),
                "authors": str(row.get("authors", "")),
                "row_index": int(i),
            }

            docs.append(
                Document(
                    doc_id=f"{path.stem}:{i}",
                    text=abstract,
                    source_url=f"file://{path.resolve()}",
                    metadata=meta,
                )
            )

    return docs


def chunk_documents(
    docs: list[Document], chunk_size: int, chunk_overlap: int
) -> list[Chunk]:
    separators = ["\n\n", "\n", ".", " ", ""]

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=separators,
    )

    chunks = []

    for doc in docs:
        text = (doc.text).strip()
        if not text:
            continue

        # Per instructions from Tanwi, the abstracts in CSV's should be one chunk.
        filetype = doc.metadata.get("filetype")
        if filetype == "pdf":
            pieces = splitter.split_text(text)
        elif filetype == "csv":
            pieces = [text]
        else:
            pieces = [text]

        for i, chunk_text in enumerate(pieces):
            chunk_text = chunk_text.strip()
            if not chunk_text:
                continue

            meta: Dict[str, any] = dict(doc.metadata)
            meta["chunk_index"] = i

            chunks.append(
                Chunk(
                    chunk_id=f"{doc.doc_id}::chunk-{i}",
                    doc_id=doc.doc_id,
                    text=chunk_text,
                    metadata=meta,
                )
            )

    return chunks
