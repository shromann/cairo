"""
cairo.backend.api
~~~~~~~~~~~~~~~~~
FastAPI service the frontend talks to.

    uv run uvicorn cairo.backend.api:app --reload --port 8000

Endpoints
---------
GET  /api/health
GET  /api/studies?limit=50            studies for the selector (with labels + predicted EF if scored)
GET  /api/studies/{acc_num}           study detail: videos, per-task predictions (averaged over videos), labels
POST /api/studies/{acc_num}/infer     run PanEcho on the study's videos synchronously (dev convenience)
GET  /api/videos/{video_id}/stream    browser-playable MP4 (file:// AVIs transcoded once with ffmpeg and cached)

Reads go through the ORM; writes go through repositories (same code as the worker).
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

import sqlalchemy
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, selectinload

from cairo.backend import repositories as repo
from cairo.backend.db import get_session
from cairo.backend.models import Patient, Study, Video, VideoLabel, VideoPrediction, VideoStatus

app = FastAPI(title="cairo", version="0.1.0")
# Dev: the Astro dev server on :4321 calls the API cross-origin. Prod: same origin (frontend served below).
_extra_origins = [o for o in os.environ.get("CAIRO_CORS_ORIGINS", "").split(",") if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321", "http://127.0.0.1:4321", *_extra_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

MP4_CACHE = Path(os.environ.get("CAIRO_MP4_CACHE", Path.home() / ".cache" / "cairo" / "mp4"))
GCS_CACHE = MP4_CACHE / "src"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _aggregate(preds: list[VideoPrediction]) -> dict[str, dict[str, Any]]:
    """Average per-video predictions into one entry per task (mean value / mean probs)."""
    acc: dict[str, dict[str, Any]] = {}
    for p in preds:
        a = acc.setdefault(p.task_name, {"task_type": p.task_type, "values": [], "probs": [], "n": 0})
        a["n"] += 1
        if p.value is not None:
            a["values"].append(p.value)
        if isinstance(p.class_probs, dict):
            a["probs"].append(p.class_probs)
    out: dict[str, dict[str, Any]] = {}
    for name, a in acc.items():
        entry: dict[str, Any] = {"task_type": a["task_type"], "n_videos": a["n"], "value": None, "class_probs": None}
        if a["values"]:
            entry["value"] = sum(a["values"]) / len(a["values"])
        if a["probs"]:
            keys = a["probs"][0].keys()
            entry["class_probs"] = {k: sum(d.get(k, 0.0) for d in a["probs"]) / len(a["probs"]) for k in keys}
        out[name] = entry
    return out


def _video_fps(path: str) -> float | None:
    try:
        import cv2
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS) or None
        cap.release()
        return float(fps) if fps else None
    except Exception:
        return None


def _local_path(uri: str) -> str | None:
    return uri[len("file://"):] if uri.startswith("file://") else None


def _study_summary(s: Study, labels: dict[str, float], pred_ef: float | None) -> dict[str, Any]:
    v0 = s.videos[0] if s.videos else None
    return {
        "id": s.acc_num,
        "study_id": str(s.id),
        "patient_mrn": s.patient.mrn if s.patient else None,
        "status": s.status,
        "n_videos": len(s.videos),
        "n_done": sum(1 for v in s.videos if v.status == VideoStatus.DONE),
        "label": s.acc_num,
        "ef": labels.get("EF"), "edv": labels.get("LVEDV"), "esv": labels.get("LVESV"),
        "ef_pred": pred_ef,
        "frames": v0.frame_count if v0 else None,
        "video": f"/api/videos/{v0.id}/stream" if v0 else None,
    }


# ---------------------------------------------------------------------------
# routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health(session: Session = Depends(get_session)) -> dict[str, Any]:
    n = session.scalar(sqlalchemy.select(sqlalchemy.func.count()).select_from(Study)) or 0
    return {"ok": True, "studies": n}


@app.get("/api/studies")
def list_studies(limit: int = Query(50, le=500), scored_first: bool = True,
                 session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    q = (sqlalchemy.select(Study)
         .options(selectinload(Study.videos), selectinload(Study.patient))
         .order_by(Study.acc_num))
    if scored_first:
        done_sub = (sqlalchemy.select(Video.study_id).where(Video.status == VideoStatus.DONE)).subquery()
        q = q.order_by(None).order_by(Study.id.in_(sqlalchemy.select(done_sub.c.study_id)).desc(), Study.acc_num)
    studies = list(session.scalars(q.limit(limit)))
    if not studies:
        return []
    vids = [v.id for s in studies for v in s.videos]
    labels: dict[uuid.UUID, dict[str, float]] = {}
    for vid, task, val in session.execute(
        sqlalchemy.select(VideoLabel.video_id, VideoLabel.task_name, VideoLabel.value).where(VideoLabel.video_id.in_(vids))
    ):
        labels.setdefault(vid, {})[task] = val
    ef_pred: dict[uuid.UUID, float] = dict(session.execute(
        sqlalchemy.select(VideoPrediction.video_id, VideoPrediction.value)
        .where(VideoPrediction.video_id.in_(vids), VideoPrediction.task_name == "EF")
    ).all())
    out = []
    for s in studies:
        lab: dict[str, float] = {}
        efs = []
        for v in s.videos:
            lab.update(labels.get(v.id, {}))
            if v.id in ef_pred:
                efs.append(ef_pred[v.id])
        out.append(_study_summary(s, lab, sum(efs) / len(efs) if efs else None))
    return out


@app.get("/api/studies/{acc_num}")
def get_study(acc_num: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    s = session.scalar(
        sqlalchemy.select(Study)
        .options(selectinload(Study.videos).selectinload(Video.predictions), selectinload(Study.patient))
        .where(Study.acc_num == acc_num)
    )
    if s is None:
        raise HTTPException(404, f"study {acc_num} not found")
    vids = [v.id for v in s.videos]
    labels: dict[str, float] = {}
    for _vid, task, val in session.execute(
        sqlalchemy.select(VideoLabel.video_id, VideoLabel.task_name, VideoLabel.value).where(VideoLabel.video_id.in_(vids))
    ):
        labels[task] = val
    preds = [p for v in s.videos for p in v.predictions]
    agg = _aggregate(preds)
    summary = _study_summary(s, labels, agg.get("EF", {}).get("value"))
    summary.update({
        "labels": labels,
        "predictions": agg,
        "videos": [{
            "id": str(v.id), "video_num": v.video_num, "view": v.view, "status": v.status,
            "frame_count": v.frame_count,
            "fps": _video_fps(_local_path(v.gcs_uri)) if _local_path(v.gcs_uri) else None,
            "stream": f"/api/videos/{v.id}/stream",
            "n_predictions": len(v.predictions),
        } for v in s.videos],
    })
    return summary


@lru_cache(maxsize=1)
def _model():
    from cairo.backend.infer import load_model
    return load_model("all")


@app.post("/api/studies/{acc_num}/infer")
def infer_study(acc_num: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    """Synchronous PanEcho run over the study's videos (local dev; the real pipeline uses Pub/Sub workers)."""
    from cairo.backend.infer import predict_video, resolve_uri
    s = session.scalar(sqlalchemy.select(Study).options(selectinload(Study.videos)).where(Study.acc_num == acc_num))
    if s is None:
        raise HTTPException(404, f"study {acc_num} not found")
    model, device = _model()
    inserted, failed = 0, 0
    for v in s.videos:
        path, tmp = resolve_uri(v.gcs_uri)
        try:
            rows, n_frames = predict_video(model, device, path)
            inserted += repo.write_video_predictions(session, v.id, rows)
            if v.frame_count is None:
                v.frame_count = n_frames
            repo.set_video_status(session, v.id, VideoStatus.DONE)
        except Exception:
            failed += 1
            repo.set_video_status(session, v.id, VideoStatus.FAILED)
        finally:
            if tmp:
                os.unlink(tmp)
    session.commit()
    return {"study": acc_num, "videos": len(s.videos), "rows_inserted": inserted, "failed": failed, "device": device}


@app.get("/api/videos/{video_id}/stream")
def stream_video(video_id: uuid.UUID, session: Session = Depends(get_session)) -> FileResponse:
    v = session.get(Video, video_id)
    if v is None:
        raise HTTPException(404, "video not found")
    src = _local_path(v.gcs_uri)
    if src is None and v.gcs_uri.startswith("gs://"):
        # download once into the instance's cache (Cloud Run: /tmp), then transcode like a local file
        from google.cloud import storage
        bucket, blob = v.gcs_uri[5:].split("/", 1)
        GCS_CACHE.mkdir(parents=True, exist_ok=True)
        src = str(GCS_CACHE / (hashlib.sha1(v.gcs_uri.encode()).hexdigest() + os.path.splitext(blob)[1]))
        if not os.path.exists(src):
            storage.Client().bucket(bucket).blob(blob).download_to_filename(src)
    if src is None:
        raise HTTPException(501, f"unsupported video uri scheme: {v.gcs_uri}")
    if not os.path.exists(src):
        raise HTTPException(404, f"file missing: {src}")
    MP4_CACHE.mkdir(parents=True, exist_ok=True)
    out = MP4_CACHE / (hashlib.sha1(src.encode()).hexdigest() + ".mp4")
    if not out.exists():
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", str(out)], check=True)
    return FileResponse(str(out), media_type="video/mp4")


# ---------------------------------------------------------------------------
# built frontend (production container): everything not under /api is the Astro site
# ---------------------------------------------------------------------------
_static = os.environ.get("CAIRO_STATIC_DIR")
if _static and os.path.isdir(_static):
    app.mount("/", StaticFiles(directory=_static, html=True), name="frontend")
