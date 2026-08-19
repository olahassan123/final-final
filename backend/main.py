from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict
from pydantic import BaseModel
import os
import sqlite3
import json
import re
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import jwt
import hashlib
import hmac
import secrets
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from chatbot_config import MAX_CHAT_MESSAGE_CHARS

load_dotenv()

# ------------------------------------------------------------
# Auth config
# ------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "meday-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

STAFF_ROLES = {"secretary", "admin"}
ADMIN_ROLES = {"admin"}
CUSTOMER_ROLE = "customer"
DEFAULT_SYSTEM_SETTINGS = {
    "business_name": "MeDay Beauty Center",
    "phone": "*3691",
    "whatsapp": "",
    "email": "admin@meday.local",
    "address": "",
    "opening_hours": "",
}
DEFAULT_BOOTSTRAP_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin").strip() or "admin"
DEFAULT_BOOTSTRAP_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin123!")
DEFAULT_BOOTSTRAP_ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "System Admin").strip() or "System Admin"
DEFAULT_BOOTSTRAP_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@meday.local").strip()
TREATMENT_CATEGORIES = [
    "מניקור ופדיקור",
    "עיצוב שיער",
    "טיפולי קוסמטיקה",
    "טיפולי גוף",
    "הסרת שיער",
    "איפור מקצועי",
    "איפור קבוע ועיצוב גבות",
    "סטיילינג אישי",
    "טיפולי אסתטיקה",
]
DEFAULT_EMPLOYEES = [
    {"full_name": "Ranin", "specialties": ["טיפולי קוסמטיקה", "טיפולי אסתטיקה"]},
    {"full_name": "Regev", "specialties": ["עיצוב שיער"]},
    {"full_name": "Irit", "specialties": ["עיצוב שיער"]},
    {"full_name": "Ira", "specialties": ["מניקור ופדיקור"]},
    {"full_name": "Dana", "specialties": ["איפור מקצועי"]},
    {"full_name": "Maya", "specialties": ["סטיילינג אישי"]},
    {"full_name": "Adele", "specialties": ["טיפולי גוף", "הסרת שיער"]},
    {"full_name": "Miri", "specialties": ["איפור קבוע ועיצוב גבות"]},
    {"full_name": "Amjad", "specialties": ["טיפולי אסתטיקה"]},
]
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def normalize_role(role: str) -> str:
    role = (role or "").strip().lower()
    if role in {"client", "customer"}:
        return CUSTOMER_ROLE
    if role in {"employee", "secretary"}:
        return "secretary"
    if role in {"admin", "manager"}:
        return "admin"
    return role


def create_jwt(user_id: int, email: str, name: str, role: str, user_type: str = "customer") -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "role": normalize_role(role),
        "type": user_type,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


async def get_current_user(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Query(None),
) -> Optional[dict]:
    token = access_token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        return None
    try:
        payload = decode_jwt(token)
        return {
            "id": int(payload["sub"]),
            "email": payload.get("email", ""),
            "name": payload.get("name", ""),
            "role": normalize_role(payload.get("role", CUSTOMER_ROLE)),
            "type": payload.get("type", "customer"),
        }
    except Exception:
        return None


def require_authenticated(current_user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user


def require_staff(current_user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if normalize_role(current_user.get("role")) not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff access required")
    return current_user


def require_admin(current_user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if normalize_role(current_user.get("role")) not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256$120000${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
        return hmac.compare_digest(digest.hex(), expected)
    except Exception:
        return False


def verify_or_migrate_password(conn: sqlite3.Connection, table: str, user_id: int, password: str, stored_password: str) -> bool:
    if verify_password(password, stored_password):
        return True
    if "$" not in (stored_password or "") and hmac.compare_digest(password, stored_password or ""):
        conn.execute(
            f"UPDATE {table} SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (hash_password(password), user_id),
        )
        conn.commit()
        return True
    return False


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9\s\-]{6,18}$")
SETTINGS_PHONE_RE = re.compile(r"^(?:\*[0-9]{3,6}|\+?[0-9][0-9\s\-]{6,18})$")


def validate_email(email: Optional[str], required: bool = False) -> str:
    value = (email or "").strip()
    if required and not value:
        raise HTTPException(status_code=400, detail="email is required")
    if value and not EMAIL_RE.match(value):
        raise HTTPException(status_code=400, detail="invalid email format")
    return value


def validate_phone(phone: Optional[str], required: bool = False) -> str:
    value = (phone or "").strip()
    if required and not value:
        raise HTTPException(status_code=400, detail="phone number is required")
    if value and not PHONE_RE.match(value):
        raise HTTPException(status_code=400, detail="invalid phone number")
    return value


def validate_settings_phone(phone: Optional[str], required: bool = False) -> str:
    value = (phone or "").strip()
    if required and not value:
        raise HTTPException(status_code=400, detail="phone number is required")
    if value and not SETTINGS_PHONE_RE.match(value):
        raise HTTPException(status_code=400, detail="invalid phone number")
    return value


def normalize_phone_for_match(phone: Optional[str]) -> str:
    return re.sub(r"\D", "", phone or "")


def validate_password_strength(password: str):
    if not password:
        raise HTTPException(status_code=400, detail="password is required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="weak password: password must contain at least 8 characters")


def validate_customer_password_strength(password: str):
    validate_password_strength(password)
    missing = []
    if not re.search(r"[A-Z]", password):
        missing.append("uppercase English letter")
    if not re.search(r"[a-z]", password):
        missing.append("lowercase English letter")
    if not re.search(r"\d", password):
        missing.append("number")
    if not re.search(r"[!@#$%^&*()_\-+=\[\]{};:'\",.<>/?\\|`~]", password):
        missing.append("special character")
    if missing:
        raise HTTPException(
            status_code=400,
            detail="הסיסמה אינה חזקה מספיק: " + ", ".join(missing),
        )


def username_exists(conn: sqlite3.Connection, username: str, exclude_type: Optional[str] = None, exclude_id: Optional[int] = None) -> bool:
    username = (username or "").strip()
    if not username:
        return False
    row = conn.execute("SELECT id FROM staff_users WHERE lower(username) = lower(?)", (username,)).fetchone()
    if row and not (exclude_type == "staff" and int(row["id"]) == int(exclude_id or -1)):
        return True
    row = conn.execute("SELECT id FROM customer_users WHERE lower(username) = lower(?)", (username,)).fetchone()
    if row and not (exclude_type == "customer" and int(row["id"]) == int(exclude_id or -1)):
        return True
    return False


def email_exists(conn: sqlite3.Connection, email: str, exclude_type: Optional[str] = None, exclude_id: Optional[int] = None) -> bool:
    email = (email or "").strip()
    if not email:
        return False
    row = conn.execute("SELECT id FROM staff_users WHERE lower(email) = lower(?)", (email,)).fetchone()
    if row and not (exclude_type == "staff" and int(row["id"]) == int(exclude_id or -1)):
        return True
    row = conn.execute("SELECT id FROM customer_users WHERE lower(email) = lower(?)", (email,)).fetchone()
    if row and not (exclude_type == "customer" and int(row["id"]) == int(exclude_id or -1)):
        return True
    row = conn.execute("SELECT id FROM users WHERE lower(email) = lower(?)", (email,)).fetchone()
    if row and not (exclude_type == "google" and int(row["id"]) == int(exclude_id or -1)):
        return True
    return False


def log_audit(
    action: str,
    actor: Optional[dict] = None,
    target_type: str = "",
    target_id: Optional[int] = None,
    target_username: str = "",
    details: str = "",
):
    try:
        conn = get_db()
        conn.execute(
            """INSERT INTO audit_log
               (action, actor_id, actor_role, actor_username, target_type, target_id, target_username, details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                action,
                actor.get("id") if actor else None,
                actor.get("role") if actor else "",
                actor.get("username") or actor.get("email") if actor else "",
                target_type,
                target_id,
                target_username,
                details,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[audit log error] {e}")


def verify_google_token(credential: str) -> dict:
    request = google_requests.Request()
    audience = GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID != "your-google-client-id-here" else None
    id_info = id_token.verify_oauth2_token(credential, request, audience)
    return {
        "google_id": id_info["sub"],
        "email": id_info["email"],
        "name": id_info.get("name", ""),
        "picture": id_info.get("picture", ""),
    }


# ------------------------------------------------------------
# App setup
# ------------------------------------------------------------
app = FastAPI(title="MeDay Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXCEL_DIR = Path(__file__).parent

# ------------------------------------------------------------
# Chatbot
# ------------------------------------------------------------
from chatbot_db import init_chatbot_db
from chatbot_router import handle_message as _chatbot_handle

init_chatbot_db()


# ------------------------------------------------------------
# Basic routes
# ------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True}


# ------------------------------------------------------------
# Chat endpoint (new)
# ------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str
    message: Optional[str] = None
    button_value: Optional[str] = None
    question_id: Optional[str] = None
    selected_treatment: Optional[Dict] = None

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    if req.message and len(req.message) > MAX_CHAT_MESSAGE_CHARS:
        raise HTTPException(status_code=413, detail="ההודעה ארוכה מדי. נסי לקצר אותה.")
    result = _chatbot_handle(
        session_id=req.session_id,
        message=req.message,
        button_value=req.button_value,
        question_id=req.question_id,
        selected_treatment=req.selected_treatment,
    )
    return result


@app.delete("/chat/session/{session_id}")
def clear_chat_session(session_id: str):
    from chatbot_db import delete_session
    delete_session(session_id)
    return {"ok": True}


@app.get("/chat/categories")
def chat_categories():
    """Category names for the chat welcome chips (kept in sync with the Excel)."""
    from chatbot_db import get_categories
    return {"categories": [c["category_name"] for c in get_categories() if c.get("category_name")]}


@app.get("/chat/treatments/{treatment_id}")
def chat_treatment_details(treatment_id: str):
    from chatbot_db import get_category_by_id, get_treatment_by_id

    treatment = get_treatment_by_id(treatment_id)
    if not treatment:
        raise HTTPException(status_code=404, detail="treatment not found")
    category = get_category_by_id(treatment.get("category_id") or "") or {}
    return {
        "id": treatment["treatment_id"],
        "name": treatment["treatment_name"],
        "category_id": treatment.get("category_id"),
        "category": category.get("category_name") or treatment.get("category_id") or "",
        "summary": treatment.get("short_description") or treatment.get("what_to_expect") or "",
        "description": treatment.get("short_description") or treatment.get("what_to_expect") or "",
        "good_for": treatment.get("good_for") or "",
        "technique_or_equipment": treatment.get("technique_or_equipment") or "",
        "preparation": treatment.get("preparation") or "",
        "aftercare": treatment.get("aftercare") or "",
        "downtime": treatment.get("downtime") or "",
        "pain_level": treatment.get("pain_level") or "",
        "sessions_recommended": treatment.get("sessions_recommended") or "",
        "results_longevity": treatment.get("results_longevity") or "",
        "what_to_expect": treatment.get("what_to_expect") or "",
    }


# ── AI assistant settings (admin) ─────────────────────────────────────────────
class AiSettingsUpdate(BaseModel):
    api_key: Optional[str] = None   # None = leave unchanged; "" = clear
    enabled: Optional[bool] = None


def _mask_key(k: str) -> str:
    k = (k or "").strip()
    if not k:
        return ""
    return (k[:4] + "…" + k[-4:]) if len(k) > 10 else "****"


@app.get("/chat/ai-settings")
def get_ai_settings(_: dict = Depends(require_staff)):
    """Status of the optional AI layer for the admin panel."""
    from chatbot_db import get_setting
    from chatbot_config import GEMINI_KEY_URL
    key = (get_setting("llm_api_key") or "").strip()
    env_key = bool(os.getenv("GEMINI_API_KEY"))
    enabled = get_setting("llm_enabled", "1") != "0"
    has_key = bool(key or env_key)
    last = (get_setting("llm_last_status") or "").strip()
    if not enabled:
        status = "off"
    elif not has_key:
        status = "no_key"
    elif last in ("rate_limited", "daily_quota", "no_quota"):
        status = "limited"     # free quota used up (per-minute or per-day)
    elif last == "invalid_key":
        status = "invalid"     # key no longer valid
    elif last == "bad_request":
        # Our own request was malformed — Gemini is down for a reason that has
        # nothing to do with the key. Must not read as "active": showing this as
        # working (or as an invalid key) is what hid a total outage before.
        status = "misconfigured"
    elif last == "error":
        status = "error"       # transient connection issue
    else:
        status = "active"
    return {
        "enabled": enabled,
        "key_set": has_key,
        "key_masked": _mask_key(key) if key else ("(from environment)" if env_key else ""),
        "status": status,
        "last_status_at": get_setting("llm_last_status_at", ""),
        "provider": "Google Gemini",
        "get_key_url": GEMINI_KEY_URL,
    }


@app.post("/chat/ai-settings")
def update_ai_settings(body: AiSettingsUpdate, _: dict = Depends(require_admin)):
    """Save a pasted API key (validated first) and/or the on/off flag."""
    from chatbot_db import set_setting
    from chatbot_router import _test_llm_key
    out = {"ok": True}
    if body.api_key is not None:
        key = body.api_key.strip()
        if key:
            accepted, status = _test_llm_key(key)
            if not accepted:
                if status == "no_quota":
                    detail = ("המפתח תקין, אך לחשבון Google הזה אין מכסת שימוש חינמית ל-Gemini (limit: 0). "
                              "כדי להפעיל את ה-AI יש להפעיל חיוב (billing) בפרויקט ב-Google Cloud, "
                              "או ליצור מפתח בחשבון Google אחר שיש בו מכסה חינמית. "
                              "הצ׳אט ממשיך לעבוד מצוין גם בלי מפתח.")
                elif status == "invalid_key":
                    detail = "המפתח לא תקין"
                elif status == "bad_request":
                    detail = ("המפתח כנראה תקין, אך Google דחתה את הבקשה עצמה. "
                              "זו תקלת הגדרות בצד שלנו ולא בעיה במפתח — יש לבדוק את "
                              "לוג השרת ואת מודל ה-Gemini המוגדר.")
                else:
                    detail = "שגיאת חיבור ל-Google, נסי שוב"
                raise HTTPException(status_code=400, detail=detail)
            out["tested"] = True
            set_setting("llm_last_status", status)  # 'ok' | 'rate_limited' | 'daily_quota'
            if status in ("rate_limited", "daily_quota"):
                out["warning"] = (
                    "המפתח תקין ונשמר, אך כרגע הגיע למגבלת הקצב החינמית. "
                    "הצ׳אט ישתמש בו אוטומטית ברגע שהמכסה תתאפס (בדרך כלל תוך דקה או ביום העוקב)."
                )
        set_setting("llm_api_key", key)
    if body.enabled is not None:
        set_setting("llm_enabled", "1" if body.enabled else "0")
    return out


# ------------------------------------------------------------
# Appointments DB
# ------------------------------------------------------------
APPOINTMENTS_DB = EXCEL_DIR / "appointments.db"


def get_db():
    conn = sqlite3.connect(str(APPOINTMENTS_DB))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
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
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS employee_shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_name TEXT NOT NULL,
            shift_date TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            is_working INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_name, shift_date)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_employee_shifts_date
        ON employee_shifts(shift_date)
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL UNIQUE,
            phone TEXT DEFAULT '',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS employee_specialties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            specialty TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, specialty),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS employee_shift_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            shift_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, shift_date, start_time, end_time),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_employee_shift_blocks_date
        ON employee_shift_blocks(shift_date)
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            name TEXT,
            picture TEXT,
            role TEXT DEFAULT 'customer',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS staff_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            role TEXT NOT NULL CHECK(role IN ('secretary', 'admin', 'manager')),
            password_hash TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS customer_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            age TEXT,
            gender TEXT,
            selected_treatments TEXT DEFAULT '[]',
            password_hash TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            actor_id INTEGER,
            actor_role TEXT,
            actor_username TEXT,
            target_type TEXT,
            target_id INTEGER,
            target_username TEXT,
            details TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            identifier TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customer_users(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            messages TEXT NOT NULL,
            skin_profile TEXT,
            category TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    for col in ["end_time", "employee_name", "user_id", "normalized_client_phone", "customer_user_id", "status"]:
        try:
            if col == "customer_user_id":
                conn.execute("ALTER TABLE appointments ADD COLUMN customer_user_id INTEGER")
            elif col == "status":
                conn.execute("ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'scheduled'")
            else:
                conn.execute(f"ALTER TABLE appointments ADD COLUMN {col} TEXT")
        except Exception:
            pass
    for col, ddl in [
        ("role", "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'"),
        ("email", "ALTER TABLE staff_users ADD COLUMN email TEXT"),
        ("phone", "ALTER TABLE staff_users ADD COLUMN phone TEXT"),
        ("active", "ALTER TABLE staff_users ADD COLUMN active INTEGER DEFAULT 1"),
        ("updated_at", "ALTER TABLE staff_users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"),
        ("customer_email", "ALTER TABLE customer_users ADD COLUMN email TEXT"),
        ("customer_phone", "ALTER TABLE customer_users ADD COLUMN phone TEXT"),
        ("customer_active", "ALTER TABLE customer_users ADD COLUMN active INTEGER DEFAULT 1"),
        ("customer_updated_at", "ALTER TABLE customer_users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"),
    ]:
        try:
            conn.execute(ddl)
        except Exception:
            pass
    for employee in DEFAULT_EMPLOYEES:
        conn.execute(
            "INSERT OR IGNORE INTO employees (full_name, phone, is_active) VALUES (?, '', 1)",
            (employee["full_name"],),
        )
        row = conn.execute("SELECT id FROM employees WHERE full_name = ?", (employee["full_name"],)).fetchone()
        if row:
            for specialty in employee["specialties"]:
                conn.execute(
                    "INSERT OR IGNORE INTO employee_specialties (employee_id, specialty) VALUES (?, ?)",
                    (row["id"], specialty),
                )

    # Migrate the previous one-shift-per-day table into split shift blocks once, preserving old data.
    try:
        old_rows = conn.execute(
            """SELECT employee_name, shift_date, start_time, end_time
               FROM employee_shifts
               WHERE is_working = 1 AND start_time IS NOT NULL AND end_time IS NOT NULL"""
        ).fetchall()
        for old in old_rows:
            employee = conn.execute(
                "SELECT id FROM employees WHERE full_name = ?",
                (old["employee_name"],),
            ).fetchone()
            if not employee:
                continue
            conn.execute(
                """INSERT OR IGNORE INTO employee_shift_blocks
                   (employee_id, shift_date, start_time, end_time)
                   VALUES (?, ?, ?, ?)""",
                (employee["id"], old["shift_date"], old["start_time"], old["end_time"]),
            )
    except Exception:
        pass
    for key, value in DEFAULT_SYSTEM_SETTINGS.items():
        conn.execute(
            "INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    conn.commit()
    conn.close()


init_db()


def staff_user_response(row: sqlite3.Row) -> dict:
    data = dict(row)
    data.pop("password_hash", None)
    data["role"] = normalize_role(data.get("role"))
    data["active"] = bool(data.get("active", 1))
    return data


def customer_user_response(row: sqlite3.Row) -> dict:
    data = dict(row)
    data.pop("password_hash", None)
    data["role"] = CUSTOMER_ROLE
    data["active"] = bool(data.get("active", 1))
    try:
        data["selectedTreatments"] = json.loads(data.pop("selected_treatments") or "[]")
    except Exception:
        data["selectedTreatments"] = []
    data["fullName"] = data.pop("full_name", "")
    return data


def _seed_admin_from_env():
    conn = get_db()
    admin_count = conn.execute(
        "SELECT COUNT(*) FROM staff_users WHERE role = 'admin'"
    ).fetchone()[0]
    if admin_count == 0:
        conn.execute(
            """INSERT INTO staff_users (username, full_name, email, role, password_hash)
               VALUES (?, ?, ?, 'admin', ?)""",
            (
                DEFAULT_BOOTSTRAP_ADMIN_USERNAME,
                DEFAULT_BOOTSTRAP_ADMIN_FULL_NAME,
                DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
                hash_password(DEFAULT_BOOTSTRAP_ADMIN_PASSWORD),
            ),
        )
        conn.commit()
    conn.close()


_seed_admin_from_env()


class AppointmentCreate(BaseModel):
    client_name: str
    client_phone: Optional[str] = None
    treatment_id: str
    treatment_name: str
    employee_name: Optional[str] = None
    date: str
    time: str
    end_time: Optional[str] = None
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None


class EmployeeCreate(BaseModel):
    full_name: str
    phone: Optional[str] = ""
    specialties: List[str]
    is_active: Optional[bool] = True


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    specialties: Optional[List[str]] = None
    is_active: Optional[bool] = None


class EmployeeShiftBlockItem(BaseModel):
    employee_id: int
    shift_date: str
    start_time: str
    end_time: str


class EmployeeShiftWeekSave(BaseModel):
    week_start: str
    shift_blocks: List[EmployeeShiftBlockItem]
    force_conflicts: Optional[bool] = False


def parse_iso_date(value: str, field_name: str = "date") -> datetime:
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="תאריך לא תקין. יש להשתמש בפורמט YYYY-MM-DD")


def require_valid_time(value: Optional[str], field_name: str):
    if not value or not TIME_RE.match(value):
        raise HTTPException(status_code=400, detail="שעה לא תקינה. יש להשתמש בפורמט HH:MM")


def time_to_minutes(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def minutes_to_time(total_minutes: int) -> str:
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def add_days_iso(iso_date: str, days: int) -> str:
    return (parse_iso_date(iso_date) + timedelta(days=days)).strftime("%Y-%m-%d")


def employee_response(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    specialties = conn.execute(
        "SELECT specialty FROM employee_specialties WHERE employee_id = ? ORDER BY specialty",
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "name": row["full_name"],
        "phone": row["phone"] or "",
        "is_active": bool(row["is_active"]),
        "specialties": [item["specialty"] for item in specialties],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def validate_specialties(specialties: List[str]) -> List[str]:
    clean = []
    for specialty in specialties or []:
        value = (specialty or "").strip()
        if value and value not in clean:
            clean.append(value)
    if not clean:
        raise HTTPException(status_code=400, detail="יש לבחור לפחות תחום טיפול אחד")
    invalid = [value for value in clean if value not in TREATMENT_CATEGORIES]
    if invalid:
        raise HTTPException(status_code=400, detail="נבחר תחום טיפול לא תקין")
    return clean


def validate_employee_payload(full_name: str, phone: Optional[str], specialties: List[str]) -> tuple:
    name = (full_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="שם מלא הוא שדה חובה")
    phone_value = validate_phone(phone) if phone else ""
    return name, phone_value, validate_specialties(specialties)


def set_employee_specialties(conn: sqlite3.Connection, employee_id: int, specialties: List[str]):
    conn.execute("DELETE FROM employee_specialties WHERE employee_id = ?", (employee_id,))
    for specialty in specialties:
        conn.execute(
            "INSERT OR IGNORE INTO employee_specialties (employee_id, specialty) VALUES (?, ?)",
            (employee_id, specialty),
        )


def get_employee_or_404(conn: sqlite3.Connection, employee_id: int, active_only: bool = False) -> sqlite3.Row:
    where = "id = ?"
    params = [employee_id]
    if active_only:
        where += " AND is_active = 1"
    row = conn.execute(f"SELECT * FROM employees WHERE {where}", params).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="העובד/ת לא נמצא/ה במערכת")
    return row


def validate_shift_blocks(conn: sqlite3.Connection, blocks: List[EmployeeShiftBlockItem], allowed_dates: set) -> List[dict]:
    validated = []
    for block in blocks:
        employee = get_employee_or_404(conn, block.employee_id, active_only=True)
        shift_date = parse_iso_date(block.shift_date, "shift_date").strftime("%Y-%m-%d")
        if shift_date not in allowed_dates:
            raise HTTPException(status_code=400, detail="תאריך המשמרת חייב להיות בתוך השבוע שנבחר")
        start_time = (block.start_time or "").strip()
        end_time = (block.end_time or "").strip()
        require_valid_time(start_time, "start_time")
        require_valid_time(end_time, "end_time")
        if time_to_minutes(end_time) <= time_to_minutes(start_time):
            raise HTTPException(status_code=400, detail="שעת הסיום חייבת להיות אחרי שעת ההתחלה")
        validated.append({
            "employee_id": int(block.employee_id),
            "employee_name": employee["full_name"],
            "shift_date": shift_date,
            "start_time": start_time,
            "end_time": end_time,
        })

    by_employee_date: Dict[tuple, List[dict]] = {}
    seen = set()
    for block in validated:
        duplicate_key = (block["employee_id"], block["shift_date"], block["start_time"], block["end_time"])
        if duplicate_key in seen:
            raise HTTPException(status_code=400, detail="קיימת כפילות בחלונות העבודה")
        seen.add(duplicate_key)
        by_employee_date.setdefault((block["employee_id"], block["shift_date"]), []).append(block)

    for day_blocks in by_employee_date.values():
        day_blocks.sort(key=lambda item: time_to_minutes(item["start_time"]))
        for index in range(1, len(day_blocks)):
            if time_to_minutes(day_blocks[index]["start_time"]) < time_to_minutes(day_blocks[index - 1]["end_time"]):
                raise HTTPException(
                    status_code=400,
                    detail="זמני המשמרות חופפים. יש לעדכן את שעות העבודה",
                )
    return sorted(validated, key=lambda item: (item["employee_id"], item["shift_date"], item["start_time"]))


def is_appointment_inside_shift_block(appt_start: str, appt_end: str, blocks: List[dict]) -> bool:
    start = time_to_minutes(appt_start)
    end = time_to_minutes(appt_end)
    return any(start >= time_to_minutes(block["start_time"]) and end <= time_to_minutes(block["end_time"]) for block in blocks)


def get_employee_shift_blocks_for_date(conn: sqlite3.Connection, employee_id: int, shift_date: str) -> List[dict]:
    rows = conn.execute(
        """SELECT * FROM employee_shift_blocks
           WHERE employee_id = ? AND shift_date = ?
           ORDER BY start_time""",
        (employee_id, shift_date),
    ).fetchall()
    return [dict(row) for row in rows]


def employee_has_shift_on_date(conn: sqlite3.Connection, employee_id: int, shift_date: str) -> bool:
    return len(get_employee_shift_blocks_for_date(conn, employee_id, shift_date)) > 0


def detect_shift_conflicts(conn: sqlite3.Connection, blocks: List[dict], week_dates: List[str], employees: List[sqlite3.Row]) -> List[dict]:
    conflicts = []
    by_employee_date: Dict[tuple, List[dict]] = {}
    for block in blocks:
        by_employee_date.setdefault((block["employee_id"], block["shift_date"]), []).append(block)

    for employee in employees:
        employee_id = employee["id"]
        employee_name = employee["full_name"]
        for shift_date in week_dates:
            day_blocks = by_employee_date.get((employee_id, shift_date), [])
            rows = conn.execute(
                """SELECT employee_name, date, time, end_time, treatment_name
                   FROM appointments
                   WHERE employee_name = ? AND date = ? AND COALESCE(status, 'scheduled') != 'cancelled'
                   ORDER BY time""",
                (employee_name, shift_date),
            ).fetchall()
            for row in rows:
                appt_start = row["time"]
                appt_end = row["end_time"] or minutes_to_time(time_to_minutes(appt_start) + 60)
                if not day_blocks or not is_appointment_inside_shift_block(appt_start, appt_end, day_blocks):
                    conflicts.append({
                        "employee_name": row["employee_name"],
                        "date": row["date"],
                        "start_time": appt_start,
                        "end_time": appt_end,
                        "treatment_name": row["treatment_name"] or "",
                    })
    return conflicts


def shift_block_response(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["employee_name"] = data.get("employee_name") or data.get("full_name", "")
    return data


def detect_legacy_shift_conflicts(conn: sqlite3.Connection, shifts: List[dict]) -> List[dict]:
    conflicts = []
    for shift in shifts:
        rows = conn.execute(
            """SELECT employee_name, date, time, end_time
               FROM appointments
               WHERE employee_name = ? AND date = ? AND COALESCE(status, 'scheduled') != 'cancelled'
               ORDER BY time""",
            (shift["employee_name"], shift["shift_date"]),
        ).fetchall()
        shift_start = time_to_minutes(shift["start_time"]) if shift["is_working"] and shift["start_time"] else None
        shift_end = time_to_minutes(shift["end_time"]) if shift["is_working"] and shift["end_time"] else None
        for row in rows:
            appt_start = time_to_minutes(row["time"])
            appt_end = time_to_minutes(row["end_time"]) if row["end_time"] else appt_start + 60
            outside_shift = (
                not shift["is_working"] or
                shift_start is None or
                shift_end is None or
                appt_start < shift_start or
                appt_end > shift_end
            )
            if outside_shift:
                conflicts.append({
                    "employee_name": row["employee_name"],
                    "date": row["date"],
                    "start_time": row["time"],
                    "end_time": row["end_time"] or minutes_to_time(appt_end),
                })
    return conflicts


def shift_response(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["is_working"] = bool(data.get("is_working"))
    return data


def find_customer_by_phone(conn: sqlite3.Connection, phone: Optional[str]) -> Optional[sqlite3.Row]:
    normalized_phone = normalize_phone_for_match(phone)
    if not normalized_phone:
        return None
    rows = conn.execute(
        "SELECT * FROM customer_users WHERE active = 1 AND phone IS NOT NULL AND phone != ''"
    ).fetchall()
    for row in rows:
        if normalize_phone_for_match(row["phone"]) == normalized_phone:
            return row
    return None


@app.get("/treatment-categories")
def get_treatment_categories(_: dict = Depends(require_staff)):
    return {"ok": True, "categories": TREATMENT_CATEGORIES}


@app.get("/employees")
def list_employees(include_inactive: bool = False, _: dict = Depends(require_staff)):
    conn = get_db()
    where = "" if include_inactive else "WHERE is_active = 1"
    rows = conn.execute(f"SELECT * FROM employees {where} ORDER BY is_active DESC, full_name").fetchall()
    employees = [employee_response(conn, row) for row in rows]
    conn.close()
    return {"ok": True, "employees": employees, "categories": TREATMENT_CATEGORIES}


@app.post("/employees", status_code=201)
def create_employee(body: EmployeeCreate, current_user: dict = Depends(require_admin)):
    full_name, phone, specialties = validate_employee_payload(body.full_name, body.phone, body.specialties)
    conn = get_db()
    existing = conn.execute("SELECT id FROM employees WHERE lower(full_name) = lower(?)", (full_name,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="כבר קיים/ת עובד/ת בשם הזה")
    cursor = conn.execute(
        "INSERT INTO employees (full_name, phone, is_active) VALUES (?, ?, ?)",
        (full_name, phone, 1 if body.is_active else 0),
    )
    employee_id = cursor.lastrowid
    set_employee_specialties(conn, employee_id, specialties)
    conn.commit()
    row = conn.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()
    employee = employee_response(conn, row)
    conn.close()
    log_audit("employee created", current_user, "employee", employee_id, full_name)
    return {"ok": True, "message": "העובד/ת נוסף/ה בהצלחה", "employee": employee}


@app.put("/employees/{employee_id}")
def update_employee(employee_id: int, body: EmployeeUpdate, current_user: dict = Depends(require_admin)):
    conn = get_db()
    row = get_employee_or_404(conn, employee_id)
    full_name = body.full_name.strip() if body.full_name is not None else row["full_name"]
    phone = validate_phone(body.phone) if body.phone is not None and body.phone else (body.phone if body.phone == "" else row["phone"] or "")
    specialties = validate_specialties(body.specialties) if body.specialties is not None else None
    if not full_name:
        conn.close()
        raise HTTPException(status_code=400, detail="שם מלא הוא שדה חובה")
    duplicate = conn.execute(
        "SELECT id FROM employees WHERE lower(full_name) = lower(?) AND id != ?",
        (full_name, employee_id),
    ).fetchone()
    if duplicate:
        conn.close()
        raise HTTPException(status_code=409, detail="כבר קיים/ת עובד/ת בשם הזה")
    is_active = int(body.is_active) if body.is_active is not None else row["is_active"]
    conn.execute(
        """UPDATE employees
           SET full_name = ?, phone = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (full_name, phone or "", is_active, employee_id),
    )
    if specialties is not None:
        set_employee_specialties(conn, employee_id, specialties)
    conn.commit()
    updated = conn.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()
    employee = employee_response(conn, updated)
    conn.close()
    log_audit("employee updated", current_user, "employee", employee_id, full_name)
    return {"ok": True, "message": "פרטי העובד/ת עודכנו בהצלחה", "employee": employee}


@app.get("/employee-shifts")
def get_employee_shifts(week_start: str, include_inactive: bool = False, _: dict = Depends(require_staff)):
    start = parse_iso_date(week_start, "week_start")
    normalized_week_start = start.strftime("%Y-%m-%d")
    week_dates = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    conn = get_db()
    where = "" if include_inactive else "WHERE is_active = 1"
    employee_rows = conn.execute(f"SELECT * FROM employees {where} ORDER BY is_active DESC, full_name").fetchall()
    block_rows = conn.execute(
        """SELECT b.*, e.full_name AS employee_name
           FROM employee_shift_blocks b
           JOIN employees e ON e.id = b.employee_id
           WHERE b.shift_date BETWEEN ? AND ?
           ORDER BY e.full_name, b.shift_date, b.start_time""",
        (week_dates[0], week_dates[-1]),
    ).fetchall()
    employees = [employee_response(conn, row) for row in employee_rows]
    conn.close()
    return {
        "ok": True,
        "week_start": normalized_week_start,
        "week_end": week_dates[-1],
        "employees": employees,
        "shift_blocks": [shift_block_response(row) for row in block_rows],
        "shifts": [shift_block_response(row) for row in block_rows],
        "has_shifts": len(block_rows) > 0,
    }


@app.put("/employee-shifts/week")
def save_employee_shift_week(body: EmployeeShiftWeekSave, current_user: dict = Depends(require_admin)):
    week_start = parse_iso_date(body.week_start, "week_start")
    normalized_week_start = week_start.strftime("%Y-%m-%d")
    week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    conn = get_db()
    validated = validate_shift_blocks(conn, body.shift_blocks, set(week_dates))
    active_employees = conn.execute("SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name").fetchall()
    conflicts = detect_shift_conflicts(conn, validated, week_dates, active_employees)
    if conflicts and not body.force_conflicts:
        conn.close()
        raise HTTPException(
            status_code=409,
            detail={
                "message": "קיימים תורים מחוץ לחלונות העבודה החדשים",
                "conflicts": conflicts,
            },
        )

    # Replace the selected week for active employees, then insert sorted blocks.
    employee_ids = [row["id"] for row in active_employees]
    if employee_ids:
        placeholders = ",".join("?" for _ in employee_ids)
        conn.execute(
            f"""DELETE FROM employee_shift_blocks
                WHERE shift_date BETWEEN ? AND ? AND employee_id IN ({placeholders})""",
            [week_dates[0], week_dates[-1], *employee_ids],
        )
    for block in validated:
        conn.execute(
            """INSERT INTO employee_shift_blocks
               (employee_id, shift_date, start_time, end_time)
               VALUES (?, ?, ?, ?)""",
            (block["employee_id"], block["shift_date"], block["start_time"], block["end_time"]),
        )
    conn.commit()
    rows = conn.execute(
        """SELECT b.*, e.full_name AS employee_name
           FROM employee_shift_blocks b
           JOIN employees e ON e.id = b.employee_id
           WHERE b.shift_date BETWEEN ? AND ?
           ORDER BY e.full_name, b.shift_date, b.start_time""",
        (normalized_week_start, add_days_iso(normalized_week_start, 6)),
    ).fetchall()
    conn.close()
    log_audit("employee shift blocks saved", current_user, "employee_shift_blocks", None, "", normalized_week_start)
    return {
        "ok": True,
        "message": "המשמרות נשמרו בהצלחה",
        "week_start": normalized_week_start,
        "shift_blocks": [shift_block_response(row) for row in rows],
        "conflicts": conflicts,
    }


@app.get("/appointments")
def list_appointments(_: dict = Depends(require_staff)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM appointments ORDER BY date, time"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/appointments")
def create_appointment(appt: AppointmentCreate, _: dict = Depends(require_staff)):
    conn = get_db()
    normalized_phone = normalize_phone_for_match(appt.client_phone)
    matched_customer = find_customer_by_phone(conn, appt.client_phone)
    cursor = conn.execute(
        """INSERT INTO appointments
           (client_name, client_phone, normalized_client_phone, customer_user_id,
            treatment_id, treatment_name, employee_name, date, time, end_time, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            appt.client_name,
            appt.client_phone,
            normalized_phone,
            matched_customer["id"] if matched_customer else None,
            appt.treatment_id,
            appt.treatment_name,
            appt.employee_name,
            appt.date,
            appt.time,
            appt.end_time,
            appt.status or "scheduled",
            appt.notes,
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    row = conn.execute("SELECT * FROM appointments WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return dict(row)


@app.delete("/appointments/{appt_id}")
def delete_appointment(appt_id: int, _: dict = Depends(require_staff)):
    conn = get_db()
    conn.execute("DELETE FROM appointments WHERE id = ?", (appt_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


class AppointmentReschedule(BaseModel):
    date: str
    time: str
    end_time: Optional[str] = None


@app.patch("/appointments/{appt_id}")
def reschedule_appointment(appt_id: int, data: AppointmentReschedule, _: dict = Depends(require_staff)):
    conn = get_db()
    conn.execute(
        "UPDATE appointments SET date = ?, time = ?, end_time = ? WHERE id = ?",
        (data.date, data.time, data.end_time, appt_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM appointments WHERE id = ?", (appt_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return dict(row)


@app.get("/appointments/analytics-legacy")
def get_analytics(_: dict = Depends(require_staff)):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) as c FROM appointments").fetchone()["c"]
    by_treatment = conn.execute("""
        SELECT treatment_name, COUNT(*) as count
        FROM appointments
        GROUP BY treatment_name
        ORDER BY count DESC
        LIMIT 10
    """).fetchall()
    by_day = conn.execute("""
        SELECT strftime('%w', date) as day_num, COUNT(*) as count
        FROM appointments
        WHERE strftime('%w', date) IS NOT NULL
        GROUP BY day_num
        ORDER BY day_num
    """).fetchall()
    by_hour = conn.execute("""
        SELECT substr(time, 1, 2) as hour, COUNT(*) as count
        FROM appointments
        WHERE length(time) >= 2
        GROUP BY hour
        ORDER BY hour
    """).fetchall()
    recent = conn.execute("""
        SELECT * FROM appointments ORDER BY created_at DESC LIMIT 5
    """).fetchall()
    conn.close()
    day_names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
    return {
        "total": total,
        "by_treatment": [{"name": r["treatment_name"], "count": r["count"]} for r in by_treatment],
        "by_day": [{"day": day_names[int(r["day_num"])], "count": r["count"]} for r in by_day if r["day_num"] is not None],
        "by_hour": [{"hour": f"{r['hour']}:00", "count": r["count"]} for r in by_hour if r["hour"]],
        "recent": [dict(r) for r in recent],
    }


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _add_months(dt: datetime, months: int) -> datetime:
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    return dt.replace(year=year, month=month, day=1)


def _parse_appointment_date(value: str) -> Optional[datetime]:
    try:
        return datetime.strptime((value or "")[:10], "%Y-%m-%d")
    except Exception:
        return None


def _safe_float(value) -> float:
    try:
        if value is None or value == "":
            return 0.0
        return float(str(value).replace(",", "").replace("₪", "").strip())
    except Exception:
        return 0.0


def _table_columns(conn: sqlite3.Connection, table: str) -> set:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


@app.get("/appointments/analytics")
def get_business_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    _: dict = Depends(require_staff),
):
    conn = get_db()
    appointment_columns = _table_columns(conn, "appointments")
    treatment_columns = _table_columns(conn, "treatments_db")
    appointment_revenue_col = next(
        (col for col in ["revenue", "price", "amount", "total_price", "cost"] if col in appointment_columns),
        None,
    )
    treatment_revenue_col = next(
        (col for col in ["price", "revenue", "amount", "cost"] if col in treatment_columns),
        None,
    )
    appointment_revenue_select = (
        f"a.{appointment_revenue_col} AS appointment_revenue_value"
        if appointment_revenue_col
        else "NULL AS appointment_revenue_value"
    )
    treatment_revenue_select = (
        f"t.{treatment_revenue_col} AS treatment_revenue_value"
        if treatment_revenue_col
        else "NULL AS treatment_revenue_value"
    )

    where = []
    params = []
    if from_date:
        where.append("a.date >= ?")
        params.append(from_date)
    if to_date:
        where.append("a.date <= ?")
        params.append(to_date)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    analytics_rows = conn.execute(
        f"""SELECT a.*, {appointment_revenue_select},
                   t.class_name AS treatment_class_name,
                   t.category AS treatment_category,
                   {treatment_revenue_select}
            FROM appointments a
            LEFT JOIN treatments_db t
              ON t.id = a.treatment_id OR lower(t.name) = lower(a.treatment_name)
            {where_sql}
            ORDER BY a.date, a.time""",
        params,
    ).fetchall()

    total = len(analytics_rows)
    today_key = datetime.now().strftime("%Y-%m-%d")
    week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
    today_count = sum(1 for row in analytics_rows if (row["date"] or "")[:10] == today_key)
    this_week_count = sum(1 for row in analytics_rows if (row["date"] or "")[:10] >= week_start)

    by_treatment = conn.execute(f"""
        SELECT treatment_name, COUNT(*) as count
        FROM appointments a
        {where_sql}
        GROUP BY treatment_name
        ORDER BY count DESC
        LIMIT 10
    """, params).fetchall()

    by_day = conn.execute(f"""
        SELECT strftime('%w', date) as day_num, COUNT(*) as count
        FROM appointments a
        {where_sql}
        {"AND" if where_sql else "WHERE"} strftime('%w', date) IS NOT NULL
        GROUP BY day_num
        ORDER BY day_num
    """, params).fetchall()

    by_hour = conn.execute(f"""
        SELECT substr(time, 1, 2) as hour, COUNT(*) as count
        FROM appointments a
        {where_sql}
        {"AND" if where_sql else "WHERE"} length(time) >= 2
        GROUP BY hour
        ORDER BY hour
    """, params).fetchall()

    recent = conn.execute(f"""
        SELECT a.* FROM appointments a {where_sql} ORDER BY created_at DESC LIMIT 5
    """, params).fetchall()

    conn.close()

    today = datetime.now()
    month_keys = [_month_key(_add_months(today, offset)) for offset in range(-5, 1)]
    monthly = {
        key: {"month": key, "count": 0, "revenue": 0.0}
        for key in month_keys
    }
    categories = {}
    total_revenue = 0.0

    for row in analytics_rows:
        dt = _parse_appointment_date(row["date"])
        if dt:
            key = _month_key(dt)
            if key in monthly:
                monthly[key]["count"] += 1
        rev = _safe_float(row["appointment_revenue_value"]) or _safe_float(row["treatment_revenue_value"])
        total_revenue += rev
        if dt and key in monthly:
            monthly[key]["revenue"] += rev
        cat = row["treatment_class_name"] or "אחר"
        categories[cat] = categories.get(cat, 0) + 1

    monthly_trend = list(monthly.values())
    prev_month = monthly_trend[-2]["count"] if len(monthly_trend) >= 2 else 0
    curr_month = monthly_trend[-1]["count"] if monthly_trend else 0
    growth_pct = ((curr_month - prev_month) / prev_month * 100) if prev_month else 0.0

    by_category = sorted(
        [{"category": k, "count": v} for k, v in categories.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    day_names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

    return {
        "total": total,
        "today": today_count,
        "this_week": this_week_count,
        "total_revenue": total_revenue,
        "has_revenue": total_revenue > 0,
        "monthly_growth_pct": round(growth_pct, 1),
        "monthly_trend": monthly_trend,
        "by_category": by_category,
        "top_category": by_category[0] if by_category else None,
        "least_category": by_category[-1] if by_category else None,
        "by_treatment": [{"name": r["treatment_name"], "count": r["count"]} for r in by_treatment],
        "by_day": [{"day": day_names[int(r["day_num"])], "count": r["count"]} for r in by_day if r["day_num"] is not None],
        "by_hour": [{"hour": f"{r['hour']}:00", "count": r["count"]} for r in by_hour if r["hour"]],
        "recent": [dict(r) for r in recent],
    }


@app.get("/analytics/monthly-trend")
def get_monthly_trend_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_staff),
):
    data = get_business_analytics(from_date=from_date, to_date=to_date, _=current_user)
    return {
        "total": data["total"],
        "total_revenue": data["total_revenue"],
        "has_revenue": data["has_revenue"],
        "monthly_growth_pct": data["monthly_growth_pct"],
        "monthly_trend": data["monthly_trend"],
    }


@app.get("/analytics/appointments-by-category")
def get_appointments_by_category_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_staff),
):
    data = get_business_analytics(from_date=from_date, to_date=to_date, _=current_user)
    return {
        "total": data["total"],
        "by_category": data["by_category"],
        "top_category": data["top_category"],
        "least_category": data["least_category"],
    }


# ------------------------------------------------------------
# Auth endpoints
# ------------------------------------------------------------

class GoogleAuthRequest(BaseModel):
    credential: str


class StaffLoginRequest(BaseModel):
    username: str
    password: str


class BootstrapAdminRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = ""


class StaffUserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    role: Optional[str] = "secretary"


class StaffUserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None
    role: Optional[str] = None


class CustomerRegisterRequest(BaseModel):
    username: str
    password: str
    fullName: str
    email: Optional[str] = ""
    phone: str
    age: Optional[str] = ""
    gender: Optional[str] = ""
    selectedTreatments: Optional[List[str]] = []


class CustomerLoginRequest(BaseModel):
    username: str
    password: str


class PasswordResetStartRequest(BaseModel):
    identifier: str


class PasswordResetConfirmRequest(BaseModel):
    identifier: str
    code: str
    password: str


class AccountSettingsUpdate(BaseModel):
    old_password: str
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class SettingsUpdateRequest(BaseModel):
    business_name: str
    phone: str
    whatsapp: Optional[str] = ""
    email: str
    address: str
    opening_hours: str


class SettingsAccountUpdateRequest(BaseModel):
    username: str
    email: Optional[str] = ""


class SettingsPasswordUpdateRequest(BaseModel):
    old_password: str
    password: str


class CustomerAdminUpdate(BaseModel):
    username: Optional[str] = None
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None


class CustomerProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    selectedTreatments: Optional[List[str]] = None


def build_staff_session(row: sqlite3.Row) -> dict:
    staff = staff_user_response(row)
    return {
        "id": staff["id"],
        "username": staff["username"],
        "fullName": staff["full_name"],
        "email": staff.get("email") or "",
        "role": staff["role"],
        "type": "staff",
    }


@app.post("/auth/google")
def google_auth(body: GoogleAuthRequest):
    try:
        info = verify_google_token(body.credential)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE google_id = ?", (info["google_id"],)).fetchone()

    if row:
        user_id = row["id"]
        conn.execute(
            "UPDATE users SET name = ?, picture = ? WHERE id = ?",
            (info["name"], info["picture"], user_id),
        )
    else:
        cursor = conn.execute(
            "INSERT INTO users (google_id, email, name, picture, role) VALUES (?, ?, ?, ?, ?)",
            (info["google_id"], info["email"], info["name"], info["picture"], CUSTOMER_ROLE),
        )
        user_id = cursor.lastrowid

    conn.commit()
    conn.close()

    token = create_jwt(user_id, info["email"], info["name"], CUSTOMER_ROLE, "customer")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": info["email"],
            "name": info["name"],
            "picture": info["picture"],
            "role": CUSTOMER_ROLE,
        },
    }


@app.post("/auth/customer/register", status_code=201)
def customer_register(body: CustomerRegisterRequest):
    username = body.username.strip()
    full_name = body.fullName.strip()
    email = validate_email(body.email)
    phone = validate_phone(body.phone, required=True)
    validate_customer_password_strength(body.password)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if not full_name:
        raise HTTPException(status_code=400, detail="full name is required")

    conn = get_db()
    if username_exists(conn, username):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email_exists(conn, email):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    try:
        cursor = conn.execute(
            """INSERT INTO customer_users
               (username, full_name, email, phone, age, gender, selected_treatments, password_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                username,
                full_name,
                email,
                phone,
                body.age or "",
                body.gender or "",
                json.dumps(body.selectedTreatments or [], ensure_ascii=False),
                hash_password(body.password),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM customer_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    conn.close()
    user = customer_user_response(row)
    token = create_jwt(row["id"], row["email"] or row["username"], row["full_name"], CUSTOMER_ROLE, "customer")
    return {"token": token, "user": user, "customer": user}


@app.post("/auth/customer/login")
def customer_login(body: CustomerLoginRequest):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM customer_users WHERE username = ? AND active = 1",
        (body.username.strip(),),
    ).fetchone()
    if not row or not verify_or_migrate_password(conn, "customer_users", row["id"], body.password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="invalid username or password")
    conn.close()
    user = customer_user_response(row)
    token = create_jwt(row["id"], row["email"] or row["username"], row["full_name"], CUSTOMER_ROLE, "customer")
    return {"token": token, "user": user, "customer": user}


@app.post("/auth/customer/password-reset/start")
def start_customer_password_reset(body: PasswordResetStartRequest):
    identifier = (body.identifier or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="יש להזין אימייל או טלפון")
    conn = get_db()
    row = conn.execute(
        """SELECT * FROM customer_users
           WHERE active = 1 AND (lower(email) = lower(?) OR phone = ?)""",
        (identifier, identifier),
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="לא נמצא חשבון עם הפרטים שהוזנו")

    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    conn.execute(
        "UPDATE password_reset_codes SET used = 1 WHERE customer_id = ? AND used = 0",
        (row["id"],),
    )
    conn.execute(
        """INSERT INTO password_reset_codes (customer_id, identifier, code_hash, expires_at)
           VALUES (?, ?, ?, ?)""",
        (row["id"], identifier, hash_password(code), expires_at),
    )
    conn.commit()
    conn.close()
    print(f"[password reset] Customer {row['username']} temporary code: {code}")
    return {
        "ok": True,
        "message": "קוד אימות נוצר. בסביבת פיתוח הקוד מוצג כאן ובקונסול השרת.",
        "dev_code": code,
    }


@app.post("/auth/customer/password-reset/confirm")
def confirm_customer_password_reset(body: PasswordResetConfirmRequest):
    identifier = (body.identifier or "").strip()
    code = (body.code or "").strip()
    validate_customer_password_strength(body.password)
    if not identifier or not code:
        raise HTTPException(status_code=400, detail="יש להזין קוד אימות")

    conn = get_db()
    row = conn.execute(
        """SELECT pr.*, cu.username
           FROM password_reset_codes pr
           JOIN customer_users cu ON cu.id = pr.customer_id
           WHERE pr.identifier = ? AND pr.used = 0
           ORDER BY pr.created_at DESC, pr.id DESC
           LIMIT 1""",
        (identifier,),
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="קוד האימות שגוי או שפג תוקפו")
    try:
        expires_at = datetime.fromisoformat(row["expires_at"])
    except Exception:
        expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    if expires_at < datetime.now(timezone.utc) or not verify_password(code, row["code_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="קוד האימות שגוי או שפג תוקפו")

    conn.execute(
        "UPDATE customer_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (hash_password(body.password), row["customer_id"]),
    )
    conn.execute("UPDATE password_reset_codes SET used = 1 WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()
    log_audit("password changed", None, "customer", row["customer_id"], row["username"], "password reset")
    return {"ok": True, "message": "הסיסמה עודכנה בהצלחה"}


@app.post("/auth/staff/bootstrap-admin", status_code=201)
def bootstrap_admin(body: BootstrapAdminRequest):
    conn = get_db()
    admin_count = conn.execute(
        "SELECT COUNT(*) FROM staff_users WHERE role = 'admin'"
    ).fetchone()[0]
    if admin_count > 0:
        conn.close()
        raise HTTPException(status_code=403, detail="Admin bootstrap is disabled because an admin already exists")
    if len(body.password) < 8:
        conn.close()
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")
    try:
        cursor = conn.execute(
            """INSERT INTO staff_users (username, full_name, email, role, password_hash)
               VALUES (?, ?, ?, 'admin', ?)""",
            (body.username.strip(), body.full_name.strip(), (body.email or "").strip(), hash_password(body.password)),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM staff_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    return {
        "ok": True,
        "message": "First admin created successfully",
        "user": staff_user_response(row),
    }


@app.get("/auth/staff/bootstrap-admin")
def bootstrap_admin_info():
    conn = get_db()
    admin_count = conn.execute("SELECT COUNT(*) FROM staff_users WHERE role = 'admin'").fetchone()[0]
    conn.close()
    return {
        "ok": True,
        "message": "Use POST /auth/staff/bootstrap-admin with JSON username, password, full_name, and optional email.",
        "admin_exists": admin_count > 0,
    }


@app.post("/auth/staff/login")
def staff_login(body: StaffLoginRequest):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM staff_users WHERE username = ? AND active = 1",
        (body.username.strip(),),
    ).fetchone()
    if not row or not verify_or_migrate_password(conn, "staff_users", row["id"], body.password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid staff username or password")
    conn.close()
    session_user = build_staff_session(row)
    token = create_jwt(row["id"], row["email"] or row["username"], row["full_name"], row["role"], "staff")
    return {"token": token, "user": session_user}


@app.get("/auth/me")
def get_me(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if current_user.get("type") == "staff":
        conn = get_db()
        row = conn.execute(
            "SELECT * FROM staff_users WHERE id = ? AND active = 1",
            (current_user["id"],),
        ).fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Staff user not found")
        return build_staff_session(row)
    conn = get_db()
    row = conn.execute("SELECT * FROM customer_users WHERE id = ? AND active = 1", (current_user["id"],)).fetchone()
    if row:
        conn.close()
        return customer_user_response(row)
    row = conn.execute("SELECT id, email, name, picture, role, created_at FROM users WHERE id = ?", (current_user["id"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {**dict(row), "role": normalize_role(row["role"])}


def _read_system_settings(conn: sqlite3.Connection) -> dict:
    settings = dict(DEFAULT_SYSTEM_SETTINGS)
    rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
    settings.update({row["key"]: row["value"] for row in rows})
    return settings


def _current_account_row(conn: sqlite3.Connection, current_user: dict):
    role = normalize_role(current_user.get("role"))
    if role in STAFF_ROLES:
        row = conn.execute(
            "SELECT * FROM staff_users WHERE id = ? AND active = 1",
            (current_user["id"],),
        ).fetchone()
        return row, "staff_users", "staff"
    if role == CUSTOMER_ROLE:
        row = conn.execute(
            "SELECT * FROM customer_users WHERE id = ? AND active = 1",
            (current_user["id"],),
        ).fetchone()
        return row, "customer_users", "customer"
    return None, "", ""


def _account_response(row: sqlite3.Row, account_type: str) -> dict:
    if account_type == "staff":
        return build_staff_session(row)
    return customer_user_response(row)


@app.get("/settings")
def get_settings(current_user: dict = Depends(require_authenticated)):
    conn = get_db()
    row, _, account_type = _current_account_row(conn, current_user)
    settings = _read_system_settings(conn)
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="account not found")
    return {
        "ok": True,
        "settings": settings,
        "user": _account_response(row, account_type),
        "can_update_system": normalize_role(current_user.get("role")) in ADMIN_ROLES,
    }


@app.put("/settings")
def update_settings(body: SettingsUpdateRequest, current_user: dict = Depends(require_admin)):
    business_name = (body.business_name or "").strip()
    phone = validate_settings_phone(body.phone, required=True)
    whatsapp = validate_settings_phone(body.whatsapp, required=False)
    email = validate_email(body.email, required=True)
    address = (body.address or "").strip()
    opening_hours = (body.opening_hours or "").strip()
    if not business_name:
        raise HTTPException(status_code=400, detail="business name is required")
    if not address:
        raise HTTPException(status_code=400, detail="address is required")
    if not opening_hours:
        raise HTTPException(status_code=400, detail="opening hours are required")

    values = {
        "business_name": business_name,
        "phone": phone,
        "whatsapp": whatsapp,
        "email": email,
        "address": address,
        "opening_hours": opening_hours,
    }
    conn = get_db()
    for key, value in values.items():
        conn.execute(
            """INSERT INTO system_settings (key, value, updated_at)
               VALUES (?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP""",
            (key, value),
        )
    conn.commit()
    settings = _read_system_settings(conn)
    conn.close()
    log_audit("system settings updated", current_user, "settings", None, "system")
    return {"ok": True, "settings": settings}


@app.put("/settings/account")
def update_settings_account(body: SettingsAccountUpdateRequest, current_user: dict = Depends(require_authenticated)):
    username = (body.username or "").strip()
    email = validate_email(body.email, required=False)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")

    conn = get_db()
    row, table, account_type = _current_account_row(conn, current_user)
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="account not found")
    if username != row["username"] and username_exists(conn, username, exclude_type=account_type, exclude_id=row["id"]):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email != (row["email"] or "") and email_exists(conn, email, exclude_type=account_type, exclude_id=row["id"]):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")

    conn.execute(
        f"UPDATE {table} SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (username, email, row["id"]),
    )
    conn.commit()
    updated = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row["id"],)).fetchone()
    conn.close()
    if username != row["username"]:
        log_audit("username changed", current_user, account_type, row["id"], username, f"{row['username']} -> {username}")
    return {"ok": True, "user": _account_response(updated, account_type)}


@app.put("/settings/password")
def update_settings_password(body: SettingsPasswordUpdateRequest, current_user: dict = Depends(require_authenticated)):
    validate_password_strength(body.password)
    conn = get_db()
    row, table, account_type = _current_account_row(conn, current_user)
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="account not found")
    if not verify_or_migrate_password(conn, table, row["id"], body.old_password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="old password is incorrect")
    conn.execute(
        f"UPDATE {table} SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (hash_password(body.password), row["id"]),
    )
    conn.commit()
    updated = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row["id"],)).fetchone()
    conn.close()
    log_audit("password changed", current_user, account_type, row["id"], row["username"])
    return {"ok": True, "user": _account_response(updated, account_type)}


@app.put("/account/settings")
def update_account_settings(body: AccountSettingsUpdate, current_user: dict = Depends(require_authenticated)):
    role = normalize_role(current_user.get("role"))
    user_type = "staff" if role in STAFF_ROLES else "customer"
    conn = get_db()

    if user_type == "staff":
        row = conn.execute("SELECT * FROM staff_users WHERE id = ? AND active = 1", (current_user["id"],)).fetchone()
        table = "staff_users"
        exclude_type = "staff"
    else:
        row = conn.execute("SELECT * FROM customer_users WHERE id = ? AND active = 1", (current_user["id"],)).fetchone()
        table = "customer_users"
        exclude_type = "customer"

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="account not found")
    if not verify_or_migrate_password(conn, table, row["id"], body.old_password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="old password is incorrect")

    next_username = body.username.strip() if body.username is not None else row["username"]
    next_email = validate_email(body.email, required=False) if body.email is not None else (row["email"] or "")
    next_phone = validate_phone(body.phone, required=False) if body.phone is not None else (row["phone"] or "")
    next_hash = row["password_hash"]
    changes = []

    if not next_username:
        conn.close()
        raise HTTPException(status_code=400, detail="username is required")
    if next_username != row["username"]:
        if username_exists(conn, next_username, exclude_type=exclude_type, exclude_id=row["id"]):
            conn.close()
            raise HTTPException(status_code=409, detail="username already exists")
        changes.append("username changed")
    if next_email != (row["email"] or ""):
        if next_email and email_exists(conn, next_email, exclude_type=exclude_type, exclude_id=row["id"]):
            conn.close()
            raise HTTPException(status_code=409, detail="email already exists")
    if body.password:
        if user_type == "customer":
            validate_customer_password_strength(body.password)
        else:
            validate_password_strength(body.password)
        next_hash = hash_password(body.password)
        changes.append("password changed")

    conn.execute(
        f"""UPDATE {table}
            SET username = ?, email = ?, phone = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?""",
        (next_username, next_email, next_phone, next_hash, row["id"]),
    )
    conn.commit()
    updated = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row["id"],)).fetchone()
    conn.close()

    for action in changes:
        log_audit(action, current_user, user_type, row["id"], next_username)

    if user_type == "staff":
        return {"ok": True, "user": build_staff_session(updated)}
    return {"ok": True, "user": customer_user_response(updated)}


@app.get("/customers/me")
def get_customer_profile(current_user: dict = Depends(require_authenticated)):
    if normalize_role(current_user.get("role")) != CUSTOMER_ROLE:
        raise HTTPException(status_code=403, detail="customer access required")
    conn = get_db()
    row = conn.execute("SELECT * FROM customer_users WHERE id = ? AND active = 1", (current_user["id"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="customer not found")
    return {"ok": True, "customer": customer_user_response(row)}


@app.put("/customers/me")
def update_customer_profile(body: CustomerProfileUpdate, current_user: dict = Depends(require_authenticated)):
    if normalize_role(current_user.get("role")) != CUSTOMER_ROLE:
        raise HTTPException(status_code=403, detail="customer access required")
    conn = get_db()
    row = conn.execute("SELECT * FROM customer_users WHERE id = ? AND active = 1", (current_user["id"],)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="customer not found")
    full_name = body.fullName.strip() if body.fullName is not None else row["full_name"]
    email = validate_email(body.email) if body.email is not None else (row["email"] or "")
    phone = validate_phone(body.phone) if body.phone is not None else (row["phone"] or "")
    if email and email != (row["email"] or "") and email_exists(conn, email, exclude_type="customer", exclude_id=row["id"]):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    selected = json.dumps(body.selectedTreatments if body.selectedTreatments is not None else json.loads(row["selected_treatments"] or "[]"), ensure_ascii=False)
    conn.execute(
        """UPDATE customer_users
           SET full_name = ?, email = ?, phone = ?, age = ?, gender = ?, selected_treatments = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (
            full_name,
            email,
            phone,
            body.age if body.age is not None else row["age"],
            body.gender if body.gender is not None else row["gender"],
            selected,
            row["id"],
        ),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM customer_users WHERE id = ?", (row["id"],)).fetchone()
    conn.close()
    log_audit("customer details updated", current_user, "customer", row["id"], row["username"])
    return {"ok": True, "customer": customer_user_response(updated)}


@app.get("/customers/me/appointments")
def get_customer_appointments(current_user: dict = Depends(require_authenticated)):
    if normalize_role(current_user.get("role")) != CUSTOMER_ROLE:
        raise HTTPException(status_code=403, detail="customer access required")
    conn = get_db()
    customer = conn.execute(
        "SELECT id, phone FROM customer_users WHERE id = ? AND active = 1",
        (current_user["id"],),
    ).fetchone()
    if not customer:
        conn.close()
        raise HTTPException(status_code=404, detail="customer not found")
    normalized_phone = normalize_phone_for_match(customer["phone"])
    if not normalized_phone:
        conn.close()
        return {"ok": True, "appointments": []}
    rows = conn.execute(
        """SELECT id, client_name, client_phone, treatment_id, treatment_name, employee_name,
                  date, time, end_time, status, notes, created_at
           FROM appointments
           WHERE customer_user_id = ?
              OR normalized_client_phone = ?
              OR replace(replace(replace(replace(client_phone, '-', ''), ' ', ''), '(', ''), ')', '') = ?
           ORDER BY date ASC, time ASC
           LIMIT 10""",
        (customer["id"], normalized_phone, normalized_phone),
    ).fetchall()
    conn.close()
    return {"ok": True, "appointments": [dict(row) for row in rows]}


@app.get("/admin/secretaries")
def list_secretaries(_: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM staff_users WHERE role = 'secretary' ORDER BY full_name, username"
    ).fetchall()
    conn.close()
    return [staff_user_response(row) for row in rows]


@app.get("/staff/users")
def list_staff_users(_: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM staff_users WHERE role = 'secretary' ORDER BY full_name, username"
    ).fetchall()
    conn.close()
    return {"ok": True, "users": [staff_user_response(row) for row in rows]}


@app.post("/admin/secretaries", status_code=201)
def create_secretary(body: StaffUserCreate, current_user: dict = Depends(require_admin)):
    if normalize_role(body.role or "secretary") != "secretary":
        raise HTTPException(status_code=403, detail="Admins can only create secretary users from this endpoint")
    validate_password_strength(body.password)
    username = body.username.strip()
    full_name = body.full_name.strip()
    email = validate_email(body.email)
    phone = validate_phone(body.phone)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if not full_name:
        raise HTTPException(status_code=400, detail="full name is required")
    conn = get_db()
    if username_exists(conn, username):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email_exists(conn, email):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    try:
        cursor = conn.execute(
            """INSERT INTO staff_users (username, full_name, email, phone, role, password_hash)
               VALUES (?, ?, ?, ?, 'secretary', ?)""",
            (username, full_name, email, phone, hash_password(body.password)),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM staff_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    log_audit("secretary created", current_user, "staff", row["id"], row["username"])
    return staff_user_response(row)


@app.post("/staff/users", status_code=201)
def create_staff_user(body: StaffUserCreate, current_user: dict = Depends(require_admin)):
    if normalize_role(body.role or "secretary") != "secretary":
        raise HTTPException(status_code=403, detail="Admins can only create secretary users from this endpoint")
    validate_password_strength(body.password)
    username = body.username.strip()
    full_name = body.full_name.strip()
    email = validate_email(body.email)
    phone = validate_phone(body.phone)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if not full_name:
        raise HTTPException(status_code=400, detail="full name is required")
    conn = get_db()
    if username_exists(conn, username):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email_exists(conn, email):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    try:
        cursor = conn.execute(
            """INSERT INTO staff_users (username, full_name, email, phone, role, password_hash)
               VALUES (?, ?, ?, ?, 'secretary', ?)""",
            (username, full_name, email, phone, hash_password(body.password)),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM staff_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    log_audit("secretary created", current_user, "staff", row["id"], row["username"])
    return {"ok": True, "message": "Secretary user created successfully", "user": staff_user_response(row)}


@app.put("/admin/secretaries/{secretary_id}")
def update_secretary(secretary_id: int, body: StaffUserUpdate, current_user: dict = Depends(require_admin)):
    if body.role is not None and normalize_role(body.role) != "secretary":
        raise HTTPException(status_code=403, detail="Admins can only update secretary users from this endpoint")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM staff_users WHERE id = ? AND role = 'secretary'", (secretary_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Secretary not found")

    username = body.username.strip() if body.username is not None else row["username"]
    full_name = body.full_name.strip() if body.full_name is not None else row["full_name"]
    email = validate_email(body.email) if body.email is not None else (row["email"] or "")
    phone = validate_phone(body.phone) if body.phone is not None else (row["phone"] or "")
    active = int(body.active) if body.active is not None else row["active"]
    if not username:
        conn.close()
        raise HTTPException(status_code=400, detail="username is required")
    if username != row["username"] and username_exists(conn, username, exclude_type="staff", exclude_id=secretary_id):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email != (row["email"] or "") and email_exists(conn, email, exclude_type="staff", exclude_id=secretary_id):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    if body.password:
        validate_password_strength(body.password)
    password_hash = hash_password(body.password) if body.password else row["password_hash"]

    try:
        conn.execute(
            """UPDATE staff_users
               SET username = ?, full_name = ?, email = ?, phone = ?, active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND role = 'secretary'""",
            (username, full_name, email, phone, active, password_hash, secretary_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM staff_users WHERE id = ?", (secretary_id,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    if username != row["username"]:
        log_audit("username changed", current_user, "staff", secretary_id, username, f"{row['username']} -> {username}")
    if body.password:
        log_audit("password changed", current_user, "staff", secretary_id, username)
    return staff_user_response(updated)


@app.put("/staff/users/{staff_user_id}")
def update_staff_user(staff_user_id: int, body: StaffUserUpdate, current_user: dict = Depends(require_admin)):
    if body.role is not None and normalize_role(body.role) != "secretary":
        raise HTTPException(status_code=403, detail="Admins can only update secretary users from this endpoint")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM staff_users WHERE id = ? AND role = 'secretary'", (staff_user_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Secretary user not found")

    username = body.username.strip() if body.username is not None else row["username"]
    full_name = body.full_name.strip() if body.full_name is not None else row["full_name"]
    email = validate_email(body.email) if body.email is not None else (row["email"] or "")
    phone = validate_phone(body.phone) if body.phone is not None else (row["phone"] or "")
    active = int(body.active) if body.active is not None else row["active"]
    if not username:
        conn.close()
        raise HTTPException(status_code=400, detail="username is required")
    if username != row["username"] and username_exists(conn, username, exclude_type="staff", exclude_id=staff_user_id):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email != (row["email"] or "") and email_exists(conn, email, exclude_type="staff", exclude_id=staff_user_id):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    if body.password:
        validate_password_strength(body.password)
    password_hash = hash_password(body.password) if body.password else row["password_hash"]

    try:
        conn.execute(
            """UPDATE staff_users
               SET username = ?, full_name = ?, email = ?, phone = ?, active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND role = 'secretary'""",
            (username, full_name, email, phone, active, password_hash, staff_user_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM staff_users WHERE id = ?", (staff_user_id,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    if username != row["username"]:
        log_audit("username changed", current_user, "staff", staff_user_id, username, f"{row['username']} -> {username}")
    if body.password:
        log_audit("password changed", current_user, "staff", staff_user_id, username)
    return {"ok": True, "message": "Secretary user updated successfully", "user": staff_user_response(updated)}


@app.delete("/admin/secretaries/{secretary_id}")
def delete_secretary(secretary_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db()
    row = conn.execute(
        "SELECT id, username FROM staff_users WHERE id = ? AND role = 'secretary'", (secretary_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Secretary not found")
    conn.execute("DELETE FROM staff_users WHERE id = ? AND role = 'secretary'", (secretary_id,))
    conn.commit()
    conn.close()
    log_audit("secretary deleted", current_user, "staff", secretary_id, row["username"])
    return {"ok": True}


@app.delete("/staff/users/{staff_user_id}")
def delete_staff_user(staff_user_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db()
    row = conn.execute(
        "SELECT id, username FROM staff_users WHERE id = ? AND role = 'secretary'", (staff_user_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Secretary user not found")
    conn.execute("DELETE FROM staff_users WHERE id = ? AND role = 'secretary'", (staff_user_id,))
    conn.commit()
    conn.close()
    log_audit("secretary deleted", current_user, "staff", staff_user_id, row["username"])
    return {"ok": True, "message": "Secretary user deleted successfully"}


@app.get("/admin/customers")
def list_customers(search: Optional[str] = None, _: dict = Depends(require_admin)):
    conn = get_db()
    params = []
    where = ""
    if search:
        where = "WHERE lower(username) LIKE lower(?) OR lower(full_name) LIKE lower(?) OR lower(email) LIKE lower(?) OR phone LIKE ?"
        term = f"%{search.strip()}%"
        params = [term, term, term, term]
    rows = conn.execute(
        f"SELECT * FROM customer_users {where} ORDER BY updated_at DESC, full_name",
        params,
    ).fetchall()
    conn.close()
    return {"ok": True, "customers": [customer_user_response(row) for row in rows]}


@app.post("/admin/customers", status_code=201)
def create_customer_admin(body: CustomerRegisterRequest, current_user: dict = Depends(require_admin)):
    username = body.username.strip()
    full_name = body.fullName.strip()
    email = validate_email(body.email)
    phone = validate_phone(body.phone, required=True)
    validate_customer_password_strength(body.password)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if not full_name:
        raise HTTPException(status_code=400, detail="full name is required")

    conn = get_db()
    if username_exists(conn, username):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email_exists(conn, email):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    try:
        cursor = conn.execute(
            """INSERT INTO customer_users
               (username, full_name, email, phone, age, gender, selected_treatments, password_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                username,
                full_name,
                email,
                phone,
                body.age or "",
                body.gender or "",
                json.dumps(body.selectedTreatments or [], ensure_ascii=False),
                hash_password(body.password),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM customer_users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    conn.close()
    log_audit("customer created", current_user, "customer", row["id"], row["username"])
    return {"ok": True, "customer": customer_user_response(row)}


@app.put("/admin/customers/{customer_id}")
def update_customer_admin(customer_id: int, body: CustomerAdminUpdate, current_user: dict = Depends(require_admin)):
    conn = get_db()
    row = conn.execute("SELECT * FROM customer_users WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="customer not found")

    username = body.username.strip() if body.username is not None else row["username"]
    full_name = body.fullName.strip() if body.fullName is not None else row["full_name"]
    email = validate_email(body.email) if body.email is not None else (row["email"] or "")
    phone = validate_phone(body.phone) if body.phone is not None else (row["phone"] or "")
    active = int(body.active) if body.active is not None else row["active"]
    if not username:
        conn.close()
        raise HTTPException(status_code=400, detail="username is required")
    if username != row["username"] and username_exists(conn, username, exclude_type="customer", exclude_id=customer_id):
        conn.close()
        raise HTTPException(status_code=409, detail="username already exists")
    if email and email != (row["email"] or "") and email_exists(conn, email, exclude_type="customer", exclude_id=customer_id):
        conn.close()
        raise HTTPException(status_code=409, detail="email already exists")
    if body.password:
        validate_password_strength(body.password)
    password_hash = hash_password(body.password) if body.password else row["password_hash"]

    conn.execute(
        """UPDATE customer_users
           SET username = ?, full_name = ?, email = ?, phone = ?, active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (username, full_name, email, phone, active, password_hash, customer_id),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM customer_users WHERE id = ?", (customer_id,)).fetchone()
    conn.close()
    log_audit("customer details updated", current_user, "customer", customer_id, username)
    if username != row["username"]:
        log_audit("username changed", current_user, "customer", customer_id, username, f"{row['username']} -> {username}")
    if body.password:
        log_audit("password changed", current_user, "customer", customer_id, username)
    return {"ok": True, "customer": customer_user_response(updated)}


@app.delete("/admin/customers/{customer_id}")
def delete_customer_admin(customer_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db()
    row = conn.execute("SELECT id, username FROM customer_users WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="customer not found")
    conn.execute("DELETE FROM customer_users WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()
    log_audit("customer deleted", current_user, "customer", customer_id, row["username"])
    return {"ok": True, "message": "customer deleted successfully"}


@app.get("/admin/audit-log")
def get_audit_log(limit: int = 100, _: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?",
        (max(1, min(limit, 500)),),
    ).fetchall()
    conn.close()
    return {"ok": True, "items": [dict(row) for row in rows]}


if __name__ == "__main__":
    import uvicorn

    reload_enabled = os.getenv("UVICORN_RELOAD", "").lower() in {"1", "true", "yes", "on"}
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=reload_enabled)
