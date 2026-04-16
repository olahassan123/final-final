from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List, Dict, Optional
from groq import Groq
from dotenv import load_dotenv
from io import BytesIO
from datetime import datetime, timedelta
import os
import pandas as pd
from zoneinfo import ZoneInfo

from db import SessionLocal, engine, Base
from models import Treatment, FAQ

load_dotenv()


import pandas as pd
from typing import Optional, List, Dict
from pydantic import BaseModel
from groq import Groq
import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
from pathlib import Path
import pandas as pd

EXCEL_DIR = Path(__file__).parent
BUSINESS_TZ = ZoneInfo("Asia/Jerusalem")
MAX_ADVANCE_BOOKING_DAYS = 365

def load_treatments():
    treatments_df = pd.read_excel(EXCEL_DIR / "Treatments.xlsx")


def parse_appointment_datetime(date_str: str, time_str: str) -> datetime:
    try:
        parsed = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid appointment date or time") from exc
    return parsed.replace(tzinfo=BUSINESS_TZ)


def validate_appointment_slot(date_str: str, start_time: str, end_time: Optional[str] = None) -> None:
    start_dt = parse_appointment_datetime(date_str, start_time)
    now = datetime.now(BUSINESS_TZ).replace(second=0, microsecond=0)
    max_booking_date = (now + timedelta(days=MAX_ADVANCE_BOOKING_DAYS)).date()

    if start_dt <= now:
        raise HTTPException(status_code=400, detail="Cannot book a past appointment slot")

    if start_dt.date() > max_booking_date:
        raise HTTPException(status_code=400, detail="Appointment date is too far in the future")

    if end_time:
        end_dt = parse_appointment_datetime(date_str, end_time)
        if end_dt <= start_dt:
            raise HTTPException(status_code=400, detail="Appointment end time must be after start time")
# ------------------------------------------------------------
# App setup
# -----------------------------------------------------------
#  origin/ola-from-safa
app = FastAPI(title="MeDay Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# Groq setup
# ------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
groq = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY was not loaded")

# ------------------------------------------------------------
# Load Excel data once on startup
# ------------------------------------------------------------


def to_text(x):
    if x is None:
        return ""
    s = str(x).strip()
    return "" if s.lower() == "nan" else s


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


TREATMENTS = load_treatments()

# ── Hardcoded extra categories not yet in the Excel ──────────
_EXTRA_TREATMENTS = [
    {"id": "manicure_1", "name": "מניקור",                               "class_name": "מניקור ופדיקור", "category": "מניקור", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_2", "name": "לק ג’ל",                               "class_name": "מניקור ופדיקור", "category": "מניקור", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_3", "name": "עיצוב ופיסול ציפורן",                  "class_name": "מניקור ופדיקור", "category": "מניקור", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_4", "name": "פדיקור אסתטי + מריחת לק",              "class_name": "מניקור ופדיקור", "category": "פדיקור", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_5", "name": "פדיקור אסתטי + לק ג'ל",                "class_name": "מניקור ופדיקור", "category": "פדיקור", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_6", "name": "פדיקור טיפולי + לק/לק ג'ל",            "class_name": "מניקור ופדיקור", "category": "פדיקור", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_1",     "name": "עיסוי שוודי",                           "class_name": "טיפולי גוף",     "category": "עיסוי גוף",    "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_2",     "name": "עיסוי באבנים חמות",                    "class_name": "טיפולי גוף",     "category": "עיסוי גוף",    "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_3",     "name": "שיאצו",                                 "class_name": "טיפולי גוף",     "category": "עיסוי גוף",    "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_4",     "name": "עיסוי תאילנדי",                         "class_name": "טיפולי גוף",     "category": "עיסוי גוף",    "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_5",     "name": "עיסוי רקמות עמוק",                      "class_name": "טיפולי גוף",     "category": "עיסוי גוף",    "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_6",     "name": "עיסוי קצוות",                           "class_name": "טיפולי גוף",     "category": "עיסוי גוף",    "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_7",     "name": "עיסוי כתפיים, גב וצוואר",               "class_name": "טיפולי גוף",     "category": "עיסוי ממוקד",  "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_8",     "name": "עיסוי פנים וקרקפת",                     "class_name": "טיפולי גוף",     "category": "עיסוי ממוקד",  "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_9",     "name": "עיסוי כפות רגליים",                     "class_name": "טיפולי גוף",     "category": "עיסוי ממוקד",  "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_10",    "name": "עיסוי ספורטאים",                        "class_name": "טיפולי גוף",     "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_11",    "name": "עיסוי לנשים בהריון",                    "class_name": "טיפולי גוף",     "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_12",    "name": "עיסוי משולב",                           "class_name": "טיפולי גוף",     "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_13",    "name": "רפלקסולוגיה",                           "class_name": "טיפולי גוף",     "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_1",      "name": "גבות שיטת השערה",                       "class_name": "איפור קבוע ועיצוב גבות", "category": "גבות",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_2",      "name": "גבות שיטת הפודרה",                      "class_name": "איפור קבוע ועיצוב גבות", "category": "גבות",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_3",      "name": "גבות שיטה משולבת",                      "class_name": "איפור קבוע ועיצוב גבות", "category": "גבות",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_4",      "name": "הדגשת קו ריסים תחתון",                  "class_name": "איפור קבוע ועיצוב גבות", "category": "תיחום עיניים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_5",      "name": "הדגשת קו ריסים עליון",                  "class_name": "איפור קבוע ועיצוב גבות", "category": "תיחום עיניים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_6",      "name": "אייליינר עליון",                        "class_name": "איפור קבוע ועיצוב גבות", "category": "תיחום עיניים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_7",      "name": "תיחום שפתיים בקו טבעי",                 "class_name": "איפור קבוע ועיצוב גבות", "category": "שפתיים",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_8",      "name": "מילוי שפתיים + תיחום",                  "class_name": "איפור קבוע ועיצוב גבות", "category": "שפתיים",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_9",      "name": "מילוי קרקפת אישה",                      "class_name": "איפור קבוע ועיצוב גבות", "category": "ראש",         "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_10",     "name": "מילוי קרקפת גבר",                       "class_name": "איפור קבוע ועיצוב גבות", "category": "ראש",         "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_11",     "name": "נקודת חן",                              "class_name": "איפור קבוע ועיצוב גבות", "category": "ראש",         "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "styling_1",  "name": "מפגש תדמית 2.5 שעות",                  "class_name": "סטיילינג אישי",  "category": "",            "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "styling_2",  "name": "מפגש תדמית 4 שעות",                    "class_name": "סטיילינג אישי",  "category": "",            "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
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
    return {
        "ok": True,
        "services": {
            "chat": {
                "configured": bool(GROQ_API_KEY),
                "provider": "groq",
            }
        },
    }


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
# Chat schemas
# ------------------------------------------------------------
class ChatContext(BaseModel):
    goal: Optional[str] = None
    sensitive: Optional[bool] = None
    pregnant: Optional[bool] = None


class ChatRequest(BaseModel):
    message: str
    context: Optional[ChatContext] = None
    selected_treatment_id: Optional[str] = None
    history: Optional[List[Dict]] = None


class ChatResponse(BaseModel):
    reply: str
    follow_up: Optional[Dict] = None
    suggested_treatments: Optional[List[Dict]] = None

def _norm(s: str) -> str:
    return (s or "").strip().lower()

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    msg = _norm(req.message)
    ctx = req.context or ChatContext()
    selected = TREATMENT_MAP.get(req.selected_treatment_id) if req.selected_treatment_id else None

    prompt = build_prompt(req.message, selected, ctx, req.history or [])

    try:
        response = groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
        )
        reply = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"GROQ ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")

    # Detect any treatment names mentioned in the reply → suggestion buttons
    suggested = []
    if not selected:
        for t in TREATMENTS:
            if t["name"] in reply:
                suggested.append({"id": t["id"], "name": t["name"], "category": t["category"]})
        suggested = suggested[:3]

    return ChatResponse(
        reply=reply,
        suggested_treatments=suggested if suggested else None,
    )


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
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            client_phone TEXT,
            treatment_id TEXT NOT NULL,
            treatment_name TEXT NOT NULL,
            treatment_category TEXT,
            treatment_subcategory TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            end_time TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Add end_time column if it doesn't exist (migration for existing DB)
    try:
        conn.execute("ALTER TABLE appointments ADD COLUMN end_time TEXT")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE appointments ADD COLUMN treatment_category TEXT")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE appointments ADD COLUMN treatment_subcategory TEXT")
    except Exception:
        pass
    conn.commit()
    conn.close()


init_db()


class AppointmentCreate(BaseModel):
    client_name: str
    client_phone: Optional[str] = None
    treatment_id: str
    treatment_name: str
    treatment_category: Optional[str] = None
    treatment_subcategory: Optional[str] = None
    date: str
    time: str
    end_time: Optional[str] = None
    notes: Optional[str] = None


@app.get("/appointments")
def list_appointments():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM appointments ORDER BY date, time"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/appointments")
def create_appointment(appt: AppointmentCreate):
    validate_appointment_slot(appt.date, appt.time, appt.end_time)
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO appointments
           (client_name, client_phone, treatment_id, treatment_name, treatment_category, treatment_subcategory, date, time, end_time, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (appt.client_name, appt.client_phone, appt.treatment_id,
         appt.treatment_name, appt.treatment_category, appt.treatment_subcategory, appt.date, appt.time, appt.end_time, appt.notes),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, **appt.model_dump()}


@app.delete("/appointments/{appt_id}")
def delete_appointment(appt_id: int):
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
def reschedule_appointment(appt_id: int, data: AppointmentReschedule):
    validate_appointment_slot(data.date, data.time, data.end_time)
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


@app.get("/appointments/analytics")
def get_analytics():
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
        GROUP BY day_num
        ORDER BY day_num
    """).fetchall()

    by_hour = conn.execute("""
        SELECT substr(time, 1, 2) as hour, COUNT(*) as count
        FROM appointments
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
        "by_day": [{"day": day_names[int(r["day_num"])], "count": r["count"]} for r in by_day],
        "by_hour": [{"hour": f"{r['hour']}:00", "count": r["count"]} for r in by_hour],
        "recent": [dict(r) for r in recent],
    }
