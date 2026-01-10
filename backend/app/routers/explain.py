import json
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import crud, schemas
from app.llm_ollama import ollama_generate

router = APIRouter(prefix="/api", tags=["explain"])

STOP = set(["the","a","an","and","or","but","so","to","of","in","on","for","with","as","at","by",
            "is","are","was","were","be","been","being","do","does","did",
            "why","what","how","when","where","which","who",
            "this","that","these","those","it","we","you","i","they",
            "can","could","should","would","may","might"])

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
    # contexts: [{chunk_id, filename, page_ref, text, rank}, ...]
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

@router.post("/questions/{question_id}/explain", response_model=schemas.AnswerOut)
async def explain_one(question_id: uuid.UUID, db: Session = Depends(get_db)):
    q = crud.get_question(db, question_id=question_id)  # you likely already have this helper; if not, add it
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    # Retrieve context
    query = keywordize(q.text)
    hits = crud.search_chunks_fts(db, session_id=q.session_id, query=query, limit=6)

    prompt = build_prompt(q.text, hits)
    answer_md = await ollama_generate(prompt)

    # store sources as JSON (chunk id + filename + page_ref)
    sources = [
        {"chunk_id": str(h["chunk_id"]), "filename": h["filename"], "page_ref": h.get("page_ref"), "rank": h["rank"]}
        for h in hits
    ]
    saved = crud.upsert_answer(db, session_id=q.session_id, question_id=q.id, answer_md=answer_md, sources_json=json.dumps(sources))
    return saved
