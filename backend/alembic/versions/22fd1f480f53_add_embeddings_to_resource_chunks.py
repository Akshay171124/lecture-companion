from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "22fd1f480f53"
down_revision = "ab12cd34ef56"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.add_column("resource_chunks", sa.Column("embedding", Vector(768), nullable=True))

def downgrade() -> None:
    op.drop_column("resource_chunks", "embedding")
