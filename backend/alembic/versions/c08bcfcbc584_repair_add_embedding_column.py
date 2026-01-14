"""repair add embedding column

Revision ID: c08bcfcbc584
Revises: 22fd1f480f53
Create Date: 2026-01-14 07:02:06.500350

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = 'c08bcfcbc584'
down_revision = '22fd1f480f53'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute("ALTER TABLE resource_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);")

def downgrade():
    op.execute("ALTER TABLE resource_chunks DROP COLUMN IF EXISTS embedding;")