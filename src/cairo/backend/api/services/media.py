from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path
from typing import Any

from cairo.backend.domain.models import Study, Video, VideoPrediction, VideoStatus

MP4_CACHE = Path(os.environ.get("CAIRO_MP4_CACHE", Path.home() / ".cache" / "cairo" / "mp4"))
GCS_CACHE = MP4_CACHE / "src"


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
            entry["class_probs"] = {
                k: sum(d.get(k, 0.0) for d in a["probs"]) / len(a["probs"]) for k in keys
            }
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
    return uri[len("file://") :] if uri.startswith("file://") else None


def _study_summary(study: Study, labels: dict[str, float], pred_ef: float | None) -> dict[str, Any]:
    v0 = study.videos[0] if study.videos else None
    return {
        "id": study.acc_num,
        "study_id": str(study.id),
        "patient_mrn": study.patient.mrn if study.patient else None,
        "status": study.status,
        "n_videos": len(study.videos),
        "n_done": sum(1 for v in study.videos if v.status == VideoStatus.DONE),
        "label": study.acc_num,
        "ef": labels.get("EF"),
        "edv": labels.get("LVEDV"),
        "esv": labels.get("LVESV"),
        "ef_pred": pred_ef,
        "frames": v0.frame_count if v0 else None,
        "video": f"/api/videos/{v0.id}/stream" if v0 else None,
    }


def build_video_stream_path(video: Video) -> str:
    return f"/api/videos/{video.id}/stream"


def cache_gcs_video(uri: str) -> str:
    """Download a gs:// video into the local cache once, returning a local filepath."""
    from google.cloud import storage

    bucket, blob = uri[5:].split("/", 1)
    GCS_CACHE.mkdir(parents=True, exist_ok=True)
    cached = GCS_CACHE / (hashlib.sha1(uri.encode()).hexdigest() + os.path.splitext(blob)[1])
    if not cached.exists():
        storage.Client().bucket(bucket).blob(blob).download_to_filename(cached)
    return str(cached)


def transcode_video_to_mp4(source_path: str) -> str:
    """Transcode source video into a browser-friendly MP4 and return its cached file path."""
    MP4_CACHE.mkdir(parents=True, exist_ok=True)
    output_path = MP4_CACHE / (hashlib.sha1(source_path.encode()).hexdigest() + ".mp4")
    if not output_path.exists():
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                source_path,
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            check=True,
        )
    return str(output_path)
