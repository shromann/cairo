from __future__ import annotations

import argparse
import csv
import os

import sqlalchemy
from sqlalchemy.dialects.postgresql import insert as pg_insert

from cairo.backend.core.db import db_session
from cairo.backend.domain.models import Patient, Study, Video, VideoLabel, VideoStatus

LABEL_COLS = {"EF": "EF", "LVEDV": "EDV", "LVESV": "ESV"}
LABEL_SOURCE = "EchoNet-Dynamic FileList.csv"


def ingest_echonet(data_dir: str, split: str | None = None, limit: int = 0, gcs_prefix: str | None = None) -> None:
    with open(os.path.join(data_dir, "FileList.csv"), newline="") as handle:
        rows = [row for row in csv.DictReader(handle) if not split or row["Split"] == split.upper()]
    if limit:
        rows = rows[:limit]
    names = [row["FileName"] for row in rows]

    with db_session() as session:
        session.execute(
            pg_insert(Patient)
            .values([{"mrn": f"SYNTH-{name}"} for name in names])
            .on_conflict_do_nothing(index_elements=["mrn"])
        )
        patient_ids = dict(
            session.execute(
                sqlalchemy.select(Patient.mrn, Patient.id).where(Patient.mrn.in_([f"SYNTH-{name}" for name in names]))
            ).all()
        )

        session.execute(
            pg_insert(Study)
            .values([{"patient_id": patient_ids[f"SYNTH-{name}"], "acc_num": name} for name in names])
            .on_conflict_do_nothing(index_elements=["acc_num"])
        )
        study_ids = dict(session.execute(sqlalchemy.select(Study.acc_num, Study.id).where(Study.acc_num.in_(names))).all())

        session.execute(
            pg_insert(Video)
            .values(
                [
                    {
                        "study_id": study_ids[row["FileName"]],
                        "video_num": 1,
                        "gcs_uri": (gcs_prefix.rstrip("/") + "/" + row["FileName"] + ".avi") if gcs_prefix else "file://" + os.path.join(data_dir, "Videos", row["FileName"] + ".avi"),
                        "view": "A4C",
                        "doppler": False,
                        "frame_count": int(row["NumberOfFrames"]),
                        "status": VideoStatus.UPLOADED,
                    }
                    for row in rows
                ]
            )
            .on_conflict_do_nothing(index_elements=["study_id", "video_num"])
        )
        video_ids = dict(
            session.execute(
                sqlalchemy.select(Study.acc_num, Video.id)
                .join(Video, Video.study_id == Study.id)
                .where(Study.acc_num.in_(names))
            ).all()
        )

        labels = [
            {
                "video_id": video_ids[row["FileName"]],
                "task_name": task_name,
                "value": float(row[column]),
                "source": LABEL_SOURCE,
            }
            for row in rows
            for task_name, column in LABEL_COLS.items()
        ]
        for start in range(0, len(labels), 5000):
            session.execute(
                pg_insert(VideoLabel)
                .values(labels[start : start + 5000])
                .on_conflict_do_nothing(index_elements=["video_id", "task_name"])
            )

    print(f"EchoNet-Dynamic: {len(rows)} clips -> patients/studies/videos, {len(labels)} label rows")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default=os.environ.get("ECHONET_DIR"), required="ECHONET_DIR" not in os.environ)
    ap.add_argument("--split", default=None, help="TRAIN / VAL / TEST (default: all)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--gcs-prefix", default=None, help="e.g. gs://cairo-hack-media/uploads/echonet -> rows use gs:// URIs")
    args = ap.parse_args()
    ingest_echonet(args.data_dir, args.split, args.limit, args.gcs_prefix)


if __name__ == "__main__":
    main()
