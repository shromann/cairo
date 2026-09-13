from __future__ import annotations

import sqlalchemy
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from cairo.backend.core.db import get_session
from cairo.backend.domain.models import Study

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health(session: Session = Depends(get_session)) -> dict[str, object]:
    n = session.scalar(sqlalchemy.select(sqlalchemy.func.count()).select_from(Study)) or 0
    return {"ok": True, "studies": n}
