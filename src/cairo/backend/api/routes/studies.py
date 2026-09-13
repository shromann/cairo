from __future__ import annotations

import os
import uuid
from functools import lru_cache
from typing import Any

import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from cairo.backend.api.services.media import _aggregate, _local_path, _study_summary, _video_fps
from cairo.backend.core.db import get_session
from cairo.backend.domain.models import Study, Video, VideoLabel, VideoPrediction, VideoStatus
from cairo.backend.infrastructure import repositories as repo

router = APIRouter(prefix="/api", tags=["studies"])


@router.get("/studies")
def list_studies(
    limit: int = Query(50, le=500),
    scored_first: bool = True,
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    q = sqlalchemy.select(Study).options(selectinload(Study.videos), selectinload(Study.patient)).order_by(Study.acc_num)
    if scored_first:
        done_sub = sqlalchemy.select(Video.study_id).where(Video.status == VideoStatus.DONE).subquery()
        q = q.order_by(None).order_by(Study.id.in_(sqlalchemy.select(done_sub.c.study_id)).desc(), Study.acc_num)
    studies = list(session.scalars(q.limit(limit)))
    if not studies:
        return []
    video_ids = [v.id for s in studies for v in s.videos]
    labels: dict[uuid.UUID, dict[str, float]] = {}
    for vid, task, val in session.execute(
        sqlalchemy.select(VideoLabel.video_id, VideoLabel.task_name, VideoLabel.value).where(VideoLabel.video_id.in_(video_ids))
    ):
        labels.setdefault(vid, {})[task] = val
    ef_pred: dict[uuid.UUID, float] = dict(
        session.execute(
            sqlalchemy.select(VideoPrediction.video_id, VideoPrediction.value)
            .where(VideoPrediction.video_id.in_(video_ids), VideoPrediction.task_name == "EF")
        ).all()
    )
    out: list[dict[str, Any]] = []
    for study in studies:
        lab: dict[str, float] = {}
        efs: list[float] = []
        for v in study.videos:
            lab.update(labels.get(v.id, {}))
            if v.id in ef_pred:
                efs.append(ef_pred[v.id])
        out.append(_study_summary(study, lab, sum(efs) / len(efs) if efs else None))
    return out


@router.get("/studies/{acc_num}")
def get_study(acc_num: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    study = session.scalar(
        sqlalchemy.select(Study)
        .options(selectinload(Study.videos).selectinload(Video.predictions), selectinload(Study.patient))
        .where(Study.acc_num == acc_num)
    )
    if study is None:
        raise HTTPException(404, f"study {acc_num} not found")
    video_ids = [v.id for v in study.videos]
    labels: dict[str, float] = {}
    for _vid, task, val in session.execute(
        sqlalchemy.select(VideoLabel.video_id, VideoLabel.task_name, VideoLabel.value).where(VideoLabel.video_id.in_(video_ids))
    ):
        labels[task] = val
    preds = [p for v in study.videos for p in v.predictions]
    agg = _aggregate(preds)
    summary = _study_summary(study, labels, agg.get("EF", {}).get("value"))
    summary.update(
        {
            "labels": labels,
            "predictions": agg,
            "videos": [
                {
                    "id": str(v.id),
                    "video_num": v.video_num,
                    "view": v.view,
                    "status": v.status,
                    "frame_count": v.frame_count,
                    "fps": _video_fps(_local_path(v.gcs_uri)) if _local_path(v.gcs_uri) else None,
                    "stream": f"/api/videos/{v.id}/stream",
                    "n_predictions": len(v.predictions),
                }
                for v in study.videos
            ],
        }
    )
    return summary


@lru_cache(maxsize=1)
def _model():
    from cairo.backend.services.inference import load_model

    return load_model("all")


@router.post("/studies/{acc_num}/infer")
def infer_study(acc_num: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    """Synchronous PanEcho run over the study's videos (local dev; the real pipeline uses Pub/Sub workers)."""
    from cairo.backend.services.inference import predict_video, resolve_uri

    study = session.scalar(sqlalchemy.select(Study).options(selectinload(Study.videos)).where(Study.acc_num == acc_num))
    if study is None:
        raise HTTPException(404, f"study {acc_num} not found")
    model, device = _model()
    inserted, failed = 0, 0
    for video in study.videos:
        path, tmp = resolve_uri(video.gcs_uri)
        try:
            rows, n_frames = predict_video(model, device, path)
            inserted += repo.write_video_predictions(session, video.id, rows)
            if video.frame_count is None:
                video.frame_count = n_frames
            repo.set_video_status(session, video.id, VideoStatus.DONE)
        except Exception:
            failed += 1
            repo.set_video_status(session, video.id, VideoStatus.FAILED)
        finally:
            if tmp:
                os.unlink(tmp)
    session.commit()
    return {"study": acc_num, "videos": len(study.videos), "rows_inserted": inserted, "failed": failed, "device": device}
