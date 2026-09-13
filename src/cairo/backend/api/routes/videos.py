from __future__ import annotations

import hashlib
import os
import subprocess
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from cairo.backend.api.services.media import GCS_CACHE, MP4_CACHE, _local_path, cache_gcs_video, transcode_video_to_mp4
from cairo.backend.core.db import get_session
from cairo.backend.domain.models import Video

router = APIRouter(tags=["videos"])


@router.get("/api/videos/{video_id}/stream")
def stream_video(video_id: uuid.UUID, session: Session = Depends(get_session)) -> FileResponse:
    video = session.get(Video, video_id)
    if video is None:
        raise HTTPException(404, "video not found")
    src = _local_path(video.gcs_uri)
    if src is None and video.gcs_uri.startswith("gs://"):
        src = cache_gcs_video(video.gcs_uri)
    if src is None:
        raise HTTPException(501, f"unsupported video uri scheme: {video.gcs_uri}")
    if not os.path.exists(src):
        raise HTTPException(404, f"file missing: {src}")
    out = transcode_video_to_mp4(src)
    return FileResponse(out, media_type="video/mp4")
