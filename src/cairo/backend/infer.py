"""
cairo.backend.infer
~~~~~~~~~~~~~~~~~~~
Run PanEcho over videos and persist results through ``repositories.write_video_predictions``.

    python -m cairo.backend.infer                       # every video with status 'uploaded'
    python -m cairo.backend.infer --study <acc_num>     # one study
    python -m cairo.backend.infer --limit 20 --all-tasks
    python -m cairo.backend.infer --rerun               # include 'done' videos (rows already present are kept)

Row format written to ``video_predictions`` (one per video x task; duplicates are no-ops):

    regression    value = estimate,     class_probs = NULL
    binary        value = P(positive),  class_probs = {positive_class: p}
    multi-class   value = NULL,         class_probs = {class: p, ...}

Preprocessing mirrors PanEcho's own loader: ``clip_len`` consecutive frames, resize 256
(INTER_AREA), centre-crop 224, /255, ImageNet-normalise, (3,T,H,W).  ``num_clips`` evenly
spaced clips per video are averaged.  ``gcs_uri`` may be ``file://`` or ``gs://``.

This is the same code path a Pub/Sub worker would call per video: ``predict_video`` returns
``PredictionRow`` objects, the caller writes them and flips the video status.
"""

from __future__ import annotations

import argparse
import logging
import os
import tempfile

import cv2
import numpy as np
import sqlalchemy
import torch

from cairo.backend import repositories as repo
from cairo.backend.db import db_session
from cairo.backend.models import Study, Video, VideoStatus
from cairo.backend.repositories import PredictionRow

logger = logging.getLogger(__name__)

_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1, 1)
_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1, 1)
DEFAULT_TASKS = ["EF", "LVEDV", "LVESV"]


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def load_model(tasks: list[str] | str = DEFAULT_TASKS, clip_len: int = 16, device: str | None = None):
    device = device or ("mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu")
    model = torch.hub.load("CarDS-Yale/PanEcho", "PanEcho", clip_len=clip_len, tasks=tasks,
                           trust_repo=True, verbose=False).to(device).eval()
    return model, device


# ---------------------------------------------------------------------------
# Video I/O + preprocessing
# ---------------------------------------------------------------------------

def resolve_uri(uri: str) -> tuple[str, str | None]:
    """Return (local_path, tmp_path_to_delete_or_None)."""
    if uri.startswith("file://"):
        return uri[len("file://"):], None
    if uri.startswith("gs://"):
        from google.cloud import storage
        bucket, blob = uri[5:].split("/", 1)
        tmp = tempfile.NamedTemporaryFile(suffix=os.path.splitext(blob)[1], delete=False)
        storage.Client().bucket(bucket).blob(blob).download_to_filename(tmp.name)
        return tmp.name, tmp.name
    return uri, None


def read_frames(path: str) -> list[np.ndarray]:
    cap = cv2.VideoCapture(path)
    frames: list[np.ndarray] = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    cap.release()
    if not frames:
        raise RuntimeError(f"no frames read from {path}")
    return frames


def make_clip(frames: list[np.ndarray], clip_len: int, start: int) -> torch.Tensor:
    v = [cv2.resize(frames[min(start + i, len(frames) - 1)], (256, 256), interpolation=cv2.INTER_AREA)[16:240, 16:240]
         for i in range(clip_len)]
    x = torch.from_numpy(np.stack(v)).permute(3, 0, 1, 2).float() / 255.0
    return (x - _MEAN) / _STD


def clip_starts(n_frames: int, clip_len: int, num_clips: int) -> list[int]:
    if num_clips == 1 or n_frames <= clip_len:
        return [0] * num_clips
    return list(np.linspace(0, n_frames - clip_len, num_clips).astype(int))


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def predict_video(model, device: str, path: str, clip_len: int = 16, num_clips: int = 4) -> tuple[list[PredictionRow], int]:
    """Run PanEcho on one video file. Returns (rows, frame_count)."""
    frames = read_frames(path)
    x = torch.stack([make_clip(frames, clip_len, st) for st in clip_starts(len(frames), clip_len, num_clips)]).to(device)
    with torch.no_grad():
        out = model(x)

    rows: list[PredictionRow] = []
    for task in model.tasks:
        val = out[task.task_name].detach().float().cpu().numpy().mean(0).reshape(-1)
        names = [str(c) for c in task.class_names]
        if task.task_type == "regression":
            rows.append(PredictionRow(task.task_name, task.task_type, value=float(val[0])))
        elif task.task_type == "binary_classification":
            # PanEcho's forward() guarantees the single output is P(positive); positive = tasks.md 'Classes'
            rows.append(PredictionRow(task.task_name, task.task_type, value=float(val[0]),
                                      class_probs={names[0]: float(val[0])}))
        else:
            rows.append(PredictionRow(task.task_name, task.task_type,
                                      class_probs={n: float(p) for n, p in zip(names, val)}))
    return rows, len(frames)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--study", default=None, help="acc_num of one study")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--rerun", action="store_true", help="also process videos already 'done'")
    ap.add_argument("--clip-len", type=int, default=16)
    ap.add_argument("--num-clips", type=int, default=4)
    ap.add_argument("--tasks", nargs="*", default=DEFAULT_TASKS)
    ap.add_argument("--all-tasks", action="store_true")
    a = ap.parse_args()

    model, device = load_model("all" if a.all_tasks else a.tasks, a.clip_len)

    with db_session() as s:
        q = sqlalchemy.select(Video).join(Study).order_by(Study.acc_num, Video.video_num)
        q = q.where(Video.status.in_([VideoStatus.UPLOADED, VideoStatus.DONE]) if a.rerun
                    else Video.status == VideoStatus.UPLOADED)
        if a.study:
            q = q.where(Study.acc_num == a.study)
        if a.limit:
            q = q.limit(a.limit)
        videos = list(s.scalars(q))
        print(f"{len(videos)} videos, {len(model.tasks)} tasks, device {device}")

        inserted = 0
        for k, v in enumerate(videos, 1):
            path, tmp = resolve_uri(v.gcs_uri)
            try:
                rows, n_frames = predict_video(model, device, path, a.clip_len, a.num_clips)
                inserted += repo.write_video_predictions(s, v.id, rows)
                if v.frame_count is None:
                    v.frame_count = n_frames
                repo.set_video_status(s, v.id, VideoStatus.DONE)
            except Exception:
                logger.exception("inference failed", extra={"video_id": str(v.id), "gcs_uri": v.gcs_uri})
                repo.set_video_status(s, v.id, VideoStatus.FAILED)
            finally:
                if tmp:
                    os.unlink(tmp)
            if k % 50 == 0 or k == len(videos):
                s.commit()
                print(f"  [{k}/{len(videos)}] rows inserted so far: {inserted}", flush=True)


if __name__ == "__main__":
    main()
