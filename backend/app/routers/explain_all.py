from __future__ import annotations

import json
import re
import uuid
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import crud
from app.llm_ollama import ollama_generate

router = APIRouter(prefix="/api", tags=["explain"])

STOP = set([
    "the","a","an","and","or","but","so","to","of","in","on","for","with","as","at","by",
    "is","are","was","were","be","been","being","do","does","did",
    "why","what","how","when","where","which","who",
    "this","that","these","those","it","we","you","i","they",
    "can","could","should","would","may","might"
])

def keywordize(q: str) -> str:
    toks = re.sub(r"[^\w\s]", " ", q.lower()).split()
    toks = [t for t in toks if len(t) >= 3 and t not in STOP]
    out = []
    for t in toks:
        if t not in out:
            out.append(t)
        if len(out) >= 8:
            break
    return " ".join(out) if out else q.strip()

def build_prompt(question: str, contexts: list[dict]) -> str:
    ctx_lines = []
    for i, c in enumerate(contexts, start=1):
        ref = f"{c['filename']}" + (f" • {c['page_ref']}" if c.get("page_ref") else "")
        ctx_lines.append(f"[{i}] {ref}\n{c['text']}\n")

    ctx_block = "\n".join(ctx_lines) if ctx_lines else "(No context found.)"

    return f"""You are a lecture companion. Answer the student's question using ONLY the provided context when possible.
If context is insufficient, say so and then give a brief general explanation.

Return Markdown with sections:
- TL;DR (2-3 lines)
- Explanation
- Example (if helpful)
- Sources (list the bracket numbers you used, e.g., [1], [2])

Question:
{question}

Context:
{ctx_block}
"""

def serialize_answer(a) -> dict:
    return {
        "id": str(a.id),
        "session_id": str(a.session_id),
        "question_id": str(a.question_id),
        "answer_md": a.answer_md,
        "sources_json": a.sources_json,
        "created_at": a.created_at.isoformat(),
    }

@router.post("/sessions/{session_id}/explain-all")
async def explain_all(
    session_id: uuid.UUID,
    force: bool = Query(False, description="If true, regenerate ALL questions (even if already answered)."),
    db: Session = Depends(get_db),
):
    if force:
        qs = crud.list_questions_by_session(db, session_id=session_id)
    else:
        qs = crud.list_unanswered_questions(db, session_id=session_id)

    if not qs:
        return {"count": 0, "answers": []}

    results: List[dict] = []

    for q in qs:
        query = keywordize(q.text)
        hits = crud.search_chunks_fts(db, session_id=q.session_id, query=query, limit=6)

        prompt = build_prompt(q.text, hits)
        answer_md = await ollama_generate(prompt)

        sources = [
            {"chunk_id": str(h["chunk_id"]), "filename": h["filename"], "page_ref": h.get("page_ref"), "rank": h["rank"]}
            for h in hits
        ]

        saved = crud.upsert_answer(
            db,
            session_id=q.session_id,
            question_id=q.id,
            answer_md=answer_md,
            sources_json=json.dumps(sources),
        )

        results.append(serialize_answer(saved))

    return {"count": len(results), "answers": results}
