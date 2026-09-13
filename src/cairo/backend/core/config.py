from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

__all__ = ["Settings", "settings", "get_settings"]


class Settings(BaseSettings):
    """Application-wide configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = Field(
        default="development",
        description="Runtime environment. Controls log verbosity and safety guards.",
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Structlog minimum level.",
    )

    sql_connection_name: str | None = Field(
        default=None,
        description=(
            "Cloud SQL connection name: PROJECT:REGION:INSTANCE. "
            "Set by src/cairo/ops/scripts/04-database.sh and stored in env.sh as SQL_CONNECTION."
        ),
        alias="SQL_CONNECTION",
    )
    db_user: str = Field(default="cairo_app", description="PostgreSQL user.", alias="DB_USER")
    db_password: SecretStr = Field(
        default=SecretStr("dev"),
        description="PostgreSQL password. In production, sourced from Secret Manager.",
        alias="DB_PASSWORD",
    )
    db_name: str = Field(default="cairo", description="PostgreSQL database name.", alias="DB_NAME")

    database_url: str | None = Field(
        default=None,
        description=(
            "Direct SQLAlchemy URL. When set, the Cloud SQL connector is NOT used. "
            "Intended for local Docker-based Postgres only."
        ),
        alias="DATABASE_URL",
    )

    db_pool_size: int = Field(
        default=2,
        ge=1,
        le=20,
        description=(
            "SQLAlchemy pool_size per Cloud Run instance. "
            "pool_size=2 with 50 instances = 100 connections max. "
            "Do not raise without also raising Cloud SQL max_connections."
        ),
    )
    db_max_overflow: int = Field(
        default=2,
        ge=0,
        le=10,
        description="Extra connections beyond pool_size allowed in burst.",
    )
    db_pool_recycle: int = Field(
        default=1800,
        description="Seconds before a connection is recycled. Prevents stale sockets.",
    )

    gcs_bucket: str = Field(
        default="cairo-hack-media",
        description="GCS bucket for AVI uploads and PDF reports.",
        alias="BUCKET_MEDIA",
    )
    gcs_upload_prefix: str = Field(default="uploads/", description="GCS key prefix for raw AVI uploads.")
    gcs_reports_prefix: str = Field(default="reports/", description="GCS key prefix for generated PDF reports.")
    signed_url_expiry_seconds: int = Field(
        default=900,
        description="Signed URL validity window in seconds (default 15 min).",
    )

    pubsub_topic: str = Field(default="video-jobs", description="Pub/Sub topic name for video processing jobs.", alias="TOPIC")
    pubsub_batch_size: int = Field(
        default=8,
        ge=1,
        le=32,
        description=(
            "Number of videos per Pub/Sub message. "
            "8 enables GPU batching and fits inside the 600 s ack deadline."
        ),
    )

    @model_validator(mode="after")
    def _require_cloud_sql_in_production(self) -> "Settings":
        if self.app_env != "development" and self.database_url is None:
            if not self.sql_connection_name:
                raise ValueError(
                    "SQL_CONNECTION must be set in staging/production environments. "
                    "Run src/cairo/ops/scripts/04-database.sh and source env.sh."
                )
        return self

    @property
    def use_cloud_sql_connector(self) -> bool:
        return self.database_url is None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
