"""add answers table

Revision ID: ab12cd34ef56
Revises: 9c0d1e2f3a4b
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "ab12cd34ef56"
down_revision = "9c0d1e2f3a4b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("answer_md", sa.Text(), nullable=False),
        sa.Column("sources_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("question_id", name="uq_answers_question_id"),
    )
    op.create_index("ix_answers_session", "answers", ["session_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_answers_session", table_name="answers")
    op.drop_table("answers")
