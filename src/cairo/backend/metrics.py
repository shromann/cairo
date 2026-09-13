"""
cairo.backend.metrics
~~~~~~~~~~~~~~~~~~~~~
Score ``video_predictions`` against ``video_labels`` and summarise every task head.

    python -m cairo.backend.metrics          # MAE / bias / r for labelled tasks
    python -m cairo.backend.metrics --all    # + value stats and class distributions for all heads
"""

from __future__ import annotations

import sys

import sqlalchemy

from cairo.backend.db import engine

SCORE_SQL = """
select p.task_name as task, count(*) as n,
       round(avg(abs(p.value - l.value))::numeric, 2) as mae,
       round(avg(p.value - l.value)::numeric, 2)      as bias,
       round(corr(p.value, l.value)::numeric, 2)      as r
from video_predictions p
join video_labels l on l.video_id = p.video_id and l.task_name = p.task_name
where p.value is not null
group by p.task_name order by p.task_name
"""

VALUE_SQL = """
select task_name as task, task_type, count(*) as n,
       round(avg(value)::numeric, 2) as mean, round(stddev(value)::numeric, 2) as sd,
       round(min(value)::numeric, 2) as min, round(max(value)::numeric, 2) as max
from video_predictions where value is not null
group by task_name, task_type order by task_type, task_name
"""

CLASS_SQL = """
with top as (
  select task_name,
         case when task_type = 'binary_classification'
              then case when value >= 0.5 then (select k from jsonb_object_keys(class_probs) k limit 1)
                        else 'not ' || (select k from jsonb_object_keys(class_probs) k limit 1) end
              else (select key from jsonb_each(class_probs) order by value desc limit 1) end as predicted
  from video_predictions where jsonb_typeof(class_probs) = 'object'
)
select task_name as task, predicted, count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (partition by task_name), 1) as pct
from top group by task_name, predicted order by task_name, n desc
"""


def _print(conn, sql: str, title: str) -> None:
    res = conn.execute(sqlalchemy.text(sql))
    cols = list(res.keys())
    rows = [[str(v) for v in r] for r in res]
    widths = [max(len(c), *(len(r[i]) for r in rows)) if rows else len(c) for i, c in enumerate(cols)]
    print(f"\n== {title} ==")
    print("  ".join(c.rjust(w) for c, w in zip(cols, widths)))
    for r in rows:
        print("  ".join(v.rjust(w) for v, w in zip(r, widths)))


def main() -> None:
    with engine.connect() as c:
        _print(c, SCORE_SQL, "scored against video_labels")
        if "--all" in sys.argv:
            _print(c, VALUE_SQL, "value heads (regression + binary P(positive))")
            _print(c, CLASS_SQL, "classification heads (argmax; >=0.5 for binary)")


if __name__ == "__main__":
    main()
