import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import schemas, crud

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=schemas.SessionOut)
def create_session(payload: schemas.SessionCreate, db: Session = Depends(get_db)):
    s = crud.create_session(db, title=payload.title, topics=payload.topics)
    out = schemas.SessionOut.model_validate(s)
    out.question_count = 0
    return out


@router.get("", response_model=list[schemas.SessionOut])
def list_sessions(db: Session = Depends(get_db)):
    rows = crud.list_sessions(db)
    result: list[schemas.SessionOut] = []
    for s, count in rows:
        out = schemas.SessionOut.model_validate(s)
        out.question_count = int(count)
        result.append(out)
    return result


@router.get("/{session_id}", response_model=schemas.SessionOut)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    # count questions
    questions = crud.list_questions(db, session_id=session_id)
    out = schemas.SessionOut.model_validate(s)
    out.question_count = len(questions)
    return out


@router.get("/{session_id}/questions", response_model=list[schemas.QuestionOut])
def list_questions(session_id: uuid.UUID, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return crud.list_questions(db, session_id=session_id)


@router.post("/{session_id}/questions", response_model=schemas.QuestionOut)
def create_question(
    session_id: uuid.UUID,
    payload: schemas.QuestionCreate,
    db: Session = Depends(get_db),
):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return crud.create_question(db, session_id=session_id, text=payload.text)
