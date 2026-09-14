from __future__ import annotations

import argparse
import logging
import os
import tempfile

import cv2
import numpy as np
import sqlalchemy
import torch

from cairo.backend.core.db import db_session
from cairo.backend.domain.models import Study, Video, VideoStatus
from cairo.backend.infrastructure.repositories import PredictionRow, write_video_predictions

logger = logging.getLogger(__name__)

_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1, 1)
_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1, 1)
DEFAULT_TASKS = ["EF", "LVEDV", "LVESV"]


def load_model(tasks: list[str] | str = DEFAULT_TASKS, clip_len: int = 16, device: str | None = None):
    device = device or ("mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu")
    model = torch.hub.load("CarDS-Yale/PanEcho", "PanEcho", clip_len=clip_len, tasks=tasks, trust_repo=True, verbose=False).to(device).eval()
    return model, device


def resolve_uri(uri: str) -> tuple[str, str | None]:
    if uri.startswith("file://"):
        return uri[len("file://") :], None
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
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()
    if not frames:
        raise RuntimeError(f"no frames read from {path}")
    return frames


def make_clip(frames: list[np.ndarray], clip_len: int, start: int) -> torch.Tensor:
    video = [
        cv2.resize(frames[min(start + i, len(frames) - 1)], (256, 256), interpolation=cv2.INTER_AREA)[16:240, 16:240]
        for i in range(clip_len)
    ]
    x = torch.from_numpy(np.stack(video)).permute(3, 0, 1, 2).float() / 255.0
    return (x - _MEAN) / _STD


def clip_starts(n_frames: int, clip_len: int, num_clips: int) -> list[int]:
    if num_clips == 1 or n_frames <= clip_len:
        return [0] * num_clips
    return list(np.linspace(0, n_frames - clip_len, num_clips).astype(int))


def predict_video(model, device: str, path: str, clip_len: int = 16, num_clips: int = 4) -> tuple[list[PredictionRow], int]:
    frames = read_frames(path)
    x = torch.stack([make_clip(frames, clip_len, st) for st in clip_starts(len(frames), clip_len, num_clips)]).to(device)
    with torch.no_grad():
        out = model(x)

    rows: list[PredictionRow] = []
    for task in model.tasks:
        value = out[task.task_name].detach().float().cpu().numpy().mean(0).reshape(-1)
        names = [str(class_name) for class_name in task.class_names]
        if task.task_type == "regression":
            rows.append(PredictionRow(task.task_name, task.task_type, value=float(value[0])))
        elif task.task_type == "binary_classification":
            rows.append(
                PredictionRow(task.task_name, task.task_type, value=float(value[0]), class_probs={names[0]: float(value[0])})
            )
        else:
            rows.append(
                PredictionRow(
                    task.task_name,
                    task.task_type,
                    class_probs={name: float(prob) for name, prob in zip(names, value)},
                )
            )
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
    args = ap.parse_args()

    model, device = load_model("all" if args.all_tasks else args.tasks, args.clip_len)

    with db_session() as session:
        query = sqlalchemy.select(Video).join(Study).order_by(Study.acc_num, Video.video_num)
        query = query.where(Video.status.in_([VideoStatus.UPLOADED, VideoStatus.DONE]) if args.rerun else Video.status == VideoStatus.UPLOADED)
        if args.study:
            query = query.where(Study.acc_num == args.study)
        if args.limit:
            query = query.limit(args.limit)
        videos = list(session.scalars(query))
        print(f"{len(videos)} videos, {len(model.tasks)} tasks, device {device}")

        inserted = 0
        for index, video in enumerate(videos, 1):
            path, tmp = resolve_uri(video.gcs_uri)
            try:
                rows, n_frames = predict_video(model, device, path, args.clip_len, args.num_clips)
                inserted += write_video_predictions(session, video.id, rows)
                if video.frame_count is None:
                    video.frame_count = n_frames
                video.status = VideoStatus.DONE
            except Exception:
                logger.exception("inference failed", extra={"video_id": str(video.id), "gcs_uri": video.gcs_uri})
                video.status = VideoStatus.FAILED
            finally:
                if tmp:
                    os.unlink(tmp)
            if index % 50 == 0 or index == len(videos):
                session.commit()
                print(f"  [{index}/{len(videos)}] rows inserted so far: {inserted}", flush=True)


if __name__ == "__main__":
    main()
