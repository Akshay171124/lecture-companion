import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.db import get_db
from app import crud, schemas
from app.extract import extract_text

router = APIRouter(prefix="/api/sessions", tags=["resources"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")


def safe_filename(name: str) -> str:
    # keep it simple and safe
    name = name.replace("/", "_").replace("\\", "_").strip()
    if not name:
        name = "file"
    return name


@router.get("/{session_id}/resources", response_model=list[schemas.ResourceOut])
def list_resources(session_id: uuid.UUID, db: Session = Depends(get_db)):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return crud.list_resources(db, session_id=session_id)


@router.post("/{session_id}/resources", response_model=list[schemas.ResourceOut])
async def upload_resources(
    session_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    s = crud.get_session(db, session_id=session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    session_folder = Path(UPLOAD_DIR) / str(session_id)
    session_folder.mkdir(parents=True, exist_ok=True)

    created = []
    for f in files:
        original = safe_filename(f.filename or "upload")
        data = await f.read()

        # store file
        unique = f"{uuid.uuid4()}__{original}"
        path = session_folder / unique
        path.write_bytes(data)

        # extract text (sync MVP)
        status, out = extract_text(original, f.content_type, data)

        if status == "EXTRACTED":
            r = crud.create_resource(
                db=db,
                session_id=session_id,
                filename=original,
                mime_type=f.content_type,
                storage_path=str(path),
                status=status,
                extracted_text=out,
                error=None,
            )
        else:
            r = crud.create_resource(
                db=db,
                session_id=session_id,
                filename=original,
                mime_type=f.content_type,
                storage_path=str(path),
                status=status,
                extracted_text=None,
                error=out,
            )

        created.append(r)

    return created
