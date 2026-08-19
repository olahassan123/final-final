import os
import sqlite3

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "appointments.db")


TABLES = [
    "employees",
    "employee_specialties",
    "staff_users",
    "system_settings",
]


def migrate():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")

    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row

    pg_conn = psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row,
    )

    try:
        # -----------------------------
        # Employees
        # -----------------------------
        employees = sqlite_conn.execute(
            "SELECT * FROM employees ORDER BY id"
        ).fetchall()

        for row in employees:
            pg_conn.execute(
                """
                INSERT INTO employees
                    (id, full_name, phone, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    phone = EXCLUDED.phone,
                    is_active = EXCLUDED.is_active,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    row["id"],
                    row["full_name"],
                    row["phone"],
                    row["is_active"],
                    row["created_at"],
                    row["updated_at"],
                ),
            )

        # -----------------------------
        # Employee specialties
        # -----------------------------
        specialties = sqlite_conn.execute(
            "SELECT * FROM employee_specialties ORDER BY id"
        ).fetchall()

        for row in specialties:
            pg_conn.execute(
                """
                INSERT INTO employee_specialties
                    (id, employee_id, specialty, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    row["id"],
                    row["employee_id"],
                    row["specialty"],
                    row["created_at"],
                ),
            )

        # -----------------------------
        # Staff users
        # -----------------------------
        staff_users = sqlite_conn.execute(
            "SELECT * FROM staff_users ORDER BY id"
        ).fetchall()

        for row in staff_users:
            pg_conn.execute(
                """
                INSERT INTO staff_users
                    (
                        id, username, full_name, email, phone,
                        role, password_hash, active,
                        created_at, updated_at
                    )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    role = EXCLUDED.role,
                    password_hash = EXCLUDED.password_hash,
                    active = EXCLUDED.active,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    row["id"],
                    row["username"],
                    row["full_name"],
                    row["email"],
                    row["phone"],
                    row["role"],
                    row["password_hash"],
                    row["active"],
                    row["created_at"],
                    row["updated_at"],
                ),
            )

        # -----------------------------
        # System settings
        # -----------------------------
        settings = sqlite_conn.execute(
            "SELECT * FROM system_settings"
        ).fetchall()

        for row in settings:
            pg_conn.execute(
                """
                INSERT INTO system_settings (key, value, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    row["key"],
                    row["value"],
                    row["updated_at"],
                ),
            )

        # Fix SERIAL sequences after explicitly inserting IDs.
        for table in [
            "employees",
            "employee_specialties",
            "staff_users",
        ]:
            pg_conn.execute(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table}), 1),
                    true
                )
                """
            )

        pg_conn.commit()

        print("Migration completed successfully.")
        print(f"Employees: {len(employees)}")
        print(f"Employee specialties: {len(specialties)}")
        print(f"Staff users: {len(staff_users)}")
        print(f"System settings: {len(settings)}")

    except Exception:
        pg_conn.rollback()
        raise

    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    migrate()