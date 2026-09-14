from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

import sqlalchemy
from sqlalchemy.orm import Session, sessionmaker

from cairo.backend.core.config import settings

__all__ = ["engine", "SessionLocal", "get_session", "db_session", "close_connector"]

logger = logging.getLogger(__name__)

_connector: Any = None


def _build_cloud_sql_engine() -> sqlalchemy.engine.Engine:
    """Create an engine that dials Cloud SQL via the IAM connector."""
    from google.cloud.sql.connector import Connector, IPTypes

    global _connector
    _connector = Connector()

    def _getconn() -> Any:
        return _connector.connect(  # type: ignore[union-attr]
            settings.sql_connection_name,
            "pg8000",
            user=settings.db_user,
            password=settings.db_password.get_secret_value(),
            db=settings.db_name,
            ip_type=IPTypes.PUBLIC,
        )

    logger.info("Connecting via Cloud SQL connector", extra={"connection_name": settings.sql_connection_name})
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
    logger.info("Connecting via direct DATABASE_URL (local mode)", extra={"database_url": settings.database_url})
    return sqlalchemy.create_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,
        pool_recycle=settings.db_pool_recycle,
    )


def _create_engine() -> sqlalchemy.engine.Engine:
    if settings.use_cloud_sql_connector:
        return _build_cloud_sql_engine()
    return _build_direct_engine()


engine: sqlalchemy.engine.Engine = _create_engine()
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def close_connector() -> None:
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
