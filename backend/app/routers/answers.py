from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app import crud

router = APIRouter(prefix="/api", tags=["answers"])

@router.get("/sessions/{session_id}/answers")
def list_answers(session_id: uuid.UUID, db: Session = Depends(get_db)):
    ans = crud.list_answers_by_session(db, session_id=session_id)
    return [
        {
            "id": str(a.id),
            "session_id": str(a.session_id),
            "question_id": str(a.question_id),
            "answer_md": a.answer_md,
            "sources_json": a.sources_json,
            "created_at": a.created_at.isoformat(),
        }
        for a in ans
    ]
