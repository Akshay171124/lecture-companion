from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "xxxx_add_chunk_embeddings"
down_revision = "9c0d1e2f3a4b"

def upgrade():
    # enable pgvector
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # add embedding column
    op.add_column("resource_chunks", sa.Column("embedding", Vector(768), nullable=True))

    # optional but recommended index for cosine distance
    # (works best once you have many rows; fine for MVP too)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chunks_embedding_cosine "
        "ON resource_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"
    )

def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_cosine;")
    op.drop_column("resource_chunks", "embedding")
