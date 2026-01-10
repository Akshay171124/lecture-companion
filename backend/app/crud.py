import uuid
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models import Resource as ResourceModel

from app.models import Session as SessionModel, Question as QuestionModel


def create_session(db: Session, title: str, topics: str | None):
    s = SessionModel(title=title, topics=topics)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def list_sessions(db: Session):
    # Return sessions + question counts
    stmt = (
        select(
            SessionModel,
            func.count(QuestionModel.id).label("question_count"),
        )
        .outerjoin(QuestionModel, QuestionModel.session_id == SessionModel.id)
        .group_by(SessionModel.id)
        .order_by(SessionModel.created_at.desc())
    )
    rows = db.execute(stmt).all()
    return rows


def get_session(db: Session, session_id: uuid.UUID):
    return db.get(SessionModel, session_id)


def list_questions(db: Session, session_id: uuid.UUID):
    stmt = (
        select(QuestionModel)
        .where(QuestionModel.session_id == session_id)
        .order_by(QuestionModel.order_index.asc())
    )
    return db.execute(stmt).scalars().all()


def create_question(db: Session, session_id: uuid.UUID, text: str):
    # MVP approach: compute next order_index by max+1
    # (Good enough for single-user local dev. We can harden later.)
    max_stmt = select(func.coalesce(func.max(QuestionModel.order_index), 0)).where(
        QuestionModel.session_id == session_id
    )
    current_max = db.execute(max_stmt).scalar_one()
    next_index = int(current_max) + 1

    q = QuestionModel(session_id=session_id, text=text, order_index=next_index)
    db.add(q)
    db.commit()
    db.refresh(q)
    return q

def create_resource(
    db: Session,
    session_id: uuid.UUID,
    filename: str,
    mime_type: str | None,
    storage_path: str,
    status: str,
    extracted_text: str | None,
    error: str | None,
):
    r = ResourceModel(
        session_id=session_id,
        filename=filename,
        mime_type=mime_type,
        storage_path=storage_path,
        status=status,
        extracted_text=extracted_text if status == "EXTRACTED" else None,
        error=error if status == "FAILED" else None,
        extracted_at=datetime.now(timezone.utc) if status in {"EXTRACTED", "FAILED"} else None,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def list_resources(db: Session, session_id: uuid.UUID):
    stmt = (
        select(ResourceModel)
        .where(ResourceModel.session_id == session_id)
        .order_by(ResourceModel.created_at.desc())
    )
    return db.execute(stmt).scalars().all()