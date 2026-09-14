-- =============================================================================
-- Cairo — canonical schema DDL
--
-- This file is the source of truth for the database schema.
-- It is used in two ways:
--   1. Direct apply:   gcloud sql connect ... < infra/schema.sql
--   2. Alembic:        alembic/versions/0001_initial_schema.py references
--                      these same definitions.
--
-- Run this against a fresh database (CREATE DATABASE cairo first).
-- It is idempotent: all objects use IF NOT EXISTS or are guarded by
-- the UNIQUE / CHECK constraints that would error on duplicate data.
-- =============================================================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn         text        UNIQUE NOT NULL,
    birth_date  date,
    sex         text        CHECK (sex IN ('M','F','O','U')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- studies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studies (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id   uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    acc_num      text        UNIQUE NOT NULL,
    study_date   date,
    status       text        NOT NULL DEFAULT 'created'
                             CHECK (status IN ('created','processing','done','failed')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_studies_patient_id ON studies (patient_id);
CREATE INDEX IF NOT EXISTS ix_studies_status     ON studies (status);

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id    uuid    NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    video_num   int     NOT NULL,
    gcs_uri     text    NOT NULL,
    view        text,
    doppler     boolean NOT NULL DEFAULT false,
    frame_count int,
    status      text    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','uploaded','done','failed')),
    UNIQUE (study_id, video_num)
);

CREATE INDEX IF NOT EXISTS ix_videos_study_status ON videos (study_id, status);

-- ---------------------------------------------------------------------------
-- video_predictions
--
-- One row per (video, task).  UNIQUE constraint makes duplicate Pub/Sub
-- delivery idempotent via INSERT ... ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_predictions (
    id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    uuid             NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    task_name   text             NOT NULL,
    task_type   text             NOT NULL,
    value       double precision,
    class_probs jsonb,
    UNIQUE (video_id, task_name)
);

CREATE INDEX IF NOT EXISTS ix_video_predictions_video_id ON video_predictions (video_id);

-- ---------------------------------------------------------------------------
-- study_predictions
--
-- Aggregated per-study predictions.  n_videos records the denominator.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_predictions (
    id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id    uuid             NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    task_name   text             NOT NULL,
    task_type   text             NOT NULL,
    value       double precision,
    class_probs jsonb,
    n_videos    int              NOT NULL,
    UNIQUE (study_id, task_name)
);

CREATE INDEX IF NOT EXISTS ix_study_predictions_study_id ON study_predictions (study_id);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id     uuid        NOT NULL UNIQUE REFERENCES studies(id) ON DELETE CASCADE,
    gcs_uri      text        NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Verify
-- \dt   (run in psql to list all six tables)
-- ---------------------------------------------------------------------------
