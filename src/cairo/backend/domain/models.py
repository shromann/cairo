from __future__ import annotations

import uuid
from datetime import date, datetime

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
from sqlalchemy.sql import text as sqlalchemy_text

__all__ = [
    "Base",
    "Patient",
    "Study",
    "Video",
    "VideoPrediction",
    "StudyPrediction",
    "Report",
    "VideoLabel",
    "StudyStatus",
    "VideoStatus",
    "Sex",
]


class StudyStatus:
    CREATED = "created"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"

    ALL = (CREATED, PROCESSING, DONE, FAILED)


class VideoStatus:
    PENDING = "pending"
    UPLOADED = "uploaded"
    DONE = "done"
    FAILED = "failed"

    ALL = (PENDING, UPLOADED, DONE, FAILED)


class Sex:
    MALE = "M"
    FEMALE = "F"
    OTHER = "O"
    UNKNOWN = "U"

    ALL = (MALE, FEMALE, OTHER, UNKNOWN)


class Base(DeclarativeBase):
    pass


class Patient(Base):
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

    studies: Mapped[list[Study]] = relationship(
        "Study", back_populates="patient", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Patient id={self.id} mrn={self.mrn!r}>"


class Study(Base):
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


class Video(Base):
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
    doppler: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sqlalchemy_text("false")
    )
    frame_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default=VideoStatus.PENDING, server_default="pending"
    )

    study: Mapped[Study] = relationship("Study", back_populates="videos")
    predictions: Mapped[list[VideoPrediction]] = relationship(
        "VideoPrediction", back_populates="video", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Video id={self.id} study_id={self.study_id}"
            f" video_num={self.video_num} status={self.status!r}>"
        )


class VideoPrediction(Base):
    __tablename__ = "video_predictions"
    __table_args__ = (
        UniqueConstraint("video_id", "task_name", name="uq_video_predictions_video_task"),
        Index("ix_video_predictions_video_id", "video_id"),
        Index("ix_video_predictions_task_name", "task_name"),
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
    value: Mapped[float | None] = mapped_column(Double, nullable=True)
    class_probs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    video: Mapped[Video] = relationship("Video", back_populates="predictions")

    def __repr__(self) -> str:
        return (
            f"<VideoPrediction id={self.id} video_id={self.video_id} task_name={self.task_name!r}"
            f" task_type={self.task_type!r}>"
        )


class StudyPrediction(Base):
    __tablename__ = "study_predictions"
    __table_args__ = (
        UniqueConstraint("study_id", "task_name", name="uq_study_predictions_study_task"),
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
    value: Mapped[float | None] = mapped_column(Double, nullable=True)
    class_probs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    n_videos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    study: Mapped[Study] = relationship("Study", back_populates="study_predictions")

    def __repr__(self) -> str:
        return (
            f"<StudyPrediction id={self.id} study_id={self.study_id} task_name={self.task_name!r}"
            f" n_videos={self.n_videos}>"
        )


class Report(Base):
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    study: Mapped[Study] = relationship("Study", back_populates="report")

    def __repr__(self) -> str:
        return f"<Report id={self.id} study_id={self.study_id} gcs_uri={self.gcs_uri!r}>"


class VideoLabel(Base):
    __tablename__ = "video_labels"
    __table_args__ = (
        UniqueConstraint("video_id", "task_name", name="uq_video_labels_video_task"),
        Index("ix_video_labels_video_id", "video_id"),
        Index("ix_video_labels_task_name", "task_name"),
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
    task_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    value: Mapped[float | None] = mapped_column(Double, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:
        return (
            f"<VideoLabel id={self.id} video_id={self.video_id} task_name={self.task_name!r}"
            f" value={self.value!r}>"
        )
