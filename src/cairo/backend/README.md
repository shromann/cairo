# cairo.backend

| module | owner / purpose |
|---|---|
| `core/config.py` | settings (pydantic-settings); `DATABASE_URL` for local, Cloud SQL connector otherwise |
| `core/db.py` | engine, `SessionLocal`, `db_session()` context manager, FastAPI `get_session` |
| `domain/models.py` | ORM for the six pipeline tables + `video_labels` (evaluation only) |
| `infrastructure/repositories.py` | all reads/writes: idempotent prediction upserts, study finalisation lock, reports |
| `services/ingest.py` | EchoNet-Dynamic -> synthetic patients/studies/videos + ground-truth labels (local dev) |
| `services/inference.py` | PanEcho inference; `predict_video()` returns `PredictionRow`s, CLI writes them via repositories |
| `services/metrics.py` | score predictions against labels; class distributions for every head |

Migrations: `alembic/versions/0001` (six tables, mirrors `src/cairo/backend/sql/schema.sql`), `0002` (`video_labels`).

## Local run
```
brew services start postgresql@17        # or the Docker command documented in core/db.py
psql -d postgres -c "create role cairo_app login password 'dev'" ; createdb -O cairo_app cairo
cp .env.example .env                     # DATABASE_URL=postgresql+pg8000://cairo_app:dev@localhost:5432/cairo
uv sync
uv run alembic -c src/cairo/backend/alembic.ini upgrade head
uv run python -m cairo.backend.services.ingest --data-dir /path/to/EchoNet-Dynamic --split TEST
uv run python -m cairo.backend.services.inference --limit 20                 # EF / LVEDV / LVESV
uv run python -m cairo.backend.services.inference --all-tasks                # all 40 PanEcho heads, every 'uploaded' video
uv run python -m cairo.backend.services.metrics --all
```
`infer` takes videos with status `uploaded`, writes rows with `write_video_predictions`
(ON CONFLICT DO NOTHING), and sets status `done` / `failed`. Re-running is a no-op.
It does **not** finalise studies or aggregate; that is `try_finalize_study` +
`write_study_predictions_with_count` in the worker.

## Cloud SQL
```
source env.sh                            # SQL_CONNECTION, DB_USER, DB_PASSWORD, DB_NAME; leave DATABASE_URL unset
uv run alembic -c src/cairo/backend/alembic.ini upgrade head
```

## Prediction row format
| task_type | `value` | `class_probs` |
|---|---|---|
| regression | estimate | NULL |
| binary_classification | P(positive) | `{"<positive class>": p}` |
| multi-class_classification | NULL | `{"<class>": p, ...}` |

PanEcho's binary heads already return P(positive) (see `forward()` in the PanEcho repo);
the positive class is the one listed in its `content/tasks.md`.

## Reference: EchoNet-Dynamic test split, zero-shot PanEcho v1.0 (4 clips x 16 frames)
| task | n | MAE | bias | r |
|---|---|---|---|---|
| EF (%) | 1277 | 5.6 | +1.6 | 0.77 |
| LVEDV (mL) | 1277 | 26.5 | -17.9 | 0.67 |
| LVESV (mL) | 1277 | 15.4 | -11.5 | 0.80 |
