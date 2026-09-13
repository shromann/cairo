-- =============================================================================
-- Cairo — development seed data
--
-- SYNTHETIC DATA ONLY.  Never substitute real patient identifiers.
-- The moment mrn + birth_date are real values, this database crosses a
-- PHI boundary that requires a full clinical data governance framework.
--
-- Usage:
--   gcloud sql connect "$SQL_INSTANCE" --user="$SQL_USER" --database="$SQL_DB" \
--     < infra/seed.sql
--
--   Or against local Docker:
--   psql postgresql://cairo_app:dev@localhost:5432/cairo < infra/seed.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Patients (synthetic)
-- ---------------------------------------------------------------------------
INSERT INTO patients (mrn, birth_date, sex)
VALUES
    ('SYNTH-0001', '1962-04-11', 'F'),
    ('SYNTH-0002', '1948-09-22', 'M'),
    ('SYNTH-0003', '1975-01-30', 'F'),
    ('SYNTH-0004', '1989-11-03', 'M'),
    ('SYNTH-0005', '1955-07-17', 'O')
ON CONFLICT (mrn) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Studies (two per patient, varied statuses for UI testing)
-- ---------------------------------------------------------------------------
INSERT INTO studies (patient_id, acc_num, study_date, status)
SELECT
    p.id,
    s.acc_num,
    s.study_date::date,
    s.status
FROM (
    VALUES
        ('SYNTH-0001', 'ACC-2024-001', '2024-03-01', 'done'),
        ('SYNTH-0001', 'ACC-2024-002', '2024-06-15', 'created'),
        ('SYNTH-0002', 'ACC-2024-003', '2024-04-10', 'processing'),
        ('SYNTH-0002', 'ACC-2024-004', '2024-08-20', 'failed'),
        ('SYNTH-0003', 'ACC-2024-005', '2024-05-05', 'done'),
        ('SYNTH-0004', 'ACC-2024-006', '2024-07-22', 'created'),
        ('SYNTH-0005', 'ACC-2024-007', '2024-09-01', 'created')
) AS s(mrn, acc_num, study_date, status)
JOIN patients p ON p.mrn = s.mrn
ON CONFLICT (acc_num) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Videos (3 videos for the 'done' study ACC-2024-001)
-- GCS URIs use a synthetic bucket path; replace with real paths when testing
-- the full upload flow.
-- ---------------------------------------------------------------------------
INSERT INTO videos (study_id, video_num, gcs_uri, view, doppler, frame_count, status)
SELECT
    st.id,
    v.video_num,
    v.gcs_uri,
    v.view,
    v.doppler::boolean,
    v.frame_count::int,
    v.status
FROM (
    VALUES
        ('ACC-2024-001', 1, 'gs://cairo-hack-media/uploads/SYNTH-0001/ACC-2024-001/001.avi', 'PLAX',  'false', '80',  'done'),
        ('ACC-2024-001', 2, 'gs://cairo-hack-media/uploads/SYNTH-0001/ACC-2024-001/002.avi', 'A4C',   'false', '80',  'done'),
        ('ACC-2024-001', 3, 'gs://cairo-hack-media/uploads/SYNTH-0001/ACC-2024-001/003.avi', 'PSAX',  'true',  '64',  'done')
) AS v(acc_num, video_num, gcs_uri, view, doppler, frame_count, status)
JOIN studies st ON st.acc_num = v.acc_num
ON CONFLICT (study_id, video_num) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Video predictions (EF regression + view classification for each video)
-- Values are fabricated for UI / report testing only.
-- ---------------------------------------------------------------------------
INSERT INTO video_predictions (video_id, task_name, task_type, value, class_probs)
SELECT
    vi.id,
    p.task_name,
    p.task_type,
    p.value::double precision,
    p.class_probs::jsonb
FROM (
    VALUES
        ('ACC-2024-001', 1, 'EF',   'regression',     '55.2', NULL),
        ('ACC-2024-001', 1, 'view', 'classification',  NULL,  '{"PLAX":0.91,"A4C":0.06,"PSAX":0.03}'),
        ('ACC-2024-001', 2, 'EF',   'regression',     '57.8', NULL),
        ('ACC-2024-001', 2, 'view', 'classification',  NULL,  '{"PLAX":0.04,"A4C":0.93,"PSAX":0.03}'),
        ('ACC-2024-001', 3, 'EF',   'regression',     '53.1', NULL),
        ('ACC-2024-001', 3, 'view', 'classification',  NULL,  '{"PLAX":0.02,"A4C":0.05,"PSAX":0.93}')
) AS p(acc_num, video_num, task_name, task_type, value, class_probs)
JOIN studies  st ON st.acc_num   = p.acc_num
JOIN videos   vi ON vi.study_id  = st.id AND vi.video_num = p.video_num::int
ON CONFLICT (video_id, task_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Study predictions (aggregated from 3 videos)
-- ---------------------------------------------------------------------------
INSERT INTO study_predictions (study_id, task_name, task_type, value, class_probs, n_videos)
SELECT
    st.id,
    p.task_name,
    p.task_type,
    p.value::double precision,
    p.class_probs::jsonb,
    p.n_videos::int
FROM (
    VALUES
        ('ACC-2024-001', 'EF', 'regression', '55.4', NULL, '3')
) AS p(acc_num, task_name, task_type, value, class_probs, n_videos)
JOIN studies st ON st.acc_num = p.acc_num
ON CONFLICT (study_id, task_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Report row for the completed study
-- ---------------------------------------------------------------------------
INSERT INTO reports (study_id, gcs_uri)
SELECT
    st.id,
    'gs://cairo-hack-media/reports/SYNTH-0001/ACC-2024-001/report.pdf'
FROM studies st
WHERE st.acc_num = 'ACC-2024-001'
ON CONFLICT (study_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT 'patients'          AS tbl, count(*) FROM patients
UNION ALL
SELECT 'studies',                   count(*) FROM studies
UNION ALL
SELECT 'videos',                    count(*) FROM videos
UNION ALL
SELECT 'video_predictions',         count(*) FROM video_predictions
UNION ALL
SELECT 'study_predictions',         count(*) FROM study_predictions
UNION ALL
SELECT 'reports',                   count(*) FROM reports;
