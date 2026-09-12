"""
cairo.backend.db
~~~~~~~~~~~~~~~~
Database engine, session factory, and dependency-injection helpers.

Two connection modes, selected automatically by the presence of DATABASE_URL:

  LOCAL (DATABASE_URL set)
    Connects directly to a local or remote PostgreSQL instance via a plain
    SQLAlchemy URL.  Use this with Docker:
      docker run -d --name cairo-pg -p 5432:5432 \\
        -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=cairo postgres:16
    Set DATABASE_URL=postgresql+pg8000://cairo_app:dev@localhost:5432/cairo

  CLOUD SQL (DATABASE_URL not set)
    Uses the Cloud SQL Python Connector.  The connector authenticates via
    the service account attached to the Cloud Run instance — no key file,
    no password in a URL, no SSH tunnel.

Usage::

    # FastAPI dependency injection
    from cairo.backend.db import get_session

    @router.get("/studies/{study_id}")
    def get_study(study_id: UUID, session: Session = Depends(get_session)):
        ...

    # Script / worker usage
    from cairo.backend.db import SessionLocal

    with SessionLocal() as session:
        ...
"""

from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

import sqlalchemy
from sqlalchemy.orm import Session, sessionmaker

from cairo.backend.config import settings

__all__ = [
    "engine",
    "SessionLocal",
    "get_session",
    "close_connector",
]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Connector lifecycle
# ---------------------------------------------------------------------------
# The Connector is kept as a module-level singleton.  It manages an internal
# thread pool and should be closed cleanly on shutdown (see close_connector).
_connector: Any = None  # google.cloud.sql.connector.Connector | None


def _build_cloud_sql_engine() -> sqlalchemy.engine.Engine:
    """Create an engine that dials Cloud SQL via the IAM connector."""
    from google.cloud.sql.connector import Connector, IPTypes

    global _connector
    _connector = Connector()

    def _getconn() -> Any:
        return _connector.connect(  # type: ignore[union-attr]
            settings.sql_connection_name,  # type: ignore[arg-type]
            "pg8000",
            user=settings.db_user,
            password=settings.db_password.get_secret_value(),
            db=settings.db_name,
            ip_type=IPTypes.PUBLIC,
        )

    logger.info(
        "Connecting via Cloud SQL connector",
        extra={"connection_name": settings.sql_connection_name},
    )
    return sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=_getconn,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,
        pool_recycle=settings.db_pool_recycle,
    )


def _build_direct_engine() -> sqlalchemy.engine.Engine:
    """Create an engine with a plain DATABASE_URL (local dev / Docker)."""
    logger.info(
        "Connecting via direct DATABASE_URL (local mode)",
        extra={"database_url": settings.database_url},
    )
    return sqlalchemy.create_engine(
        settings.database_url,  # type: ignore[arg-type]
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,
        pool_recycle=settings.db_pool_recycle,
    )


# ---------------------------------------------------------------------------
# Engine singleton
# ---------------------------------------------------------------------------
def _create_engine() -> sqlalchemy.engine.Engine:
    if settings.use_cloud_sql_connector:
        return _build_cloud_sql_engine()
    return _build_direct_engine()


engine: sqlalchemy.engine.Engine = _create_engine()

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,  # safe for background workers returning detached objects
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
def get_session() -> Generator[Session, None, None]:
    """
    Yield a database session for use as a FastAPI dependency.

    Rolls back on exception, always closes on exit.

    Example::

        @router.post("/patients")
        def create_patient(
            payload: PatientCreate,
            session: Session = Depends(get_session),
        ) -> PatientRead:
            ...
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Context manager for non-FastAPI callers (workers, scripts)
# ---------------------------------------------------------------------------
@contextmanager
def db_session() -> Generator[Session, None, None]:
    """
    Context manager that provides a transactional session.

    Rolls back on exception, always closes on exit.

    Example::

        from cairo.backend.db import db_session

        with db_session() as session:
            session.add(some_model)
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
def close_connector() -> None:
    """
    Close the Cloud SQL connector and dispose of the engine pool.

    Call from the FastAPI lifespan shutdown handler or process exit handler.
    """
    global _connector
    if _connector is not None:
        try:
            _connector.close()
            logger.info("Cloud SQL connector closed.")
        except Exception:
            logger.exception("Error closing Cloud SQL connector.")
        finally:
            _connector = None

    engine.dispose()
    logger.info("SQLAlchemy engine disposed.")
