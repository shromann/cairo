from __future__ import annotations

import sys

import sqlalchemy

from cairo.backend.core.db import engine

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
    result = conn.execute(sqlalchemy.text(sql))
    columns = list(result.keys())
    rows = [[str(value) for value in row] for row in result]
    widths = [max(len(column), *(len(row[index]) for row in rows)) if rows else len(column) for index, column in enumerate(columns)]
    print(f"\n== {title} ==")
    print("  ".join(column.rjust(width) for column, width in zip(columns, widths)))
    for row in rows:
        print("  ".join(value.rjust(width) for value, width in zip(row, widths)))


def main() -> None:
    with engine.connect() as connection:
        _print(connection, SCORE_SQL, "scored against video_labels")
        if "--all" in sys.argv:
            _print(connection, VALUE_SQL, "value heads (regression + binary P(positive))")
            _print(connection, CLASS_SQL, "classification heads (argmax; >=0.5 for binary)")


if __name__ == "__main__":
    main()
