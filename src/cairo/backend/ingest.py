"""
cairo.backend.ingest
~~~~~~~~~~~~~~~~~~~~
Load EchoNet-Dynamic into the Cairo schema for local development and evaluation.

    python -m cairo.backend.ingest --data-dir /path/to/EchoNet-Dynamic [--split TEST] [--limit N] [--gcs-prefix gs://bucket/prefix]

EchoNet has no patient/study structure, so each clip becomes one synthetic patient
(mrn ``SYNTH-<clip>``), one study (acc_num = clip name) and one video (video_num 1,
view A4C, gcs_uri ``file://...``, status ``uploaded``).  Ground-truth EF/EDV/ESV go to
``video_labels``.  Re-running is a no-op for rows that already exist.
"""

from __future__ import annotations

import argparse
import csv
import os

import sqlalchemy
from sqlalchemy.dialects.postgresql import insert as pg_insert

from cairo.backend.db import db_session
from cairo.backend.models import Patient, Study, Video, VideoLabel, VideoStatus

# PanEcho task name -> FileList.csv column
LABEL_COLS = {"EF": "EF", "LVEDV": "EDV", "LVESV": "ESV"}
LABEL_SOURCE = "EchoNet-Dynamic FileList.csv"


def ingest_echonet(data_dir: str, split: str | None = None, limit: int = 0, gcs_prefix: str | None = None) -> None:
    with open(os.path.join(data_dir, "FileList.csv"), newline="") as f:
        rows = [r for r in csv.DictReader(f) if not split or r["Split"] == split.upper()]
    if limit:
        rows = rows[:limit]
    names = [r["FileName"] for r in rows]

    with db_session() as s:
        s.execute(
            pg_insert(Patient)
            .values([{"mrn": f"SYNTH-{n}"} for n in names])
            .on_conflict_do_nothing(index_elements=["mrn"])
        )
        pid = dict(s.execute(
            sqlalchemy.select(Patient.mrn, Patient.id).where(Patient.mrn.in_([f"SYNTH-{n}" for n in names]))
        ).all())

        s.execute(
            pg_insert(Study)
            .values([{"patient_id": pid[f"SYNTH-{n}"], "acc_num": n} for n in names])
            .on_conflict_do_nothing(index_elements=["acc_num"])
        )
        sid = dict(s.execute(sqlalchemy.select(Study.acc_num, Study.id).where(Study.acc_num.in_(names))).all())

        s.execute(
            pg_insert(Video)
            .values([{
                "study_id": sid[r["FileName"]],
                "video_num": 1,
                "gcs_uri": (gcs_prefix.rstrip("/") + "/" + r["FileName"] + ".avi") if gcs_prefix
                           else "file://" + os.path.join(data_dir, "Videos", r["FileName"] + ".avi"),
                "view": "A4C",
                "doppler": False,
                "frame_count": int(r["NumberOfFrames"]),
                "status": VideoStatus.UPLOADED,
            } for r in rows])
            .on_conflict_do_nothing(index_elements=["study_id", "video_num"])
        )
        vid = dict(s.execute(
            sqlalchemy.select(Study.acc_num, Video.id)
            .join(Video, Video.study_id == Study.id)
            .where(Study.acc_num.in_(names))
        ).all())

        labels = [{"video_id": vid[r["FileName"]], "task_name": t, "value": float(r[c]), "source": LABEL_SOURCE}
                  for r in rows for t, c in LABEL_COLS.items()]
        for i in range(0, len(labels), 5000):
            s.execute(pg_insert(VideoLabel).values(labels[i:i + 5000])
                      .on_conflict_do_nothing(index_elements=["video_id", "task_name"]))

    print(f"EchoNet-Dynamic: {len(rows)} clips -> patients/studies/videos, {len(labels)} label rows")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default=os.environ.get("ECHONET_DIR"), required="ECHONET_DIR" not in os.environ)
    ap.add_argument("--split", default=None, help="TRAIN / VAL / TEST (default: all)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--gcs-prefix", default=None, help="e.g. gs://cairo-hack-media/uploads/echonet -> rows use gs:// URIs")
    a = ap.parse_args()
    ingest_echonet(a.data_dir, a.split, a.limit, a.gcs_prefix)


if __name__ == "__main__":
    main()
