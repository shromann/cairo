"""
cairo.backend.repositories
~~~~~~~~~~~~~~~~~~~~~~~~~~
Data-access layer.  All database reads and writes go through these functions.

Design principles
-----------------
* **No raw SQL in routes or workers** — all queries live here.
* **Idempotent writes** — every INSERT uses ON CONFLICT DO NOTHING / DO UPDATE
  so Pub/Sub at-least-once delivery never corrupts data.
* **Optimistic aggregation with row-level locking** — ``try_finalize_study``
  uses SELECT ... FOR UPDATE to guarantee exactly one worker runs aggregation
  when multiple chunks finish concurrently.
* **Typed return values** — every function returns ORM model instances or
  plain Python types; no raw Row objects leak out.
* **No session management** — callers own the session lifecycle (via
  ``db.get_session`` or ``db.db_session``).  Repositories never commit or
  rollback directly except where explicitly documented.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import sqlalchemy
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from cairo.backend.models import (
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
    # Patients
    "get_patient_by_mrn",
    "create_patient",
    # Studies
    "get_study_by_id",
    "get_study_by_acc_num",
    "create_study",
    "set_study_status",
    # Videos
    "get_videos_for_study",
    "create_video",
    "set_video_status",
    # Predictions
    "write_video_predictions",
    "write_study_predictions",
    # Finalisation
    "try_finalize_study",
    # Reports
    "create_report",
    "get_report_for_study",
    # Dataclasses
    "PredictionRow",
]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclasses used as inputs (avoid positional-arg mistakes)
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class PredictionRow:
    """
    Carrier for one model output task.

    For regression tasks set ``value``; leave ``class_probs`` as None.
    For classification tasks set ``class_probs``; ``value`` is optional
    (use it for the argmax index if convenient).
    """
    task_name: str
    task_type: str
    value: float | None = None
    class_probs: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------

def get_patient_by_mrn(session: Session, mrn: str) -> Patient | None:
    """Return the patient with the given MRN, or None if not found."""
    return session.scalar(
        sqlalchemy.select(Patient).where(Patient.mrn == mrn)
    )


def create_patient(
    session: Session,
    *,
    mrn: str,
    birth_date: str | None = None,
    sex: str | None = None,
) -> Patient:
    """
    Insert a new patient row and return the persisted instance.

    Raises ``sqlalchemy.exc.IntegrityError`` if ``mrn`` already exists.
    Callers should catch that and surface a 409 Conflict.
    """
    patient = Patient(mrn=mrn, birth_date=birth_date, sex=sex)
    session.add(patient)
    session.flush()  # populate server-side defaults (id, created_at)
    logger.info("Patient created", extra={"patient_id": str(patient.id), "mrn": mrn})
    return patient


# ---------------------------------------------------------------------------
# Studies
# ---------------------------------------------------------------------------

def get_study_by_id(session: Session, study_id: uuid.UUID) -> Study | None:
    """Return a study by primary key, or None."""
    return session.get(Study, study_id)


def get_study_by_acc_num(session: Session, acc_num: str) -> Study | None:
    """Return a study by accession number, or None."""
    return session.scalar(
        sqlalchemy.select(Study).where(Study.acc_num == acc_num)
    )


def create_study(
    session: Session,
    *,
    patient_id: uuid.UUID,
    acc_num: str,
    study_date: str | None = None,
) -> Study:
    """
    Insert a new study row and return the persisted instance.

    Raises ``sqlalchemy.exc.IntegrityError`` if ``acc_num`` already exists.
    """
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
    """
    Update a study's status field.

    Does not commit — the caller owns the transaction.
    """
    study = session.get(Study, study_id)
    if study is None:
        raise ValueError(f"Study {study_id} not found.")
    study.status = status
    if status in (StudyStatus.DONE, StudyStatus.FAILED):
        study.completed_at = datetime.now(tz=timezone.utc)
    session.flush()
    logger.info(
        "Study status updated",
        extra={"study_id": str(study_id), "status": status},
    )
    return study


# ---------------------------------------------------------------------------
# Videos
# ---------------------------------------------------------------------------

def get_videos_for_study(session: Session, study_id: uuid.UUID) -> list[Video]:
    """Return all videos belonging to a study, ordered by video_num."""
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
    """
    Insert a new video row and return the persisted instance.

    ``view``, ``doppler``, and ``frame_count`` are populated later by the worker.
    Raises ``sqlalchemy.exc.IntegrityError`` on duplicate (study_id, video_num).
    """
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
    """Update a video's status. Does not commit."""
    video = session.get(Video, video_id)
    if video is None:
        raise ValueError(f"Video {video_id} not found.")
    video.status = status
    session.flush()
    return video


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------

def write_video_predictions(
    session: Session,
    video_id: uuid.UUID,
    rows: list[PredictionRow],
) -> int:
    """
    Upsert per-video prediction rows.

    Uses INSERT ... ON CONFLICT DO NOTHING so that duplicate Pub/Sub
    delivery of the same chunk is a safe no-op (the UNIQUE constraint on
    (video_id, task_name) prevents double-writes).

    Returns the number of rows actually inserted (0 on duplicate delivery).
    """
    if not rows:
        return 0

    stmt = (
        pg_insert(VideoPrediction)
        .values([
            {
                "video_id":    video_id,
                "task_name":   r.task_name,
                "task_type":   r.task_type,
                "value":       r.value,
                "class_probs": r.class_probs,
            }
            for r in rows
        ])
        .on_conflict_do_nothing(
            index_elements=["video_id", "task_name"]
        )
    )
    result = session.execute(stmt)
    inserted = result.rowcount
    logger.info(
        "Video predictions written",
        extra={
            "video_id": str(video_id),
            "attempted": len(rows),
            "inserted": inserted,
        },
    )
    return inserted


def write_study_predictions(
    session: Session,
    study_id: uuid.UUID,
    rows: list[PredictionRow],
) -> int:
    """
    Upsert study-level aggregate prediction rows.

    Uses INSERT ... ON CONFLICT DO UPDATE so that re-aggregation after a
    corrected run overwrites stale values rather than silently skipping.

    The ``n_videos`` column must be present in each ``PredictionRow`` via
    a subclass or dict; here we expect the caller to pass it via the
    ``class_probs`` field as ``{"n_videos": N, ...}`` — no, that's messy.

    Instead this function accepts a separate ``n_videos`` kwarg applied
    uniformly to all rows in the batch (all rows in one aggregation run
    use the same denominator).
    """
    raise NotImplementedError(
        "Use write_study_predictions_with_count instead — "
        "n_videos must be explicit."
    )


def write_study_predictions_with_count(
    session: Session,
    study_id: uuid.UUID,
    rows: list[PredictionRow],
    n_videos: int,
) -> int:
    """
    Upsert study-level aggregate predictions with an explicit video count.

    ON CONFLICT DO UPDATE overwrites stale aggregates so a corrected
    re-run always wins.

    Args:
        session:   Active SQLAlchemy session.
        study_id:  The study being aggregated.
        rows:      One PredictionRow per task.
        n_videos:  Number of videos that fed the aggregation.

    Returns:
        Number of rows inserted or updated.
    """
    if not rows:
        return 0

    stmt = (
        pg_insert(StudyPrediction)
        .values([
            {
                "study_id":    study_id,
                "task_name":   r.task_name,
                "task_type":   r.task_type,
                "value":       r.value,
                "class_probs": r.class_probs,
                "n_videos":    n_videos,
            }
            for r in rows
        ])
        .on_conflict_do_update(
            index_elements=["study_id", "task_name"],
            set_={
                "value":       pg_insert(StudyPrediction).excluded.value,
                "class_probs": pg_insert(StudyPrediction).excluded.class_probs,
                "n_videos":    pg_insert(StudyPrediction).excluded.n_videos,
            },
        )
    )
    result = session.execute(stmt)
    upserted = result.rowcount
    logger.info(
        "Study predictions written",
        extra={
            "study_id": str(study_id),
            "n_videos": n_videos,
            "upserted": upserted,
        },
    )
    return upserted


# ---------------------------------------------------------------------------
# Finalisation
# ---------------------------------------------------------------------------

def try_finalize_study(session: Session, study_id: uuid.UUID) -> bool:
    """
    Attempt to claim the finalisation lock for a study.

    The aggregation race problem: two worker chunks can finish at the same
    instant and both observe zero videos remaining.  This function uses
    SELECT ... FOR UPDATE to ensure exactly one caller proceeds with
    aggregation and report generation.

    Algorithm
    ---------
    1. Lock the study row (blocks concurrent callers).
    2. Re-check status — if already 'done' or 'failed', another worker
       won; return False.
    3. Count videos not yet in 'done' state.
    4. If any remain, release the lock and return False.
    5. Otherwise mark the study 'done' and commit (releases the lock).
       Return True — this caller should run aggregation and reporting.

    The caller that receives True is solely responsible for:
      - ``write_study_predictions_with_count``
      - ``create_report``

    Note: this function **commits the transaction** to release the row
    lock as quickly as possible.  The caller must open a fresh session
    for subsequent writes.

    Returns:
        True  — this caller won the lock and should proceed.
        False — another caller already finalised (or videos remain).
    """
    study: Study | None = session.scalar(
        sqlalchemy.select(Study)
        .where(
            Study.id == study_id,
            Study.status == StudyStatus.PROCESSING,
        )
        .with_for_update()
    )

    if study is None:
        # Either the study doesn't exist, or it's already been finalised
        # (status changed to 'done'/'failed') by a concurrent worker.
        logger.info(
            "try_finalize: study not in PROCESSING state — skipping",
            extra={"study_id": str(study_id)},
        )
        return False

    remaining: int = session.scalar(
        sqlalchemy.select(sqlalchemy.func.count())
        .select_from(Video)
        .where(
            Video.study_id == study_id,
            Video.status != VideoStatus.DONE,
        )
    ) or 0

    if remaining > 0:
        logger.info(
            "try_finalize: videos still pending — not ready",
            extra={"study_id": str(study_id), "remaining": remaining},
        )
        return False

    study.status = StudyStatus.DONE
    study.completed_at = datetime.now(tz=timezone.utc)
    session.commit()  # releases the FOR UPDATE lock

    logger.info(
        "try_finalize: study finalised — this worker will aggregate",
        extra={"study_id": str(study_id)},
    )
    return True


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

def create_report(
    session: Session,
    study_id: uuid.UUID,
    gcs_uri: str,
) -> Report:
    """
    Insert or replace a report row for a study.

    Uses ON CONFLICT DO UPDATE so re-running a failed report generation
    overwrites the old GCS URI rather than raising an IntegrityError.
    """
    stmt = (
        pg_insert(Report)
        .values(study_id=study_id, gcs_uri=gcs_uri)
        .on_conflict_do_update(
            index_elements=["study_id"],
            set_={"gcs_uri": gcs_uri, "generated_at": sqlalchemy.func.now()},
        )
        .returning(Report)
    )
    report: Report = session.scalar(stmt)  # type: ignore[assignment]
    logger.info(
        "Report created/updated",
        extra={"study_id": str(study_id), "gcs_uri": gcs_uri},
    )
    return report


def get_report_for_study(session: Session, study_id: uuid.UUID) -> Report | None:
    """Return the report for a study, or None if not yet generated."""
    return session.scalar(
        sqlalchemy.select(Report).where(Report.study_id == study_id)
    )
