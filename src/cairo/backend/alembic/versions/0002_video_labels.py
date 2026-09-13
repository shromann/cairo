"""video_labels — ground truth for public datasets (evaluation only).

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-12

Adds one table used to score model output against EchoNet-Dynamic labels locally.
No production code path writes to it.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "video_labels",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_name", sa.Text(), nullable=False),
        sa.Column("value", sa.Double(precision=53), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("video_id", "task_name", name="uq_videolabel_video_task"),
    )
    op.create_index("ix_video_labels_video_id", "video_labels", ["video_id"])


def downgrade() -> None:
    op.drop_index("ix_video_labels_video_id", table_name="video_labels")
    op.drop_table("video_labels")
