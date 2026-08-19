import os

import psycopg
from dotenv import load_dotenv


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def init_postgres_schema():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:

            cur.execute("""
                CREATE TABLE IF NOT EXISTS treatments_db (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    class_name TEXT DEFAULT '',
                    category TEXT DEFAULT '',
                    keywords TEXT DEFAULT '',
                    suitable_for_all_skins TEXT DEFAULT '',
                    results_timing TEXT DEFAULT '',
                    aftercare TEXT DEFAULT '',
                    recommended_frequency TEXT DEFAULT '',
                    pregnancy_breastfeeding TEXT DEFAULT '',
                    medical_limitations TEXT DEFAULT '',
                    source TEXT DEFAULT 'admin',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    client_name TEXT NOT NULL,
                    client_phone TEXT,
                    normalized_client_phone TEXT,
                    customer_user_id INTEGER,
                    treatment_id TEXT NOT NULL,
                    treatment_name TEXT NOT NULL,
                    employee_name TEXT,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    end_time TEXT,
                    status TEXT DEFAULT 'scheduled',
                    notes TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS employee_shifts (
                    id SERIAL PRIMARY KEY,
                    employee_name TEXT NOT NULL,
                    shift_date TEXT NOT NULL,
                    start_time TEXT,
                    end_time TEXT,
                    is_working INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(employee_name, shift_date)
                )
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_employee_shifts_date
                ON employee_shifts(shift_date)
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS employees (
                    id SERIAL PRIMARY KEY,
                    full_name TEXT NOT NULL UNIQUE,
                    phone TEXT DEFAULT '',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS employee_specialties (
                    id SERIAL PRIMARY KEY,
                    employee_id INTEGER NOT NULL,
                    specialty TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(employee_id, specialty),
                    FOREIGN KEY (employee_id) REFERENCES employees(id)
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS employee_shift_blocks (
                    id SERIAL PRIMARY KEY,
                    employee_id INTEGER NOT NULL,
                    shift_date TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(employee_id, shift_date, start_time, end_time),
                    FOREIGN KEY (employee_id) REFERENCES employees(id)
                )
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_employee_shift_blocks_date
                ON employee_shift_blocks(shift_date)
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    google_id TEXT UNIQUE NOT NULL,
                    email TEXT NOT NULL,
                    name TEXT,
                    picture TEXT,
                    role TEXT DEFAULT 'customer',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS staff_users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    role TEXT NOT NULL
                        CHECK(role IN ('secretary', 'admin', 'manager')),
                    password_hash TEXT NOT NULL,
                    active INTEGER DEFAULT 1,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS customer_users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    age TEXT,
                    gender TEXT,
                    selected_treatments TEXT DEFAULT '[]',
                    password_hash TEXT NOT NULL,
                    active INTEGER DEFAULT 1,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id SERIAL PRIMARY KEY,
                    action TEXT NOT NULL,
                    actor_id INTEGER,
                    actor_role TEXT,
                    actor_username TEXT,
                    target_type TEXT,
                    target_id INTEGER,
                    target_username TEXT,
                    details TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS password_reset_codes (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL,
                    identifier TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    used INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customer_users(id)
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL DEFAULT '',
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    messages TEXT NOT NULL,
                    skin_profile TEXT,
                    category TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)

            # Shared replacement for browser localStorage contact inquiries.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS contact_inquiries (
                    id TEXT PRIMARY KEY,
                    data JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Shared replacement for browser localStorage job applications.
            cur.execute("""
                CREATE TABLE IF NOT EXISTS job_applications (
                    id TEXT PRIMARY KEY,
                    data JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            """)

        conn.commit()

    print("PostgreSQL schema created successfully.")


if __name__ == "__main__":
    init_postgres_schema()