"""Initial schema — all six Cairo tables.

Revision ID: 0001
Revises:
Create Date: 2026-09-12

This migration is the authoritative source for the database schema.
It mirrors src/cairo/backend/sql/schema.sql exactly.  Do NOT edit schema.sql and forget
to update this file — they must stay in sync.

To apply:
    # Local Docker:
    export DATABASE_URL=postgresql+pg8000://cairo_app:dev@localhost:5432/cairo
    alembic upgrade head

    # Cloud SQL:
    source env.sh
    alembic upgrade head
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ---------------------------------------------------------------------------
# Alembic revision metadata
# ---------------------------------------------------------------------------
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------
def upgrade() -> None:
    # ------------------------------------------------------------------
    # pgcrypto — required for gen_random_uuid()
    # ------------------------------------------------------------------
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # ------------------------------------------------------------------
    # patients
    # ------------------------------------------------------------------
    op.create_table(
        "patients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("mrn", sa.Text(), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column(
            "sex",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("sex IN ('M','F','O','U')", name="patients_sex_check"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mrn"),
    )

    # ------------------------------------------------------------------
    # studies
    # ------------------------------------------------------------------
    op.create_table(
        "studies",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("acc_num", sa.Text(), nullable=False),
        sa.Column("study_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Text(),
            server_default=sa.text("'created'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('created','processing','done','failed')",
            name="studies_status_check",
        ),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("acc_num"),
    )
    op.create_index("ix_studies_patient_id", "studies", ["patient_id"])
    op.create_index("ix_studies_status", "studies", ["status"])

    # ------------------------------------------------------------------
    # videos
    # ------------------------------------------------------------------
    op.create_table(
        "videos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("study_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("video_num", sa.Integer(), nullable=False),
        sa.Column("gcs_uri", sa.Text(), nullable=False),
        sa.Column("view", sa.Text(), nullable=True),
        sa.Column(
            "doppler",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("frame_count", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Text(),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending','uploaded','done','failed')",
            name="videos_status_check",
        ),
        sa.ForeignKeyConstraint(["study_id"], ["studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("study_id", "video_num", name="uq_videos_study_video_num"),
    )
    op.create_index("ix_videos_study_status", "videos", ["study_id", "status"])

    # ------------------------------------------------------------------
    # video_predictions
    # ------------------------------------------------------------------
    op.create_table(
        "video_predictions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_name", sa.Text(), nullable=False),
        sa.Column("task_type", sa.Text(), nullable=False),
        sa.Column("value", sa.Double(precision=53), nullable=True),
        sa.Column("class_probs", postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "video_id", "task_name", name="uq_videopred_video_task"
        ),
    )
    op.create_index(
        "ix_video_predictions_video_id", "video_predictions", ["video_id"]
    )

    # ------------------------------------------------------------------
    # study_predictions
    # ------------------------------------------------------------------
    op.create_table(
        "study_predictions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("study_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_name", sa.Text(), nullable=False),
        sa.Column("task_type", sa.Text(), nullable=False),
        sa.Column("value", sa.Double(precision=53), nullable=True),
        sa.Column("class_probs", postgresql.JSONB(), nullable=True),
        sa.Column("n_videos", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["study_id"], ["studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "study_id", "task_name", name="uq_studypred_study_task"
        ),
    )
    op.create_index(
        "ix_study_predictions_study_id", "study_predictions", ["study_id"]
    )

    # ------------------------------------------------------------------
    # reports
    # ------------------------------------------------------------------
    op.create_table(
        "reports",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("study_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gcs_uri", sa.Text(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["study_id"], ["studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("study_id"),
    )


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------
def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("reports")
    op.drop_index("ix_study_predictions_study_id", table_name="study_predictions")
    op.drop_table("study_predictions")
    op.drop_index("ix_video_predictions_video_id", table_name="video_predictions")
    op.drop_table("video_predictions")
    op.drop_index("ix_videos_study_status", table_name="videos")
    op.drop_table("videos")
    op.drop_index("ix_studies_status", table_name="studies")
    op.drop_index("ix_studies_patient_id", table_name="studies")
    op.drop_table("studies")
    op.drop_table("patients")
