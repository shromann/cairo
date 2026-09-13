"""
Alembic migration environment.

Wired to Cairo's SQLAlchemy engine and ORM metadata so that:
  - ``alembic upgrade head``  runs migrations against Cloud SQL or a local DB.
  - ``alembic revision --autogenerate``  diffs models.py against the live schema.

Connection mode is determined by the same logic as db.py:
  - DATABASE_URL set  →  direct SQLAlchemy URL (local Docker dev)
  - DATABASE_URL unset  →  Cloud SQL connector (staging / production)

Usage
-----
Local:
  export DATABASE_URL=postgresql+pg8000://cairo_app:dev@localhost:5432/cairo
  alembic upgrade head

Cloud SQL (from a machine with gcloud auth):
  source env.sh
  alembic upgrade head
"""

from __future__ import annotations

import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool

# Import Cairo's engine and metadata
from cairo.backend.db import engine
from cairo.backend.models import Base  # noqa: F401 — imports all models into metadata

# ---------------------------------------------------------------------------
# Alembic config object
# ---------------------------------------------------------------------------
config = context.config

# Wire up Python logging from alembic.ini (if running via CLI)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# Target metadata for autogenerate support
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline mode — emit SQL to stdout without a live connection
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """
    Run migrations in offline mode.

    Useful for generating a SQL script to review before applying,
    or for environments where a direct DB connection is not available.

    Usage:
        alembic upgrade head --sql
    """
    # In offline mode we need a URL; fall back to the alembic.ini value
    # if DATABASE_URL is not set.
    from cairo.backend.config import settings

    url = settings.database_url or config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Render column-level CHECK constraints in generated SQL
        render_as_batch=False,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode — use Cairo's engine (respects Cloud SQL connector)
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """
    Run migrations in online mode using Cairo's pre-built engine.

    The engine already handles Cloud SQL connector vs direct URL branching,
    so migrations work identically in local and production environments.
    """
    # Use NullPool for migrations — we don't want to hold connections open
    # across the migration run.
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,          # detect column type changes
            compare_server_default=True,  # detect server_default changes
        )

        with context.begin_transaction():
            context.run_migrations()

    logger.info("Migrations complete.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
