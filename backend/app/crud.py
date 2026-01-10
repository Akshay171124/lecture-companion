import uuid
from sqlalchemy import select, func, text as sql_text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models import Resource as ResourceModel, ResourceChunk as ResourceChunkModel, Answer as AnswerModel


from app.models import Session as SessionModel, Question as QuestionModel, Question as QuestionModel


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

def delete_chunks_for_resource(db: Session, resource_id: uuid.UUID):
    db.query(ResourceChunkModel).filter(ResourceChunkModel.resource_id == resource_id).delete()
    db.commit()


def create_chunks_for_resource(
    db: Session,
    session_id: uuid.UUID,
    resource_id: uuid.UUID,
    chunks: list[tuple[str | None, str]],
):
    # remove old chunks first (idempotent)
    db.query(ResourceChunkModel).filter(ResourceChunkModel.resource_id == resource_id).delete()
    db.commit()

    rows = []
    for idx, (ref, txt) in enumerate(chunks, start=1):
        rows.append(
            ResourceChunkModel(
                session_id=session_id,
                resource_id=resource_id,
                chunk_index=idx,
                page_ref=ref,
                text=txt,
            )
        )

    db.add_all(rows)
    db.commit()
    return len(rows)


def search_chunks_fts(db: Session, session_id: uuid.UUID, query: str, limit: int = 6):
    """
    Full-text search over chunks scoped to session.
    Returns list[schemas.ChunkHitOut-like dict].
    """
    # Use plainto_tsquery for safety and decent matching
    # Rank > 0 ensures we only return relevant chunks
    stmt = sql_text(
        """
        SELECT
          c.id AS chunk_id,
          c.resource_id AS resource_id,
          r.filename AS filename,
          c.page_ref AS page_ref,
          c.text AS text,
          ts_rank(to_tsvector('english', c.text), plainto_tsquery('english', :q)) AS rank
        FROM resource_chunks c
        JOIN resources r ON r.id = c.resource_id
        WHERE c.session_id = :sid
          AND to_tsvector('english', c.text) @@ plainto_tsquery('english', :q)
        ORDER BY rank DESC
        LIMIT :lim
        """
    )

    rows = db.execute(stmt, {"sid": str(session_id), "q": query, "lim": limit}).mappings().all()
    # rank comes back as Decimal sometimes; float it
    return [
        {
            "chunk_id": row["chunk_id"],
            "resource_id": row["resource_id"],
            "filename": row["filename"],
            "page_ref": row["page_ref"],
            "text": row["text"],
            "rank": float(row["rank"]),
        }
        for row in rows
    ]


def get_resource(db: Session, resource_id: uuid.UUID):
    return db.get(ResourceModel, resource_id)


def list_extractable_resources(db: Session, session_id: uuid.UUID):
    stmt = (
        select(ResourceModel)
        .where(ResourceModel.session_id == session_id)
        .order_by(ResourceModel.created_at.desc())
    )
    return db.execute(stmt).scalars().all()

def get_answer_by_question(db: Session, question_id: uuid.UUID):
    stmt = select(AnswerModel).where(AnswerModel.question_id == question_id)
    return db.execute(stmt).scalars().first()

def upsert_answer(db: Session, session_id: uuid.UUID, question_id: uuid.UUID, answer_md: str, sources_json: str):
    existing = get_answer_by_question(db, question_id=question_id)
    if existing:
        existing.answer_md = answer_md
        existing.sources_json = sources_json
        db.commit()
        db.refresh(existing)
        return existing

    a = AnswerModel(
        session_id=session_id,
        question_id=question_id,
        answer_md=answer_md,
        sources_json=sources_json,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a

def get_question(db: Session, question_id: uuid.UUID):
    return db.get(QuestionModel, question_id)