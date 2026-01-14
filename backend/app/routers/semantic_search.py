import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.embeddings import embed_text
from app import crud

router = APIRouter(prefix="/api", tags=["semantic-search"])

@router.get("/sessions/{session_id}/chunks/semantic-search")
async def semantic_search(session_id: uuid.UUID, q: str, limit: int = 6, db: Session = Depends(get_db)):
    qvec = await embed_text(q)
    return crud.search_chunks_semantic(db, session_id=session_id, query_vec=qvec, limit=limit)
