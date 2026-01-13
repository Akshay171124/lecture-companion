# backend/app/embeddings.py
from __future__ import annotations

import os
from typing import List
import httpx

OLLAMA_BASE = os.getenv("OLLAMA_BASE", "http://ollama:11434")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

async def embed_text(text: str) -> List[float]:
    """
    Returns a vector embedding for `text` using Ollama's embeddings endpoint.
    """
    payload = {"model": EMBED_MODEL, "prompt": text}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{OLLAMA_BASE}/api/embeddings", json=payload)
        r.raise_for_status()
        data = r.json()
        return data["embedding"]
