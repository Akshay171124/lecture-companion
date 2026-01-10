import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    topics: str | None = None


class SessionOut(BaseModel):
    id: uuid.UUID
    title: str
    topics: str | None
    created_at: datetime
    question_count: int = 0

    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    text: str = Field(min_length=1)


class QuestionOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    text: str
    asked_at: datetime
    order_index: int

    class Config:
        from_attributes = True
        
class ResourceOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    filename: str
    mime_type: str | None
    status: str
    created_at: datetime
    extracted_at: datetime | None
    error: str | None

    class Config:
        from_attributes = True
