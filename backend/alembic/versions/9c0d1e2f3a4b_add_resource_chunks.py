"""add resource_chunks for retrieval

Revision ID: 9c0d1e2f3a4b
Revises: 7f8e9a0b1c2d
Create Date: 2026-01-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "9c0d1e2f3a4b"
down_revision = "7f8e9a0b1c2d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resource_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("resources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("page_ref", sa.String(length=50), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_chunks_resource_order", "resource_chunks", ["resource_id", "chunk_index"], unique=False)
    op.create_index("ix_chunks_session", "resource_chunks", ["session_id"], unique=False)

    # Full-text search GIN index (expression index)
    op.execute(
        "CREATE INDEX ix_chunks_text_fts ON resource_chunks USING GIN (to_tsvector('english', text));"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chunks_text_fts;")
    op.drop_index("ix_chunks_session", table_name="resource_chunks")
    op.drop_index("ix_chunks_resource_order", table_name="resource_chunks")
    op.drop_table("resource_chunks")
