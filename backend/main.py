from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from typing import Optional, List, Dict
from pydantic import BaseModel
from groq import Groq
import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ------------------------------------------------------------
# App setup
# ------------------------------------------------------------
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
groq = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

# ------------------------------------------------------------
# Load Excel data once on startup
# ------------------------------------------------------------
EXCEL_DIR = Path(__file__).parent


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
    sources: Optional[List[Dict]] = None


# ------------------------------------------------------------
# Prompt builder
# ------------------------------------------------------------
def build_prompt(
    message: str,
    selected: Optional[Dict],
    ctx: ChatContext,
    history: List[Dict],
) -> str:
    system = (
        "אתה עוזרת AI של MeDay - קליניקת יופי וטיפולים קוסמטיים.\n"
        "תפקידך לעזור ללקוחות לבחור טיפולים מתאימים ולענות על שאלות לגבי הטיפולים.\n"
        "ענה תמיד בעברית בצורה חמה, מקצועית ומזמינה.\n"
        "בסס את תשובותיך אך ורק על המידע שנמסר לך - אל תמציא מידע שאינו ברשימה.\n"
    )

    if selected:
        faq_text = "\n".join(
            [f"ש: {q}\nת: {a}" for q, a in selected.get("faq", {}).items()]
        )
        knowledge = (
            f"\nהמשתמשת צופה כרגע בטיפול: {selected['name']}\n\n"
            f"פרטי הטיפול:\n"
            f"- קטגוריה: {selected['class_name']} / {selected['category']}\n"
            f"- תיאור: {selected['aftercare']}\n"
            f"- תוצאות: {selected['results_timing']}\n"
            f"- למי מתאים: {selected['suitable_for_all_skins']}\n"
            f"- למי לא מתאים: {selected['medical_limitations']}\n"
            f"- הריון והנקה: {selected['pregnancy_breastfeeding']}\n"
            f"- תדירות מומלצת: {selected['recommended_frequency']}\n"
            f"- הערות: {selected['keywords']}\n\n"
            f"שאלות ותשובות נפוצות:\n{faq_text or 'אין שאלות נפוצות.'}\n\n"
            "ענה על שאלות המשתמשת לגבי טיפול זה בהתבסס על המידע הנ\"ל.\n"
        )
    else:
        ctx_notes = []
        if ctx.pregnant:
            ctx_notes.append("המשתמשת בהריון/מניקה - המלץ רק טיפולים מתאימים")
        if ctx.sensitive:
            ctx_notes.append("לעור רגיש")
        if ctx.goal:
            ctx_notes.append(f"מטרה: {ctx.goal}")

        ctx_line = " | ".join(ctx_notes) if ctx_notes else ""

        treatments_list = "\n".join([
            f"- {t['name']} ({t['category']}): "
            f"{(t['suitable_for_all_skins'] or t['aftercare'])[:100]}"
            for t in TREATMENTS
        ])

        knowledge = (
            f"\n{f'הקשר: {ctx_line}' if ctx_line else ''}\n\n"
            f"טיפולים זמינים בקליניקה:\n{treatments_list}\n\n"
            "עזרי למשתמשת לבחור טיפול מתאים. "
            "כשתמליצי על טיפולים, ציין את שמות הטיפולים בדיוק כפי שהם מופיעים ברשימה.\n"
        )

    # Conversation history (last 8 messages)
    history_text = ""
    for msg in history[-8:]:
        role = "משתמשת" if msg.get("from") == "user" else "עוזרת"
        history_text += f"{role}: {msg.get('text', '')}\n"

    return f"{system}{knowledge}\nשיחה:\n{history_text}משתמשת: {message}\nעוזרת:"


# ------------------------------------------------------------
# Chat endpoint
# ------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
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
    conn.commit()
    conn.close()


init_db()


class AppointmentCreate(BaseModel):
    client_name: str
    client_phone: Optional[str] = None
    treatment_id: str
    treatment_name: str
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
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO appointments
           (client_name, client_phone, treatment_id, treatment_name, date, time, end_time, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (appt.client_name, appt.client_phone, appt.treatment_id,
         appt.treatment_name, appt.date, appt.time, appt.end_time, appt.notes),
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
