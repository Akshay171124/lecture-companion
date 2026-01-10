import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import crud, schemas
from app.chunking import make_chunks

router = APIRouter(prefix="/api/sessions", tags=["chunks"])


@router.post("/{session_id}/resources/{resource_id}/chunk")
def chunk_one_resource(session_id: uuid.UUID, resource_id: uuid.UUID, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    r = crud.get_resource(db, resource_id=resource_id)
    if not r or r.session_id != session_id:
        raise HTTPException(status_code=404, detail="Resource not found")

    if r.status != "EXTRACTED" or not r.extracted_text:
        raise HTTPException(status_code=400, detail="Resource is not extracted yet")

    chunks = make_chunks(r.extracted_text)
    count = crud.create_chunks_for_resource(db, session_id=session_id, resource_id=resource_id, chunks=chunks)
    return {"resource_id": resource_id, "chunks_created": count}


@router.post("/{session_id}/chunk-all")
def chunk_all(session_id: uuid.UUID, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    resources = crud.list_extractable_resources(db, session_id=session_id)

    total = 0
    processed = 0
    skipped = 0

    for r in resources:
        if r.status != "EXTRACTED" or not r.extracted_text:
            skipped += 1
            continue
        chunks = make_chunks(r.extracted_text)
        total += crud.create_chunks_for_resource(db, session_id=session_id, resource_id=r.id, chunks=chunks)
        processed += 1

    return {"processed_resources": processed, "skipped_resources": skipped, "chunks_created": total}


@router.get("/{session_id}/chunks/search", response_model=list[schemas.ChunkHitOut])
def search_chunks(
    session_id: uuid.UUID,
    q: str = Query(min_length=1),
    limit: int = Query(default=6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    hits = crud.search_chunks_fts(db, session_id=session_id, query=q, limit=limit)
    return hits
