"""
cairo.backend.models
~~~~~~~~~~~~~~~~~~~~
SQLAlchemy ORM models mirroring the database schema defined in infra/schema.sql.

Design notes
------------
* Predictions are stored long-form (one row per task) rather than wide (one column
  per task).  This lets PanEcho tasks be added or removed without a schema migration.

* ``UNIQUE (video_id, task_name)`` on VideoPrediction is load-bearing for idempotency:
  Pub/Sub delivers at-least-once, so duplicate messages silently become no-ops via
  INSERT ... ON CONFLICT DO NOTHING (see repositories.py).

* ``n_videos`` on StudyPrediction records the denominator used in each aggregate.
  An EF averaged over 3 clips is a different clinical claim from one averaged over 40.

* All UUID primary keys use PostgreSQL's ``gen_random_uuid()`` server-side default so
  rows created outside the ORM (e.g. via psql seed scripts) are consistent.

* ``expire_on_commit=False`` is set on the session factory (db.py), so detached objects
  remain readable after commit — important in background workers that return results
  after closing the session.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func

__all__ = [
    "Base",
    "Patient",
    "Study",
    "Video",
    "VideoPrediction",
    "StudyPrediction",
    "Report",
    "StudyStatus",
    "VideoStatus",
    "Sex",
]

# ---------------------------------------------------------------------------
# Enumerations (kept as plain str constants to avoid a Postgres ENUM type,
# which is harder to migrate).  Validation lives in the CHECK constraints.
# ---------------------------------------------------------------------------

class StudyStatus:
    CREATED    = "created"
    PROCESSING = "processing"
    DONE       = "done"
    FAILED     = "failed"

    ALL = (CREATED, PROCESSING, DONE, FAILED)


class VideoStatus:
    PENDING  = "pending"
    UPLOADED = "uploaded"
    DONE     = "done"
    FAILED   = "failed"

    ALL = (PENDING, UPLOADED, DONE, FAILED)


class Sex:
    MALE    = "M"
    FEMALE  = "F"
    OTHER   = "O"
    UNKNOWN = "U"

    ALL = (MALE, FEMALE, OTHER, UNKNOWN)


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """Shared declarative base for all Cairo ORM models."""
    pass


# ---------------------------------------------------------------------------
# patients
# ---------------------------------------------------------------------------

class Patient(Base):
    """
    A patient record.

    ``mrn`` (Medical Record Number) is the natural key.  Use synthetic
    identifiers (e.g. SYNTH-XXXX) during development — real MRNs combined
    with ``birth_date`` constitute PHI.
    """

    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    mrn: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    birth_date: Mapped[date | None] = mapped_column(nullable=True)
    sex: Mapped[str | None] = mapped_column(
        Text,
        CheckConstraint("sex IN ('M','F','O','U')", name="patients_sex_check"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    studies: Mapped[list[Study]] = relationship(
        "Study", back_populates="patient", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Patient id={self.id} mrn={self.mrn!r}>"


# ---------------------------------------------------------------------------
# studies
# ---------------------------------------------------------------------------

class Study(Base):
    """
    One imaging session, identified by accession number.

    ``status`` drives the worker state machine:
      created -> processing -> done | failed
    """

    __tablename__ = "studies"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created','processing','done','failed')",
            name="studies_status_check",
        ),
        Index("ix_studies_patient_id", "patient_id"),
        Index("ix_studies_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
    )
    acc_num: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    study_date: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default=StudyStatus.CREATED, server_default="created"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    patient: Mapped[Patient] = relationship("Patient", back_populates="studies")
    videos: Mapped[list[Video]] = relationship(
        "Video", back_populates="study", cascade="all, delete-orphan"
    )
    study_predictions: Mapped[list[StudyPrediction]] = relationship(
        "StudyPrediction", back_populates="study", cascade="all, delete-orphan"
    )
    report: Mapped[Report | None] = relationship(
        "Report", back_populates="study", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Study id={self.id} acc_num={self.acc_num!r} status={self.status!r}>"


# ---------------------------------------------------------------------------
# videos
# ---------------------------------------------------------------------------

class Video(Base):
    """
    A single AVI clip belonging to a study.

    ``gcs_uri`` is the canonical gs://bucket/path reference.
    ``view`` and ``doppler`` are populated by the worker after inference.
    """

    __tablename__ = "videos"
    __table_args__ = (
        UniqueConstraint("study_id", "video_num", name="uq_videos_study_video_num"),
        CheckConstraint(
            "status IN ('pending','uploaded','done','failed')",
            name="videos_status_check",
        ),
        Index("ix_videos_study_status", "study_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studies.id", ondelete="CASCADE"),
        nullable=False,
    )
    video_num: Mapped[int] = mapped_column(Integer, nullable=False)
    gcs_uri: Mapped[str] = mapped_column(Text, nullable=False)
    view: Mapped[str | None] = mapped_column(Text, nullable=True)
    doppler: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    frame_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default=VideoStatus.PENDING, server_default="pending"
    )

    # Relationships
    study: Mapped[Study] = relationship("Study", back_populates="videos")
    predictions: Mapped[list[VideoPrediction]] = relationship(
        "VideoPrediction", back_populates="video", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Video id={self.id} study_id={self.study_id}"
            f" video_num={self.video_num} status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# video_predictions
# ---------------------------------------------------------------------------

class VideoPrediction(Base):
    """
    Per-video prediction output for one PanEcho task head.

    ``UNIQUE (video_id, task_name)`` makes duplicate Pub/Sub delivery a no-op
    when combined with INSERT ... ON CONFLICT DO NOTHING.

    For regression tasks: ``value`` is populated, ``class_probs`` is NULL.
    For classification tasks: ``class_probs`` is a JSONB map of label -> probability,
    ``value`` may hold the argmax class index for convenience.
    """

    __tablename__ = "video_predictions"
    __table_args__ = (
        UniqueConstraint("video_id", "task_name", name="uq_videopred_video_task"),
        Index("ix_video_predictions_video_id", "video_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
    )
    task_name: Mapped[str] = mapped_column(Text, nullable=False)
    task_type: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float | None] = mapped_column(Double(precision=53), nullable=True)
    class_probs: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    video: Mapped[Video] = relationship("Video", back_populates="predictions")

    def __repr__(self) -> str:
        return (
            f"<VideoPrediction video_id={self.video_id}"
            f" task={self.task_name!r} value={self.value}>"
        )


# ---------------------------------------------------------------------------
# study_predictions
# ---------------------------------------------------------------------------

class StudyPrediction(Base):
    """
    Study-level aggregate of per-video predictions.

    ``n_videos`` records the number of clips that fed the aggregate.
    Clinically, an EF averaged over 3 clips is a different claim from one
    averaged over 40 — this field makes that explicit in the report.

    ``UNIQUE (study_id, task_name)`` ensures aggregation is idempotent.
    """

    __tablename__ = "study_predictions"
    __table_args__ = (
        UniqueConstraint("study_id", "task_name", name="uq_studypred_study_task"),
        Index("ix_study_predictions_study_id", "study_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studies.id", ondelete="CASCADE"),
        nullable=False,
    )
    task_name: Mapped[str] = mapped_column(Text, nullable=False)
    task_type: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float | None] = mapped_column(Double(precision=53), nullable=True)
    class_probs: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    n_videos: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    study: Mapped[Study] = relationship("Study", back_populates="study_predictions")

    def __repr__(self) -> str:
        return (
            f"<StudyPrediction study_id={self.study_id}"
            f" task={self.task_name!r} value={self.value} n={self.n_videos}>"
        )


# ---------------------------------------------------------------------------
# reports
# ---------------------------------------------------------------------------

class Report(Base):
    """
    A generated PDF report for a completed study.

    One report per study (UNIQUE study_id).  The PDF is stored in GCS;
    ``gcs_uri`` is the canonical reference.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    study_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studies.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    gcs_uri: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    study: Mapped[Study] = relationship("Study", back_populates="report")

    def __repr__(self) -> str:
        return f"<Report study_id={self.study_id} gcs_uri={self.gcs_uri!r}>"
