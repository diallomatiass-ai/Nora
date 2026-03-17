"""ChromaDB vector store integration for knowledge base and approved replies."""

from __future__ import annotations

import logging
from typing import Optional

import chromadb
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_chroma_client: Optional[chromadb.HttpClient] = None


def _get_chroma_client() -> chromadb.HttpClient:
    """Return a singleton ChromaDB HTTP client."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
    return _chroma_client


def get_knowledge_collection() -> chromadb.Collection:
    """Return (or create) the 'knowledge_embeddings' collection."""
    client = _get_chroma_client()
    return client.get_or_create_collection(name="knowledge_embeddings")


def get_replies_collection() -> chromadb.Collection:
    """Return (or create) the 'approved_replies' collection."""
    client = _get_chroma_client()
    return client.get_or_create_collection(name="approved_replies")


def get_style_collection() -> chromadb.Collection:
    """Return (or create) the 'style_samples' collection for skrivestils-læring."""
    client = _get_chroma_client()
    return client.get_or_create_collection(name="style_samples")


async def _get_embedding(text: str) -> list[float]:
    """Request an embedding vector from the Ollama API.

    Uses the nomic-embed-text model configured in settings.
    """
    url = f"{settings.ollama_base_url}/api/embeddings"
    payload = {
        "model": settings.ollama_embed_model,
        "prompt": text,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["embedding"]


async def add_knowledge_entry(entry_id: str, content: str, metadata: dict) -> None:
    """Embed content and add it to the knowledge collection.

    Args:
        entry_id: Unique identifier for the entry (typically str(uuid)).
        content: The text content to embed and store.
        metadata: Metadata dict (must include 'user_id' for later filtering).
    """
    embedding = await _get_embedding(content)
    collection = get_knowledge_collection()
    collection.upsert(
        ids=[entry_id],
        embeddings=[embedding],
        documents=[content],
        metadatas=[metadata],
    )
    logger.info("Added knowledge entry %s to ChromaDB", entry_id)


async def search_knowledge(
    query: str, user_id: str, n_results: int = 3
) -> list[dict]:
    """Search the knowledge collection for entries matching the query.

    Args:
        query: The search query text.
        user_id: Filter results to this user only.
        n_results: Maximum number of results to return.

    Returns:
        List of dicts with keys: id, document, metadata, distance.
    """
    embedding = await _get_embedding(query)
    collection = get_knowledge_collection()

    results = collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
        where={"user_id": user_id},
    )

    output: list[dict] = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            output.append(
                {
                    "id": doc_id,
                    "document": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else None,
                }
            )
    return output


async def add_approved_reply(
    suggestion_id: str, text: str, metadata: dict
) -> None:
    """Embed and add an approved reply to the replies collection.

    Args:
        suggestion_id: Unique identifier (typically str(uuid)).
        text: The approved/edited reply text to embed and store.
        metadata: Metadata dict (should include 'user_id', 'category', etc.).
    """
    embedding = await _get_embedding(text)
    collection = get_replies_collection()
    collection.upsert(
        ids=[suggestion_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata],
    )
    logger.info("Added approved reply %s to ChromaDB", suggestion_id)


async def add_style_sample(
    sample_id: str, text: str, metadata: dict
) -> None:
    """Gem et godkendt/redigeret svar som skrivestils-eksempel.

    Args:
        sample_id: Unik ID (typisk str(suggestion_id)).
        text: Den godkendte svartekst.
        metadata: Bør indeholde 'user_id' og 'category'.
    """
    try:
        embedding = await _get_embedding(text)
        collection = get_style_collection()
        collection.upsert(
            ids=[sample_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata],
        )
        logger.info("Gemt skrivestils-eksempel %s i ChromaDB", sample_id)
    except Exception as exc:
        logger.warning("Kunne ikke gemme skrivestils-eksempel: %s", exc)


async def search_style_samples(
    query: str, user_id: str, n_results: int = 2
) -> list[dict]:
    """Find lignende skrivestils-eksempler fra brugerens godkendte svar.

    Args:
        query: Søgetekst (typisk emne + brødtekst fra indgående email).
        user_id: Filtrer til denne bruger.
        n_results: Maks antal resultater.

    Returns:
        Liste af dicts med keys: id, document, metadata, distance.
    """
    try:
        embedding = await _get_embedding(query)
        collection = get_style_collection()
        results = collection.query(
            query_embeddings=[embedding],
            n_results=n_results,
            where={"user_id": user_id},
        )
        output: list[dict] = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                output.append({
                    "id": doc_id,
                    "document": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else None,
                })
        return output
    except Exception as exc:
        logger.warning("Style-søgning fejlede: %s", exc)
        return []


async def search_similar_replies(
    query: str, user_id: str, n_results: int = 3
) -> list[dict]:
    """Search the approved replies collection for similar past replies.

    Args:
        query: The search query text (typically the incoming email body).
        user_id: Filter results to this user only.
        n_results: Maximum number of results to return.

    Returns:
        List of dicts with keys: id, document, metadata, distance.
    """
    embedding = await _get_embedding(query)
    collection = get_replies_collection()

    results = collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
        where={"user_id": user_id},
    )

    output: list[dict] = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            output.append(
                {
                    "id": doc_id,
                    "document": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else None,
                }
            )
    return output
