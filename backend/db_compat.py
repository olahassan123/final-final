import re
import sqlite3

import psycopg
from psycopg.rows import dict_row


SERIAL_ID_TABLES = {
    "appointments",
    "employee_shifts",
    "employees",
    "employee_specialties",
    "employee_shift_blocks",
    "users",
    "staff_users",
    "customer_users",
    "audit_log",
    "password_reset_codes",
    "chat_sessions",
}


class CompatRow(dict):
    """
    Behaves like sqlite3.Row enough for the existing code:
    row["id"] works, and row[0] also works.
    """

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


class PostgresCompatCursor:
    def __init__(self, cursor, lastrowid=None):
        self._cursor = cursor
        self.lastrowid = lastrowid

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        return CompatRow(row)

    def fetchall(self):
        return [CompatRow(row) for row in self._cursor.fetchall()]


def _translate_sql(sql: str) -> str:
    # Existing SQLite queries use ? placeholders.
    sql = sql.replace("?", "%s")

    # SQLite INSERT OR IGNORE -> PostgreSQL ON CONFLICT DO NOTHING.
    is_insert_or_ignore = bool(
        re.match(r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\b", sql, re.IGNORECASE)
    )

    if is_insert_or_ignore:
        sql = re.sub(
            r"^\s*INSERT\s+OR\s+IGNORE\s+INTO\b",
            "INSERT INTO",
            sql,
            count=1,
            flags=re.IGNORECASE,
        )

        sql = sql.rstrip().rstrip(";")
        sql += " ON CONFLICT DO NOTHING"

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
    Compatibility wrapper allowing most of the existing SQLite-style
    conn.execute(...) calls to run against PostgreSQL.
    """

    def __init__(self, database_url: str):
        self._conn = psycopg.connect(
            database_url,
            row_factory=dict_row,
        )

    def execute(self, sql: str, params=None):
        original_sql = sql.strip()

        # SQLite PRAGMA table_info(table)
        pragma_match = re.match(
            r"PRAGMA\s+table_info\(([^)]+)\)",
            original_sql,
            re.IGNORECASE,
        )

        if pragma_match:
            table_name = pragma_match.group(1).strip()

            cursor = self._conn.cursor()
            cursor.execute(
                """
                SELECT column_name AS name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = %s
                ORDER BY ordinal_position
                """,
                (table_name,),
            )

            return PostgresCompatCursor(cursor)

        translated_sql = _translate_sql(sql)

        # Emulate sqlite cursor.lastrowid for tables with SERIAL ids.
        insert_match = re.match(
            r"^\s*INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)",
            original_sql,
            re.IGNORECASE,
        )

        needs_lastrowid = (
            insert_match is not None
            and insert_match.group(1).lower() in SERIAL_ID_TABLES
            and "RETURNING" not in translated_sql.upper()
        )

        if needs_lastrowid:
            translated_sql = translated_sql.rstrip().rstrip(";")
            translated_sql += " RETURNING id"

        cursor = self._conn.cursor()

        try:
            cursor.execute(
                translated_sql,
                tuple(params) if params is not None else (),
            )
        except psycopg.IntegrityError as exc:
            # Existing main.py catches sqlite3.IntegrityError.
            self._conn.rollback()
            raise sqlite3.IntegrityError(str(exc)) from exc

        lastrowid = None

        if needs_lastrowid:
            inserted = cursor.fetchone()
            if inserted:
                lastrowid = inserted["id"]

        return PostgresCompatCursor(cursor, lastrowid=lastrowid)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def connect_postgres(database_url: str):
    return PostgresCompatConnection(database_url)