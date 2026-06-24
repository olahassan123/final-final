from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
from typing import Optional, List, Dict
from pydantic import BaseModel
from groq import Groq
import os
import shutil
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

    # Development migration for old rows that accidentally stored plain text.
    # The table names are controlled by server code, not user input.
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
    # Phone matching ignores formatting differences such as spaces and hyphens.
    return re.sub(r"\D", "", phone or "")


def validate_password_strength(password: str):
    if not password:
        raise HTTPException(status_code=400, detail="password is required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="weak password: password must contain at least 8 characters")


def validate_customer_password_strength(password: str):
    # Customer passwords need a clear strength policy, while still using the existing hash_password storage.
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

# ------------------------------------------------------------
# Groq setup
# ------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY)


def groq_is_configured() -> bool:
    key = (GROQ_API_KEY or "").strip()
    return bool(key and key.startswith("gsk_") and "." not in key)

# ------------------------------------------------------------
# Load Excel data once on startup
# ------------------------------------------------------------
EXCEL_DIR = Path(__file__).parent


def to_text(x):
    if x is None:
        return ""
    s = str(x).strip()
    return "" if s.lower() == "nan" else s


def _default_chatbot_settings() -> List[Dict]:
    return [
        {"topic": "מחירים ועלויות",    "keywords": ["מחיר", "עולה", "עלות", "תשלום", "מבצע", "הנחה", "כמה עולה"], "redirect_message": "", "active": True},
        {"topic": "זמינות תורים",       "keywords": ["פנוי", "תור", "זמין", "ביומן", "מתי אפשר", "לקבוע"],         "redirect_message": "", "active": True},
        {"topic": "פרטי עובדות",        "keywords": ["מטפלת", "עובדת", "צוות", "מי עושה", "מי נותנת"],             "redirect_message": "", "active": True},
        {"topic": "מדיניות ביטולים",   "keywords": ["ביטול", "החזר", "בטל", "שינוי תור", "לבטל"],                 "redirect_message": "", "active": True},
        {"topic": "אבחון רפואי",        "keywords": ["אבחנה", "מחלה", "רופא", "מה יש לי", "לאבחן"],                "redirect_message": "", "active": True},
        {"topic": "מתחרים",             "keywords": ["מתחרה", "אחרים", "מקום אחר", "השוואה", "עדיף"],              "redirect_message": "", "active": True},
    ]


def load_chatbot_settings() -> List[Dict]:
    path = EXCEL_DIR / "chatbot_settings.xlsx"
    if not path.exists():
        return _default_chatbot_settings()
    try:
        df = pd.read_excel(path).fillna("")
        settings = []
        for _, row in df.iterrows():
            topic = to_text(row.get("נושא", ""))
            if not topic:
                continue
            active_val = to_text(row.get("פעיל", "כן")).strip().lower()
            settings.append({
                "topic": topic,
                "keywords": [k.strip() for k in to_text(row.get("מילות_מפתח", "")).split(",") if k.strip()],
                "redirect_message": to_text(row.get("הודעת_הפניה", "")),
                "active": active_val in ("כן", "yes", "true", "1"),
            })
        return settings or _default_chatbot_settings()
    except Exception as e:
        print(f"[Chatbot settings load error] {e}")
        return _default_chatbot_settings()


def _ensure_default_chatbot_settings():
    path = EXCEL_DIR / "chatbot_settings.xlsx"
    if path.exists():
        return
    defaults = _default_chatbot_settings()
    df = pd.DataFrame({
        "נושא":          [s["topic"] for s in defaults],
        "מילות_מפתח":   [",".join(s["keywords"]) for s in defaults],
        "הודעת_הפניה":  [s["redirect_message"] for s in defaults],
        "פעיל":          ["כן" for _ in defaults],
    })
    df.to_excel(path, index=False)
    print("[Chatbot settings] Created default chatbot_settings.xlsx")


def _build_blocked_topics_prompt(settings: List[Dict]) -> str:
    active = [s for s in settings if s.get("active")]
    if not active:
        return ""
    topic_lines = []
    for s in active:
        kw_hint = f" (לדוגמה: {', '.join(s['keywords'][:4])})" if s.get("keywords") else ""
        topic_lines.append(f"- {s['topic']}{kw_hint}")
    topics_block = "\n".join(topic_lines)
    default_redirect = (
        '"לגבי [נושא השאלה], הכי טוב לדבר ישירות עם הצוות שלנו 😊 '
        'ניתן ליצור קשר בטלפון או בוואטסאפ ונשמח לעזור!"'
    )
    custom_lines = [
        f"  עבור '{s['topic']}': {s['redirect_message']}"
        for s in active if s.get("redirect_message")
    ]
    custom_block = ("\nהודעות הפניה מותאמות:\n" + "\n".join(custom_lines)) if custom_lines else ""
    return (
        f"נושאים שאסור לך לענות עליהם — הפני תמיד לצוות:\n{topics_block}\n\n"
        f"כאשר נשאלת על אחד מהנושאים האסורים, השב:\n{default_redirect}{custom_block}\n\n"
    )


def load_treatments() -> List[Dict]:
    treatments_df = pd.read_excel(EXCEL_DIR / "Treatments.xlsx")
    faq_df = pd.read_excel(EXCEL_DIR / "questions.xlsx")

    treatments = []
    for i, row in treatments_df.iterrows():
        name = to_text(row.get("שם_הטיפול", ""))
        if not name:
            continue

        tid = f"t_{i}"

        # Match FAQs by treatment name
        faqs = {}
        mask = (
            faq_df["שם_הטיפול"].astype(str).str.strip().str.lower()
            == name.strip().lower()
        )
        for _, frow in faq_df[mask].iterrows():
            q = to_text(frow.get("שאלה", ""))
            a = to_text(frow.get("תשובה", ""))
            if q and a:
                faqs[q] = a

        treatments.append({
            "id": tid,
            "name": name,
            "class_name": to_text(row.get("קטגוריה ראשית", "")),
            "category": to_text(row.get("תת_קטגוריה", "")),
            "keywords": to_text(row.get("הערות_כלליות", "")),
            "suitable_for_all_skins": to_text(row.get("למי_מתאים", "")),
            "ages": "",
            "results_timing": to_text(row.get("תוצאות", "")),
            "complementary_products": "",
            "aftercare": to_text(row.get("תיאור_הטיפול", "")),
            "consultation_required": "",
            "recommended_frequency": to_text(row.get("מספר_טיפולים_מומלץ", "")),
            "pregnancy_breastfeeding": to_text(row.get("הריון_והנקה", "")),
            "medical_limitations": to_text(row.get("למי_לא_מתאים", "")),
            "faq": faqs,
        })

    return treatments


def load_category_fields():
    path = EXCEL_DIR / "category_questions.xlsx"
    if not path.exists():
        return {}, {}
    df = pd.read_excel(path).fillna("").sort_values(["קטגוריה", "סדר"])
    category_fields: Dict[str, List[Dict]] = {}
    minimum_fields: Dict[str, List[str]] = {}
    for _, row in df.iterrows():
        cat = to_text(row.get("קטגוריה", ""))
        field = to_text(row.get("שדה", ""))
        if not cat or not field:
            continue
        opts_raw = to_text(row.get("אפשרויות", ""))
        guidance_raw = to_text(row.get("הנחיה", ""))
        is_min = to_text(row.get("מינימום_נדרש", "לא")).strip() in ("כן", "yes", "true", "1")
        category_fields.setdefault(cat, []).append({
            "field": field,
            "priority": to_text(row.get("עדיפות", "medium")) or "medium",
            "question": to_text(row.get("שאלה", "")),
            "options": [o.strip() for o in opts_raw.split(",") if o.strip()],
            "guidance": guidance_raw or None,
        })
        if is_min:
            minimum_fields.setdefault(cat, [])
            if field not in minimum_fields[cat]:
                minimum_fields[cat].append(field)
    if "_default" not in category_fields:
        category_fields["_default"] = [
            {"field": "goal", "priority": "high", "question": "מה המטרה שלך?", "options": [], "guidance": None},
            {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?", "options": ["כן", "לא"], "guidance": None},
        ]
        minimum_fields["_default"] = ["goal"]
    return category_fields, minimum_fields


_ensure_default_chatbot_settings()
CHATBOT_SETTINGS = load_chatbot_settings()
TREATMENTS = load_treatments()

# ── Hardcoded extra categories not yet in the Excel ──────────
_EXTRA_TREATMENTS = [
    {"id": "manicure_1", "name": "מניקור",                               "class_name": "מניקור ופדיקור", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_2", "name": "לק גל",                                "class_name": "מניקור ופדיקור", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_3", "name": "עיצוב ופיסול ציפורן",                  "class_name": "מניקור ופדיקור", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_4", "name": "פדיקור אסתטי+ לק גל",                 "class_name": "מניקור ופדיקור", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_5", "name": "פדיקור טיפולי+ לק\\לק גל",            "class_name": "מניקור ופדיקור", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
]

# Only add if not already present (safe to restart server repeatedly)
_existing_ids = {t["id"] for t in TREATMENTS}
for _t in _EXTRA_TREATMENTS:
    if _t["id"] not in _existing_ids:
        TREATMENTS.append(_t)

TREATMENT_MAP = {t["id"]: t for t in TREATMENTS}

# ------------------------------------------------------------
# Basic routes
# ------------------------------------------------------------


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/treatments")
def list_treatments():
    return TREATMENTS


@app.get("/treatments/{treatment_id}")
def get_treatment(treatment_id: str):
    t = TREATMENT_MAP.get(treatment_id)
    if not t:
        raise HTTPException(status_code=404, detail="Treatment not found")
    return t


# ------------------------------------------------------------
# Admin – Excel knowledge-base management
# ------------------------------------------------------------
_EXCEL_FILES = {
    "treatments": "Treatments.xlsx",
    "questions": "questions.xlsx",
    "category_questions": "category_questions.xlsx",
    "chatbot_settings": "chatbot_settings.xlsx",
}


@app.get("/admin/excel/info")
def admin_excel_info(_: dict = Depends(require_admin)):
    result = []
    for file_type, filename in _EXCEL_FILES.items():
        path = EXCEL_DIR / filename
        if path.exists():
            stat = path.stat()
            try:
                df = pd.read_excel(path)
                rows = len(df)
                columns = list(df.columns)
            except Exception:
                rows, columns = 0, []
            result.append({
                "file_type": file_type,
                "filename": filename,
                "rows": rows,
                "columns": columns,
                "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size_kb": round(stat.st_size / 1024, 1),
            })
        else:
            result.append({
                "file_type": file_type,
                "filename": filename,
                "rows": 0,
                "columns": [],
                "last_modified": None,
                "size_kb": 0,
            })
    return result


@app.get("/admin/excel/preview/{file_type}")
def admin_excel_preview(file_type: str, _: dict = Depends(require_admin)):
    if file_type not in _EXCEL_FILES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    path = EXCEL_DIR / _EXCEL_FILES[file_type]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    df = pd.read_excel(path).fillna("")
    return {
        "columns": list(df.columns),
        "rows": df.head(20).to_dict(orient="records"),
        "total_rows": len(df),
    }


@app.post("/admin/excel/upload")
async def admin_excel_upload(file_type: str = Form(...), file: UploadFile = File(...), _: dict = Depends(require_admin)):
    global TREATMENTS, TREATMENT_MAP, CATEGORY_FIELDS, MINIMUM_FIELDS, CHATBOT_SETTINGS
    if file_type not in _EXCEL_FILES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    if not (file.filename or "").endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted")
    path = EXCEL_DIR / _EXCEL_FILES[file_type]
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    if file_type in ("treatments", "questions"):
        excel_treatments = load_treatments()
        _seed_treatments_to_db(excel_treatments)
        _refresh_treatments_from_db()
    elif file_type == "category_questions":
        CATEGORY_FIELDS, MINIMUM_FIELDS = load_category_fields()
    elif file_type == "chatbot_settings":
        CHATBOT_SETTINGS = load_chatbot_settings()
    df = pd.read_excel(path)
    return {"success": True, "rows": len(df), "filename": _EXCEL_FILES[file_type]}


@app.get("/admin/excel/download/{file_type}")
def admin_excel_download(file_type: str, _: dict = Depends(require_admin)):
    if file_type not in _EXCEL_FILES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    path = EXCEL_DIR / _EXCEL_FILES[file_type]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(path),
        filename=_EXCEL_FILES[file_type],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ------------------------------------------------------------
# Category field registry
# ------------------------------------------------------------
CATEGORY_FIELDS, MINIMUM_FIELDS = load_category_fields()


@app.get("/admin/chatbot/config")
def admin_chatbot_config(_: dict = Depends(require_admin)):
    """
    Returns the live chatbot configuration derived from category_questions.xlsx.
    Used by the admin panel to show which questions are asked per category,
    their priority, options, and which fields must be collected before recommending.
    """
    result = []
    for cat, fields in CATEGORY_FIELDS.items():
        if cat == "_default":
            continue
        min_fields = MINIMUM_FIELDS.get(cat, [])
        result.append({
            "category": cat,
            "total_fields": len(fields),
            "minimum_fields": min_fields,
            "can_recommend_after": len(min_fields),
            "fields": [
                {
                    "field": f["field"],
                    "priority": f["priority"],
                    "question": f["question"],
                    "options": f["options"],
                    "has_guidance": bool(f.get("guidance")),
                    "is_minimum": f["field"] in min_fields,
                }
                for f in fields
            ],
        })
    # Sort by category name for stable display
    result.sort(key=lambda x: x["category"])
    return {
        "categories": result,
        "total_categories": len(result),
        "blocked_topics": [
            {"topic": s["topic"], "keywords": s["keywords"], "active": s["active"]}
            for s in CHATBOT_SETTINGS
        ],
    }


# ------------------------------------------------------------
# Admin — Treatment CRUD
# ------------------------------------------------------------

class TreatmentUpsert(BaseModel):
    name: str
    class_name: Optional[str] = ""
    category: Optional[str] = ""
    keywords: Optional[str] = ""
    suitable_for_all_skins: Optional[str] = ""
    results_timing: Optional[str] = ""
    aftercare: Optional[str] = ""
    recommended_frequency: Optional[str] = ""
    pregnancy_breastfeeding: Optional[str] = ""
    medical_limitations: Optional[str] = ""


@app.get("/admin/treatments-db")
def list_treatments_db(_: dict = Depends(require_admin)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM treatments_db ORDER BY class_name, name"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/admin/treatments-db", status_code=201)
def create_treatment_db(data: TreatmentUpsert, _: dict = Depends(require_admin)):
    tid = f"admin_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    conn = get_db()
    conn.execute("""
        INSERT INTO treatments_db
        (id, name, class_name, category, keywords, suitable_for_all_skins,
         results_timing, aftercare, recommended_frequency,
         pregnancy_breastfeeding, medical_limitations, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')
    """, (tid, data.name, data.class_name, data.category, data.keywords,
          data.suitable_for_all_skins, data.results_timing, data.aftercare,
          data.recommended_frequency, data.pregnancy_breastfeeding, data.medical_limitations))
    conn.commit()
    conn.close()
    _refresh_treatments_from_db()
    return {"id": tid, **data.model_dump(), "source": "admin"}


@app.put("/admin/treatments-db/{treatment_id}")
def update_treatment_db(treatment_id: str, data: TreatmentUpsert, _: dict = Depends(require_admin)):
    conn = get_db()
    result = conn.execute(
        "SELECT id FROM treatments_db WHERE id = ?", (treatment_id,)
    ).fetchone()
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Treatment not found")
    conn.execute("""
        UPDATE treatments_db SET
            name=?, class_name=?, category=?, keywords=?,
            suitable_for_all_skins=?, results_timing=?, aftercare=?,
            recommended_frequency=?, pregnancy_breastfeeding=?,
            medical_limitations=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    """, (data.name, data.class_name, data.category, data.keywords,
          data.suitable_for_all_skins, data.results_timing, data.aftercare,
          data.recommended_frequency, data.pregnancy_breastfeeding,
          data.medical_limitations, treatment_id))
    conn.commit()
    conn.close()
    _refresh_treatments_from_db()
    return {"id": treatment_id, **data.model_dump()}


@app.delete("/admin/treatments-db/{treatment_id}")
def delete_treatment_db(treatment_id: str, _: dict = Depends(require_admin)):
    conn = get_db()
    conn.execute("DELETE FROM treatments_db WHERE id = ?", (treatment_id,))
    conn.commit()
    conn.close()
    _refresh_treatments_from_db()
    return {"ok": True}


# ------------------------------------------------------------
# Helper: field registry utilities
# ------------------------------------------------------------
def get_fields_for_category(category: str) -> List[Dict]:
    return CATEGORY_FIELDS.get(category, CATEGORY_FIELDS["_default"])


def get_next_field(category: str, profile: Dict) -> Optional[Dict]:
    """Return the next most important field that hasn't been collected yet."""
    fields = get_fields_for_category(category)
    for priority in ("critical", "high", "medium"):
        for f in fields:
            if f["priority"] == priority and f["field"] not in profile:
                return f
    return None


def can_recommend(category: str, profile: Dict) -> bool:
    minimums = MINIMUM_FIELDS.get(category, MINIMUM_FIELDS["_default"])
    return all(f in profile for f in minimums)


def field_chips(field_info: Dict) -> List[str]:
    chips = list(field_info["options"])
    if field_info.get("guidance"):
        chips.append("לא יודעת")
    return chips


def question_progress(category: str, field: Optional[str]) -> Dict:
    if not field:
        return {}
    fields = get_fields_for_category(category)
    question_fields = [f["field"] for f in fields]
    if field not in question_fields:
        return {}
    return {
        "question_number": question_fields.index(field) + 1,
        "total_questions": len(question_fields),
    }


# ------------------------------------------------------------
# Local chat fallback
# Keeps the chatbot usable when Groq is not configured locally.
# ------------------------------------------------------------
def detect_category_locally(message: str) -> Optional[str]:
    text = (message or "").lower()
    categories = [c for c in sorted(set(t["class_name"] for t in TREATMENTS if t["class_name"])) if c]

    for category in categories:
        if category.lower() in text:
            return category

    keyword_groups = [
        (("אקנה", "פצע", "פצעונים", "עור", "קמטים", "פיגמנט", "כתמים", "יובש", "קוסמטיקה"), "קוסמטיקה"),
        (("ציפורן", "ציפורניים", "מניקור", "פדיקור", "לק"), "מניקור ופדיקור"),
        (("שיער", "פן", "תסרוקת", "החלקה", "צבע"), "עיצוב שיער"),
        (("איפור", "גבות", "ריסים"), "איפור מקצועי"),
        (("סטיילינג", "לבוש", "מלתחה", "תדמית"), "סטיילינג אישי"),
        (("גוף", "עיסוי", "מסאז", "חיטוב"), "טיפולי גוף"),
        (("לייזר", "הסרת שיער", "שעווה"), "הסרת שיער"),
    ]
    for keywords, category in keyword_groups:
        if any(keyword in text for keyword in keywords) and category in categories:
            return category

    return None


def local_general_answer(message: str, selected: Optional[Dict] = None) -> str:
    if selected:
        return (
            f"בטח. לגבי {selected['name']}: "
            f"{selected.get('aftercare') or selected.get('suitable_for_all_skins') or 'יש לנו מידע על הטיפול הזה במערכת.'} "
            "אם תרצי, כתבי לי מה חשוב לך לדעת ואכוון אותך."
        )

    categories = sorted(set(t["class_name"] for t in TREATMENTS if t["class_name"]))
    return (
        "אני כאן כדי לעזור לבחור טיפול מתאים או לענות על שאלה כללית. "
        "אפשר לבחור קטגוריה כמו " + ", ".join(categories[:5]) + ", "
        "או לכתוב לי מה מפריע לך ומה המטרה שלך."
    )


def local_guided_conversation(profile: Dict, next_field_info: Optional[Dict]) -> Dict:
    if not next_field_info:
        return {
            "reply": "יש לי מספיק פרטים כדי להציע כיוון מתאים.",
            "profile_update": {},
            "ready_to_recommend": True,
        }
    return {
        "reply": next_field_info["question"],
        "profile_update": {},
        "ready_to_recommend": False,
    }


def local_recommendation(profile: Dict, category: str) -> Dict:
    category_treatments = [t for t in TREATMENTS if t.get("class_name") == category]
    if not category_treatments:
        category_treatments = TREATMENTS[:3]

    suggested = [
        {"id": t["id"], "name": t["name"], "category": t.get("category", "")}
        for t in category_treatments[:3]
    ]
    names = ", ".join(t["name"] for t in category_treatments[:3])
    reply = (
        "לפי הפרטים שנתת, אלו הטיפולים שהכי כדאי לבדוק: "
        f"{names}. "
        "כדאי לבחור טיפול ולקרוא את הפרטים, או לפנות לצוות כדי לוודא התאמה אישית מלאה."
    )
    return {"reply": reply, "suggested_treatments": suggested}


# ------------------------------------------------------------
# LLM helpers
# ------------------------------------------------------------

def classify_intent(message: str, history: List[Dict]) -> Dict:
    """
    Call 1 — Intent Router.
    Returns {"intent": "general"|"recommendation", "category": str|None}
    """
    if not groq_is_configured():
        category = detect_category_locally(message)
        return {
            "intent": "recommendation" if category else "general",
            "category": category,
        }

    categories = sorted(set(t["class_name"] for t in TREATMENTS if t["class_name"]))

    history_text = ""
    for msg in history[-4:]:
        role = "User" if msg.get("from") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('text', '')}\n"

    system = f"""You are a classifier for MeDay, an Israeli beauty clinic chatbot.

Classify the user's latest message as:
- "general": general question, logistics (hours/prices/location), small talk, question about a specific treatment they already know about
- "recommendation": user has a beauty/skin/hair problem to solve, wants treatment advice, mentions a concern or symptom, asks "מה מומלץ"

Available treatment categories: {', '.join(categories)}

If intent is "recommendation", also pick the single most relevant category from the list above. If unclear, set category to null.

Respond ONLY with valid JSON on one line, no explanation:
{{"intent": "general", "category": null}}"""

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Conversation:\n{history_text}Latest message: {message}"},
            ],
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=60,
        )
        result = json.loads(resp.choices[0].message.content)
        return {
            "intent": result.get("intent", "general"),
            "category": result.get("category"),
        }
    except Exception as e:
        print(f"[Intent router error] {e}")
        return {"intent": "general", "category": None}


def general_answer(message: str, history: List[Dict], selected: Optional[Dict]) -> str:
    """
    Call 2A — Pure conversation, no flow logic.
    Handles general questions and treatment-specific questions.
    """
    if not groq_is_configured():
        return local_general_answer(message, selected)

    if selected:
        faq_text = "\n".join(
            [f"ש: {q}\nת: {a}" for q, a in selected.get("faq", {}).items()]
        )
        context = (
            f"המשתמשת צופה בטיפול: {selected['name']}\n\n"
            f"פרטי הטיפול:\n"
            f"- קטגוריה: {selected['class_name']} / {selected['category']}\n"
            f"- תיאור: {selected['aftercare']}\n"
            f"- תוצאות: {selected['results_timing']}\n"
            f"- למי מתאים: {selected['suitable_for_all_skins']}\n"
            f"- למי לא מתאים: {selected['medical_limitations']}\n"
            f"- הריון והנקה: {selected['pregnancy_breastfeeding']}\n"
            f"- תדירות מומלצת: {selected['recommended_frequency']}\n"
            f"- הערות: {selected['keywords']}\n\n"
            f"שאלות ותשובות נפוצות:\n{faq_text or 'אין.'}"
        )
    else:
        categories = sorted(set(t["class_name"] for t in TREATMENTS if t["class_name"]))
        context = f"קטגוריות טיפולים בקליניקה: {', '.join(categories)}"

    system = (
        "אתה עוזרת AI של MeDay - קליניקת יופי וטיפולים קוסמטיים.\n"
        "ענה תמיד בעברית בצורה חמה, מקצועית ומזמינה.\n"
        "בסס את תשובותיך אך ורק על המידע שנמסר לך להלן. אל תמציאי מידע שאינו בהקשר.\n\n"
        + _build_blocked_topics_prompt(CHATBOT_SETTINGS)
        + context
    )

    messages = [{"role": "system", "content": system}]
    for msg in history[-8:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": message})

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[General answer error] {e}")
        return local_general_answer(message, selected)


def guided_conversation(
    message: str,
    history: List[Dict],
    profile: Dict,
    category: str,
    next_field_info: Optional[Dict],
) -> Dict:
    """
    Call 2B — Guided recommendation flow with free-text input.
    Returns {"reply", "profile_update", "ready_to_recommend", "is_general_question", "switch_category"}

    is_general_question: True when user asks something off-topic (hours, prices, etc.)
      → backend answers without advancing or resetting the flow.
    switch_category: non-null when user clearly wants a different service category
      → backend resets flow to the new category.
    ready_to_recommend: True when user explicitly asks for recommendations early,
      or when the LLM determines enough data has been collected.
    """
    if not groq_is_configured():
        return local_guided_conversation(profile, next_field_info)

    known = "\n".join([f"- {k}: {v}" for k, v in profile.items()]) or "עדיין לא נאסף מידע"
    all_categories = sorted(set(t["class_name"] for t in TREATMENTS if t["class_name"]))

    if next_field_info:
        next_instruction = (
            f"השאלה הבאה שצריך לשאול (אם עוד לא נענתה): {next_field_info['question']}\n"
            f"אפשרויות לשדה זה: {', '.join(next_field_info['options']) if next_field_info['options'] else 'תשובה חופשית'}"
        )
        ready_instruction = "קבע ready_to_recommend: false אלא אם כן הלקוחה ביקשה המלצה עכשיו."
    else:
        next_instruction = "נאסף מספיק מידע. אין צורך לשאול שאלות נוספות."
        ready_instruction = "קבע ready_to_recommend: true."

    system = f"""אתה יועצת יופי חכמה של MeDay בקטגוריה: {category}.
מנהלת שיחה אישית עם לקוחה כדי להמליץ על הטיפול הכי מתאים לה.

מידע שכבר ידוע:
{known}

{next_instruction}

כללים — חשוב מאוד:
1. ענה בעברית חמה ואישית
2. אם הלקוחה ענתה על שאלה קודמת — חלצי את הערך המדויק ל-profile_update
3. אם הלקוחה שאלה שאלה כללית על הקליניקה (שעות, מחירים, כתובת, חנייה) — ענה בקצרה ב-reply, הגדר is_general_question: true, ואל תמלאי profile_update
4. אם הלקוחה ביקשה "תמליצי לי עכשיו" / "מספיק שאלות" / "מה מתאים לי" — הגדר ready_to_recommend: true
5. אם הלקוחה רוצה לעבור לקטגוריה אחרת (למשל מציפורניים לשיער) — הגדר switch_category לשם הקטגוריה המדויק מהרשימה
6. {ready_instruction}
7. אל תמציאי מידע רפואי שאינו מוצג לך

קטגוריות שירות זמינות: {', '.join(all_categories)}

החזירי ONLY valid JSON (כל שדות חייבים להיות נוכחים):
{{"reply": "...", "profile_update": {{}}, "ready_to_recommend": false, "is_general_question": false, "switch_category": null}}"""

    messages = [{"role": "system", "content": system}]
    for msg in history[-6:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": message})

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_object"},
            max_tokens=400,
        )
        result = json.loads(resp.choices[0].message.content)
        return {
            "reply": result.get("reply", ""),
            "profile_update": result.get("profile_update", {}),
            "ready_to_recommend": bool(result.get("ready_to_recommend", False)),
            "is_general_question": bool(result.get("is_general_question", False)),
            "switch_category": result.get("switch_category") or None,
        }
    except Exception as e:
        print(f"[Guided conversation error] {e}")
        return local_guided_conversation(profile, next_field_info)


def sub_discovery(
    message: str,
    field: str,
    category: str,
    history: List[Dict],
) -> str:
    """
    Sub-discovery call — helps the client figure out an answer they don't know.
    When resolved, the reply contains [RESOLVED: value] which the backend strips.
    """
    if not groq_is_configured():
        return "אין בעיה. נסי לתאר לי במילים שלך מה את מרגישה או מה המטרה שלך, ואני אמשיך לכוון אותך."

    fields = get_fields_for_category(category)
    field_info = next((f for f in fields if f["field"] == field), None)
    guidance = field_info["guidance"] if field_info else None
    options = field_info["options"] if field_info else []

    system = (
        f"אתה יועצת יופי של MeDay המנסה לעזור ללקוחה להבין מה ה-{field} שלה.\n\n"
        + (f"הנחיה לאבחון: {guidance}\n" if guidance else "")
        + (f"האפשרויות הסופיות: {', '.join(options)}\n" if options else "")
        + "\nשאלי שאלות אבחון פשוטות, חמות ומובנות. "
        "ברגע שאת בטוחה מה התשובה, ציני בסוף התשובה: [RESOLVED: הערך]\n"
        "לדוגמה: 'מעולה! נראה שיש לך עור שמן 😊 [RESOLVED: שמן]'\n"
        "אל תכתבי [RESOLVED:] עד שאת בטוחה לגמרי."
    )

    messages = [{"role": "system", "content": system}]
    for msg in history[-6:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": message})

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Sub-discovery error] {e}")
        return f"מצטערת, יש לי תקלה. נסי לתאר את ה-{field} שלך בכמה מילים."


def build_recommendation(profile: Dict, category: str, history: List[Dict]) -> Dict:
    """
    Final recommendation call — filters treatments to category, picks best matches.
    Returns {"reply": str, "suggested_treatments": list}
    """
    if not groq_is_configured():
        return local_recommendation(profile, category)

    category_treatments = [t for t in TREATMENTS if t.get("class_name") == category]
    if not category_treatments:
        category_treatments = TREATMENTS[:10]

    treatments_text = "\n".join([
        f"- {t['name']}: {(t['suitable_for_all_skins'] or t['aftercare'])[:120]}"
        f" | מגבלות: {t['medical_limitations'][:80]}"
        f" | הריון/הנקה: {t['pregnancy_breastfeeding'][:60]}"
        for t in category_treatments
    ])

    profile_text = "\n".join([f"- {k}: {v}" for k, v in profile.items()])

    system = (
        f"אתה יועצת יופי מומחית של MeDay בקטגוריה: {category}.\n\n"
        f"פרופיל הלקוחה:\n{profile_text}\n\n"
        f"טיפולים זמינים:\n{treatments_text}\n\n"
        "המלץ על 1-3 הטיפולים הכי מתאימים.\n"
        "הסבירי בחמימות למה כל טיפול מתאים לפרופיל הספציפי הזה.\n"
        "ציין את שמות הטיפולים בדיוק כפי שהם מופיעים ברשימה.\n"
        "ענה בעברית חמה ומקצועית."
    )

    messages = [{"role": "system", "content": system}]
    for msg in history[-4:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": "על סמך כל מה שסיפרתי, מה הטיפולים המומלצים לי?"})

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
        )
        reply = resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Recommendation error] {e}")
        return local_recommendation(profile, category)

    suggested = []
    for t in category_treatments:
        if t["name"] in reply:
            suggested.append({"id": t["id"], "name": t["name"], "category": t["category"]})
    suggested = suggested[:3]

    return {"reply": reply, "suggested_treatments": suggested}


# ------------------------------------------------------------
# Chat schemas
# ------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict]] = None
    selected_treatment_id: Optional[str] = None
    # Flow state (persisted by frontend, sent each turn)
    profile: Optional[Dict] = None
    mode: Optional[str] = "idle"       # idle | questioning | sub_discovery | recommending
    category: Optional[str] = None
    current_field: Optional[str] = None
    # Chip tap signals
    chip_field: Optional[str] = None
    chip_value: Optional[str] = None   # "dont_know" or the actual answer


class ChatResponse(BaseModel):
    reply: str
    mode: str
    profile: Dict
    category: Optional[str] = None
    current_field: Optional[str] = None
    quick_replies: Optional[List[str]] = None
    question_number: Optional[int] = None
    total_questions: Optional[int] = None
    suggested_treatments: Optional[List[Dict]] = None


class SkinAnalysisRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"


# ------------------------------------------------------------
# Chat endpoint
# ------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    profile = dict(req.profile or {})
    mode = req.mode or "idle"
    category = req.category
    history = req.history or []
    current_field = req.current_field

    # ── 0. Treatment-page context (existing behavior, unchanged) ──
    selected = TREATMENT_MAP.get(req.selected_treatment_id) if req.selected_treatment_id else None
    if selected:
        reply = general_answer(req.message, history, selected)
        return ChatResponse(reply=reply, mode="idle", profile=profile)

    # ── 1. Chip tap: real answer (no LLM needed) ──────────────────
    if req.chip_value and req.chip_field and req.chip_value != "dont_know":
        profile[req.chip_field] = req.chip_value

        if can_recommend(category, profile):
            next_field = get_next_field(category, profile)
            if next_field is None:
                rec = build_recommendation(profile, category, history)
                return ChatResponse(
                    reply=rec["reply"],
                    mode="recommending",
                    profile=profile,
                    category=category,
                    suggested_treatments=rec["suggested_treatments"] or None,
                )

        next_field = get_next_field(category, profile)
        if next_field is None:
            rec = build_recommendation(profile, category, history)
            return ChatResponse(
                reply=rec["reply"],
                mode="recommending",
                profile=profile,
                category=category,
                suggested_treatments=rec["suggested_treatments"] or None,
            )

        return ChatResponse(
            reply=next_field["question"],
            mode="questioning",
            profile=profile,
            category=category,
            current_field=next_field["field"],
            quick_replies=field_chips(next_field),
            **question_progress(category, next_field["field"]),
        )

    # ── 2. Chip tap: "I don't know" → sub-discovery ───────────────
    if req.chip_value == "dont_know" and req.chip_field:
        reply = sub_discovery(req.message, req.chip_field, category, history)
        resolved = re.search(r'\[RESOLVED:\s*(.+?)\]', reply)
        clean_reply = re.sub(r'\[RESOLVED:\s*.+?\]', '', reply).strip()

        if resolved:
            profile[req.chip_field] = resolved.group(1).strip()
            next_field = get_next_field(category, profile)
            if next_field is None or can_recommend(category, profile):
                rec = build_recommendation(profile, category, history)
                return ChatResponse(
                    reply=clean_reply + "\n\n" + rec["reply"],
                    mode="recommending",
                    profile=profile,
                    category=category,
                    suggested_treatments=rec["suggested_treatments"] or None,
                )
            return ChatResponse(
                reply=clean_reply,
                mode="questioning",
                profile=profile,
                category=category,
                current_field=next_field["field"],
                quick_replies=field_chips(next_field),
                **question_progress(category, next_field["field"]),
            )

        return ChatResponse(
            reply=clean_reply,
            mode="sub_discovery",
            profile=profile,
            category=category,
            current_field=req.chip_field,
            **question_progress(category, req.chip_field),
        )

    # ── 3. Continuing sub-discovery with free text ────────────────
    if mode == "sub_discovery" and current_field:
        reply = sub_discovery(req.message, current_field, category, history)
        resolved = re.search(r'\[RESOLVED:\s*(.+?)\]', reply)
        clean_reply = re.sub(r'\[RESOLVED:\s*.+?\]', '', reply).strip()

        if resolved:
            profile[current_field] = resolved.group(1).strip()
            next_field = get_next_field(category, profile)
            if next_field is None or can_recommend(category, profile):
                rec = build_recommendation(profile, category, history)
                return ChatResponse(
                    reply=clean_reply + "\n\n" + rec["reply"],
                    mode="recommending",
                    profile=profile,
                    category=category,
                    suggested_treatments=rec["suggested_treatments"] or None,
                )
            return ChatResponse(
                reply=clean_reply,
                mode="questioning",
                profile=profile,
                category=category,
                current_field=next_field["field"],
                quick_replies=field_chips(next_field),
                **question_progress(category, next_field["field"]),
            )

        return ChatResponse(
            reply=clean_reply,
            mode="sub_discovery",
            profile=profile,
            category=category,
            current_field=current_field,
            **question_progress(category, current_field),
        )

    # ── 4. Intent classification (only when category not yet detected) ──
    if not category:
        classification = classify_intent(req.message, history)
        if classification["intent"] == "recommendation" and classification.get("category"):
            category = classification["category"]
            mode = "questioning"

    # ── 5. General answer (no recommendation intent) ──────────────
    if mode == "idle" or not category:
        reply = general_answer(req.message, history, None)
        return ChatResponse(reply=reply, mode="idle", profile=profile, category=category)

    # ── 6. Guided conversation (free text in recommendation flow) ──
    next_field = get_next_field(category, profile)
    result = guided_conversation(req.message, history, profile, category, next_field)

    # 6a. General question mid-flow — answer without changing mode or field
    if result.get("is_general_question"):
        reask_field = get_next_field(category, profile)
        return ChatResponse(
            reply=result["reply"],
            mode="questioning",
            profile=profile,
            category=category,
            current_field=current_field,
            quick_replies=field_chips(reask_field) if reask_field else None,
            **question_progress(category, current_field),
        )

    # 6b. Category pivot — user wants to switch service area
    switch_cat = result.get("switch_category")
    if switch_cat and switch_cat in CATEGORY_FIELDS:
        profile = {}
        category = switch_cat
        pivot_field = get_next_field(category, profile)
        if pivot_field:
            return ChatResponse(
                reply=result["reply"],
                mode="questioning",
                profile=profile,
                category=category,
                current_field=pivot_field["field"],
                quick_replies=field_chips(pivot_field),
                **question_progress(category, pivot_field["field"]),
            )

    profile.update(result.get("profile_update", {}))

    # Re-evaluate after profile update
    next_field = get_next_field(category, profile)

    # Allow early recommendation when user explicitly requests it and we have something
    user_wants_now = result.get("ready_to_recommend", False)
    ready = can_recommend(category, profile) or (user_wants_now and len(profile) > 0)

    if (user_wants_now or next_field is None) and ready:
        rec = build_recommendation(profile, category, history)
        rec_reply = rec["reply"]
        # Only prepend guided reply if it adds context (not if it would duplicate)
        combined = (result["reply"] + "\n\n" + rec_reply) if result["reply"] and not user_wants_now else rec_reply
        return ChatResponse(
            reply=combined,
            mode="recommending",
            profile=profile,
            category=category,
            suggested_treatments=rec["suggested_treatments"] or None,
        )

    return ChatResponse(
        reply=result["reply"],
        mode="questioning",
        profile=profile,
        category=category,
        current_field=next_field["field"] if next_field else None,
        quick_replies=field_chips(next_field) if next_field else None,
        **question_progress(category, next_field["field"] if next_field else None),
    )


@app.post("/analyze-skin")
def analyze_skin(req: SkinAnalysisRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Image data is required")

    return {
        "skin_type": "combination",
        "summary": (
            "The image was received successfully. This preliminary analysis "
            "suggests a balanced routine with hydration, gentle cleansing, "
            "and SPF. A clinic consultation is recommended for a precise plan."
        ),
        "concerns": [
            {"label": "Hydration", "severity": "mild"},
            {"label": "Texture", "severity": "moderate"},
        ],
        "recommended_treatments": [
            {
                "slug": "classic-meday",
                "name": "MeDay Classic",
                "desc": "A gentle facial for cleansing, hydration, and maintenance.",
            },
            {
                "slug": "skin-booster",
                "name": "Skin Booster",
                "desc": "A technology treatment focused on glow and skin vitality.",
            },
            {
                "slug": "clear-skin-plus",
                "name": "Clear Skin Plus",
                "desc": "A supportive option for visible texture and congestion.",
            },
        ],
    }


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


def _seed_treatments_to_db(treatments_list: List[Dict]):
    """Overwrite Excel-sourced rows in DB from the in-memory treatments list."""
    conn = get_db()
    conn.execute("DELETE FROM treatments_db WHERE source = 'excel'")
    for t in treatments_list:
        conn.execute("""
            INSERT OR REPLACE INTO treatments_db
            (id, name, class_name, category, keywords, suitable_for_all_skins,
             results_timing, aftercare, recommended_frequency,
             pregnancy_breastfeeding, medical_limitations, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'excel')
        """, (t["id"], t["name"], t["class_name"], t["category"], t["keywords"],
              t["suitable_for_all_skins"], t["results_timing"], t["aftercare"],
              t["recommended_frequency"], t["pregnancy_breastfeeding"], t["medical_limitations"]))
    conn.commit()
    conn.close()


def _faq_map_from_excel() -> Dict[str, Dict]:
    """Build name→{question: answer} map from questions.xlsx."""
    try:
        faq_df = pd.read_excel(EXCEL_DIR / "questions.xlsx")
        m: Dict[str, Dict] = {}
        for _, row in faq_df.iterrows():
            name = to_text(row.get("שם_הטיפול", "")).lower()
            q = to_text(row.get("שאלה", ""))
            a = to_text(row.get("תשובה", ""))
            if name and q and a:
                m.setdefault(name, {})[q] = a
        return m
    except Exception:
        return {}


def _refresh_treatments_from_db():
    """Reload TREATMENTS and TREATMENT_MAP from the DB (Excel rows + admin rows)."""
    global TREATMENTS, TREATMENT_MAP
    faq_map = _faq_map_from_excel()
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM treatments_db ORDER BY class_name, name"
    ).fetchall()
    conn.close()
    treatments = []
    for r in rows:
        d = dict(r)
        d["faq"] = faq_map.get(d["name"].lower(), {})
        d["ages"] = ""
        d["complementary_products"] = ""
        d["consultation_required"] = ""
        treatments.append(d)
    existing_ids = {t["id"] for t in treatments}
    for _t in _EXTRA_TREATMENTS:
        if _t["id"] not in existing_ids:
            treatments.append(_t)
    TREATMENTS = treatments
    TREATMENT_MAP = {t["id"]: t for t in TREATMENTS}


# Seed DB from Excel on first startup (only if table is empty)
def _initial_seed():
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM treatments_db WHERE source='excel'").fetchone()[0]
    conn.close()
    if count == 0:
        _seed_treatments_to_db(TREATMENTS)


_initial_seed()
_refresh_treatments_from_db()


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
    # Customer-appointment linking logic: match by normalized phone before saving.
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
    has_revenue = bool(appointment_revenue_col or treatment_revenue_col)

    for row in analytics_rows:
        appointment_date = _parse_appointment_date(row["date"])
        revenue = _safe_float(row["appointment_revenue_value"]) or _safe_float(row["treatment_revenue_value"])
        total_revenue += revenue

        if appointment_date:
            key = _month_key(appointment_date)
            if key in monthly:
                monthly[key]["count"] += 1
                monthly[key]["revenue"] += revenue

        category = (
            row["treatment_class_name"]
            or row["treatment_category"]
            or row["treatment_name"]
            or "ללא קטגוריה"
        )
        item = categories.setdefault(category, {"category": category, "count": 0, "revenue": 0.0})
        item["count"] += 1
        item["revenue"] += revenue

    monthly_trend = list(monthly.values())
    last_count = monthly_trend[-1]["count"] if monthly_trend else 0
    prev_count = monthly_trend[-2]["count"] if len(monthly_trend) >= 2 else 0
    if prev_count > 0:
        monthly_growth_pct = round(((last_count - prev_count) / prev_count) * 100, 1)
    elif last_count > 0:
        monthly_growth_pct = 100.0
    else:
        monthly_growth_pct = 0.0

    by_category = sorted(categories.values(), key=lambda item: item["count"], reverse=True)
    for item in by_category:
        item["percentage"] = round((item["count"] / total) * 100, 1) if total else 0
        item["revenue"] = round(item["revenue"], 2)

    day_names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

    return {
        "total": total,
        "today": today_count,
        "this_week": this_week_count,
        "total_revenue": round(total_revenue, 2),
        "has_revenue": has_revenue,
        "monthly_growth_pct": monthly_growth_pct,
        "monthly_trend": [
            {**item, "revenue": round(item["revenue"], 2)}
            for item in monthly_trend
        ],
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
# Recommendation engine
# ------------------------------------------------------------

def score_treatment(treatment: dict, profile: dict) -> float:
    text = " ".join(filter(None, [
        treatment.get("suitable_for_all_skins", ""),
        treatment.get("keywords", ""),
        treatment.get("aftercare", ""),
        treatment.get("results_timing", ""),
        treatment.get("category", ""),
        treatment.get("class_name", ""),
    ])).lower()

    limitations = (treatment.get("medical_limitations") or "").lower()
    pregnancy_text = (treatment.get("pregnancy_breastfeeding") or "").lower()

    score = 0.0

    goal = (profile.get("goal") or "").lower()
    if goal and goal in text:
        score += 3.0

    skin_type = (profile.get("skin_type") or "").lower()
    if skin_type and skin_type in text:
        score += 2.5

    age = (profile.get("age_range") or "").lower()
    if age and age in text:
        score += 1.0

    area = (profile.get("area") or "").lower()
    if area and area in text:
        score += 2.0

    skin_tone = (profile.get("skin_tone") or "").lower()
    if skin_tone:
        if skin_tone in limitations:
            score -= 5.0
        elif skin_tone in text:
            score += 1.5

    pregnant = profile.get("pregnant", "")
    if pregnant == "כן":
        if "הריון" in limitations or "הנקה" in limitations:
            score -= 10.0
        if pregnancy_text and "לא" in pregnancy_text:
            score -= 5.0

    return score


@app.get("/recommendations")
def get_recommendations(
    exclude_id: Optional[str] = None,
    limit: int = 4,
    current_user: Optional[dict] = Depends(get_current_user),
):
    profile = {}
    preferred_category = None

    if current_user:
        conn = get_db()
        row = conn.execute(
            "SELECT skin_profile, category FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
            (current_user["id"],),
        ).fetchone()
        conn.close()
        if row:
            profile = json.loads(row["skin_profile"] or "{}")
            preferred_category = row["category"]

    candidates = [t for t in TREATMENTS if t["id"] != exclude_id]

    if profile:
        scored = [(t, score_treatment(t, profile)) for t in candidates]
        scored.sort(key=lambda x: x[1], reverse=True)
        top = [t for t, s in scored if s > 0][:limit]
        if len(top) < limit:
            extras = [t for t, _ in scored if t not in top][: limit - len(top)]
            top = top + extras
    else:
        conn = get_db()
        rows = conn.execute(
            "SELECT treatment_id, COUNT(*) as cnt FROM appointments GROUP BY treatment_id ORDER BY cnt DESC LIMIT 20"
        ).fetchall()
        conn.close()
        popular_ids = {r["treatment_id"] for r in rows}
        popular = [t for t in candidates if t["id"] in popular_ids]
        rest = [t for t in candidates if t["id"] not in popular_ids]
        if preferred_category:
            rest = sorted(rest, key=lambda t: 0 if t.get("class_name") == preferred_category else 1)
        top = (popular + rest)[:limit]

    return [
        {
            "id": t["id"],
            "name": t["name"],
            "class_name": t.get("class_name", ""),
            "category": t.get("category", ""),
            "description": (t.get("suitable_for_all_skins") or t.get("aftercare") or "")[:100],
        }
        for t in top
    ]


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
    # Development flow: replace this print/response code with real SMS/email sending later.
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
        "message": "Use POST /auth/staff/bootstrap-admin with JSON username, password, full_name, and optional email. Opening this URL in a browser sends GET and will not create an admin.",
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
      display_name_col = "full_name"
      exclude_type = "staff"
    else:
      row = conn.execute("SELECT * FROM customer_users WHERE id = ? AND active = 1", (current_user["id"],)).fetchone()
      table = "customer_users"
      display_name_col = "full_name"
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
    # Customer appointments are loaded by saved customer link first, with normalized phone fallback for old rows.
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
    return {
        "ok": True,
        "users": [staff_user_response(row) for row in rows],
    }


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
    return {
        "ok": True,
        "message": "Secretary user created successfully",
        "user": staff_user_response(row),
    }


@app.put("/admin/secretaries/{secretary_id}")
def update_secretary(secretary_id: int, body: StaffUserUpdate, current_user: dict = Depends(require_admin)):
    if body.role is not None and normalize_role(body.role) != "secretary":
        raise HTTPException(status_code=403, detail="Admins can only update secretary users from this endpoint")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM staff_users WHERE id = ? AND role = 'secretary'",
        (secretary_id,),
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
        "SELECT * FROM staff_users WHERE id = ? AND role = 'secretary'",
        (staff_user_id,),
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
    return {
        "ok": True,
        "message": "Secretary user updated successfully",
        "user": staff_user_response(updated),
    }


@app.delete("/admin/secretaries/{secretary_id}")
def delete_secretary(secretary_id: int, current_user: dict = Depends(require_admin)):
    conn = get_db()
    row = conn.execute(
        "SELECT id, username FROM staff_users WHERE id = ? AND role = 'secretary'",
        (secretary_id,),
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
        "SELECT id, username FROM staff_users WHERE id = ? AND role = 'secretary'",
        (staff_user_id,),
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


# ------------------------------------------------------------
# Chat session endpoints
# ------------------------------------------------------------

class SaveSessionRequest(BaseModel):
    messages: List[Dict]
    skin_profile: Optional[Dict] = None
    category: Optional[str] = None


@app.post("/chat-sessions")
def save_chat_session(
    body: SaveSessionRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO chat_sessions (user_id, messages, skin_profile, category) VALUES (?, ?, ?, ?)",
        (
            current_user["id"],
            json.dumps(body.messages, ensure_ascii=False),
            json.dumps(body.skin_profile or {}, ensure_ascii=False),
            body.category,
        ),
    )
    conn.commit()
    session_id = cursor.lastrowid
    conn.close()
    return {"id": session_id}


@app.get("/chat-sessions")
def get_chat_sessions(current_user: Optional[dict] = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        (current_user["id"],),
    ).fetchall()
    conn.close()

    sessions = []
    for row in rows:
        s = dict(row)
        s["messages"] = json.loads(s["messages"])
        s["skin_profile"] = json.loads(s.get("skin_profile") or "{}")
        sessions.append(s)
    return sessions


if __name__ == "__main__":
    import uvicorn

    reload_enabled = os.getenv("UVICORN_RELOAD", "").lower() in {"1", "true", "yes", "on"}
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=reload_enabled)
