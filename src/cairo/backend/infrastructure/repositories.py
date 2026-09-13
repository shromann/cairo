from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import sqlalchemy
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from cairo.backend.domain.models import (
    Patient,
    Report,
    Study,
    StudyPrediction,
    StudyStatus,
    Video,
    VideoPrediction,
    VideoStatus,
)

__all__ = [
    "PredictionRow",
    "get_patient_by_mrn",
    "create_patient",
    "get_study_by_id",
    "get_study_by_acc_num",
    "create_study",
    "set_study_status",
    "get_videos_for_study",
    "create_video",
    "set_video_status",
    "write_video_predictions",
    "write_study_predictions",
    "try_finalize_study",
    "create_report",
    "get_report_for_study",
]

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PredictionRow:
    task_name: str
    task_type: str
    value: float | None = None
    class_probs: dict[str, Any] | None = None


def get_patient_by_mrn(session: Session, mrn: str) -> Patient | None:
    return session.scalar(sqlalchemy.select(Patient).where(Patient.mrn == mrn))


def create_patient(
    session: Session,
    *,
    mrn: str,
    birth_date: str | None = None,
    sex: str | None = None,
) -> Patient:
    patient = Patient(mrn=mrn, birth_date=birth_date, sex=sex)
    session.add(patient)
    session.flush()
    logger.info("Patient created", extra={"patient_id": str(patient.id), "mrn": mrn})
    return patient


def get_study_by_id(session: Session, study_id: uuid.UUID) -> Study | None:
    return session.get(Study, study_id)


def get_study_by_acc_num(session: Session, acc_num: str) -> Study | None:
    return session.scalar(sqlalchemy.select(Study).where(Study.acc_num == acc_num))


def create_study(
    session: Session,
    *,
    patient_id: uuid.UUID,
    acc_num: str,
    study_date: str | None = None,
) -> Study:
    study = Study(
        patient_id=patient_id,
        acc_num=acc_num,
        study_date=study_date,
        status=StudyStatus.CREATED,
    )
    session.add(study)
    session.flush()
    logger.info("Study created", extra={"study_id": str(study.id), "acc_num": acc_num})
    return study


def set_study_status(
    session: Session,
    study_id: uuid.UUID,
    status: str,
) -> Study:
    study = session.get(Study, study_id)
    if study is None:
        raise ValueError(f"Study {study_id} not found.")
    study.status = status
    if status in (StudyStatus.DONE, StudyStatus.FAILED):
        study.completed_at = datetime.now(tz=timezone.utc)
    session.flush()
    logger.info("Study status updated", extra={"study_id": str(study_id), "status": status})
    return study


def get_videos_for_study(session: Session, study_id: uuid.UUID) -> list[Video]:
    return list(
        session.scalars(
            sqlalchemy.select(Video)
            .where(Video.study_id == study_id)
            .order_by(Video.video_num)
        )
    )


def create_video(
    session: Session,
    *,
    study_id: uuid.UUID,
    video_num: int,
    gcs_uri: str,
) -> Video:
    video = Video(
        study_id=study_id,
        video_num=video_num,
        gcs_uri=gcs_uri,
        status=VideoStatus.PENDING,
    )
    session.add(video)
    session.flush()
    logger.info(
        "Video created",
        extra={"video_id": str(video.id), "study_id": str(study_id), "video_num": video_num},
    )
    return video


def set_video_status(
    session: Session,
    video_id: uuid.UUID,
    status: str,
) -> Video:
    video = session.get(Video, video_id)
    if video is None:
        raise ValueError(f"Video {video_id} not found.")
    video.status = status
    session.flush()
    return video


def write_video_predictions(
    session: Session,
    video_id: uuid.UUID,
    rows: list[PredictionRow],
) -> int:
    if not rows:
        return 0
    stmt = pg_insert(VideoPrediction).values(
        [
            {
                "video_id": video_id,
                "task_name": row.task_name,
                "task_type": row.task_type,
                "value": row.value,
                "class_probs": row.class_probs,
            }
            for row in rows
        ]
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["video_id", "task_name"])
    result = session.execute(stmt)
    return result.rowcount or 0


def write_study_predictions(
    session: Session,
    study_id: uuid.UUID,
    rows: list[PredictionRow],
    n_videos: int,
) -> int:
    if not rows:
        return 0
    stmt = pg_insert(StudyPrediction).values(
        [
            {
                "study_id": study_id,
                "task_name": row.task_name,
                "task_type": row.task_type,
                "value": row.value,
                "class_probs": row.class_probs,
                "n_videos": n_videos,
            }
            for row in rows
        ]
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["study_id", "task_name"],
        set_={
            "task_type": stmt.excluded.task_type,
            "value": stmt.excluded.value,
            "class_probs": stmt.excluded.class_probs,
            "n_videos": stmt.excluded.n_videos,
        },
    )
    result = session.execute(stmt)
    return result.rowcount or 0


def try_finalize_study(session: Session, study_id: uuid.UUID) -> bool:
    study = session.execute(
        sqlalchemy.select(Study).where(Study.id == study_id).with_for_update()
    ).scalar_one_or_none()
    if study is None:
        return False
    if any(video.status != VideoStatus.DONE for video in study.videos):
        return False
    study.status = StudyStatus.DONE
    study.completed_at = datetime.now(tz=timezone.utc)
    return True


def create_report(session: Session, *, study_id: uuid.UUID, gcs_uri: str) -> Report:
    report = Report(study_id=study_id, gcs_uri=gcs_uri)
    session.add(report)
    session.flush()
    return report


def get_report_for_study(session: Session, study_id: uuid.UUID) -> Report | None:
    return session.scalar(sqlalchemy.select(Report).where(Report.study_id == study_id))
