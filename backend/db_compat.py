import re

import psycopg
from psycopg.rows import dict_row


def _translate_sql(sql: str) -> str:
    # Existing SQLite queries use ? placeholders.
    sql = sql.replace("?", "%s")

    # SQLite strftime('%w', date) -> PostgreSQL day-of-week.
    sql = re.sub(
        r"strftime\('%w',\s*([a-zA-Z_][a-zA-Z0-9_.]*)\)",
        r"EXTRACT(DOW FROM TO_DATE(\1, 'YYYY-MM-DD'))::INT::TEXT",
        sql,
        flags=re.IGNORECASE,
    )

    return sql


class PostgresCompatConnection:
    """
    Small compatibility wrapper so most of the existing SQLite-style
    conn.execute(...) code can continue working while PostgreSQL is used.
    """

    def __init__(self, database_url: str):
        self._conn = psycopg.connect(
            database_url,
            row_factory=dict_row,
        )

    def execute(self, sql: str, params=None):
        cursor = self._conn.cursor()
        cursor.execute(
            _translate_sql(sql),
            tuple(params) if params is not None else (),
        )
        return cursor

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def connect_postgres(database_url: str):
    return PostgresCompatConnection(database_url)