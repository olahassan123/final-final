from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from groq import Groq
from dotenv import load_dotenv
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import os
import pandas as pd
import sqlite3
import json
import re
from pathlib import Path

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
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY was not loaded")

# ------------------------------------------------------------
# Constants
# ------------------------------------------------------------
EXCEL_DIR = Path(__file__).parent
BUSINESS_TZ = ZoneInfo("Asia/Jerusalem")
MAX_ADVANCE_BOOKING_DAYS = 365

# ------------------------------------------------------------
# Appointment slot validation (from partner branch)
# ------------------------------------------------------------

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

# ── Extra treatments (hardcoded until Excel is complete) ──────
_EXTRA_TREATMENTS = [
    # מניקור ופדיקור
    {"id": "manicure_1", "name": "מניקור",                               "class_name": "מניקור ופדיקור", "category": "מניקור",           "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_2", "name": "לק ג'ל",                               "class_name": "מניקור ופדיקור", "category": "מניקור",           "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_3", "name": "עיצוב ופיסול ציפורן",                  "class_name": "מניקור ופדיקור", "category": "מניקור",           "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_4", "name": "פדיקור אסתטי + מריחת לק",              "class_name": "מניקור ופדיקור", "category": "פדיקור",           "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_5", "name": "פדיקור אסתטי + לק ג'ל",                "class_name": "מניקור ופדיקור", "category": "פדיקור",           "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "manicure_6", "name": "פדיקור טיפולי + לק/לק ג'ל",            "class_name": "מניקור ופדיקור", "category": "פדיקור",           "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    # טיפולי גוף
    {"id": "body_1",  "name": "עיסוי שוודי",              "class_name": "טיפולי גוף", "category": "עיסוי גוף",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_2",  "name": "עיסוי באבנים חמות",         "class_name": "טיפולי גוף", "category": "עיסוי גוף",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_3",  "name": "שיאצו",                    "class_name": "טיפולי גוף", "category": "עיסוי גוף",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_4",  "name": "עיסוי תאילנדי",             "class_name": "טיפולי גוף", "category": "עיסוי גוף",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_5",  "name": "עיסוי רקמות עמוק",          "class_name": "טיפולי גוף", "category": "עיסוי גוף",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_6",  "name": "עיסוי קצוות",               "class_name": "טיפולי גוף", "category": "עיסוי גוף",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_7",  "name": "עיסוי כתפיים, גב וצוואר",   "class_name": "טיפולי גוף", "category": "עיסוי ממוקד",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_8",  "name": "עיסוי פנים וקרקפת",          "class_name": "טיפולי גוף", "category": "עיסוי ממוקד",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_9",  "name": "עיסוי כפות רגליים",          "class_name": "טיפולי גוף", "category": "עיסוי ממוקד",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_10", "name": "עיסוי ספורטאים",             "class_name": "טיפולי גוף", "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_11", "name": "עיסוי לנשים בהריון",         "class_name": "טיפולי גוף", "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "מתאים", "medical_limitations": "", "faq": {}},
    {"id": "body_12", "name": "עיסוי משולב",                "class_name": "טיפולי גוף", "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "body_13", "name": "רפלקסולוגיה",                "class_name": "טיפולי גוף", "category": "עיסויים מיוחדים", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    # איפור קבוע ועיצוב גבות
    {"id": "pmu_1",  "name": "גבות שיטת השערה",            "class_name": "איפור קבוע ועיצוב גבות", "category": "גבות",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_2",  "name": "גבות שיטת הפודרה",           "class_name": "איפור קבוע ועיצוב גבות", "category": "גבות",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_3",  "name": "גבות שיטה משולבת",           "class_name": "איפור קבוע ועיצוב גבות", "category": "גבות",        "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_4",  "name": "הדגשת קו ריסים תחתון",       "class_name": "איפור קבוע ועיצוב גבות", "category": "תיחום עיניים","keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_5",  "name": "הדגשת קו ריסים עליון",       "class_name": "איפור קבוע ועיצוב גבות", "category": "תיחום עיניים","keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_6",  "name": "אייליינר עליון",              "class_name": "איפור קבוע ועיצוב גבות", "category": "תיחום עיניים","keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_7",  "name": "תיחום שפתיים בקו טבעי",      "class_name": "איפור קבוע ועיצוב גבות", "category": "שפתיים",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_8",  "name": "מילוי שפתיים + תיחום",       "class_name": "איפור קבוע ועיצוב גבות", "category": "שפתיים",      "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_9",  "name": "מילוי קרקפת אישה",           "class_name": "איפור קבוע ועיצוב גבות", "category": "ראש",         "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_10", "name": "מילוי קרקפת גבר",            "class_name": "איפור קבוע ועיצוב גבות", "category": "ראש",         "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "pmu_11", "name": "נקודת חן",                   "class_name": "איפור קבוע ועיצוב גבות", "category": "ראש",         "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    # סטיילינג אישי
    {"id": "styling_1", "name": "מפגש תדמית 2.5 שעות", "class_name": "סטיילינג אישי", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
    {"id": "styling_2", "name": "מפגש תדמית 4 שעות",   "class_name": "סטיילינג אישי", "category": "", "keywords": "", "suitable_for_all_skins": "", "ages": "", "results_timing": "", "complementary_products": "", "aftercare": "", "consultation_required": "", "recommended_frequency": "", "pregnancy_breastfeeding": "", "medical_limitations": "", "faq": {}},
]

_existing_ids = {t["id"] for t in TREATMENTS}
for _t in _EXTRA_TREATMENTS:
    if _t["id"] not in _existing_ids:
        TREATMENTS.append(_t)

TREATMENT_MAP = {t["id"]: t for t in TREATMENTS}

# ------------------------------------------------------------
# Category field registry
# Each key matches class_name (for hardcoded) or sub-category (for Excel treatments)
# All actual treatments from Excel live under class_name "קוסמטיקה"
# Sub-categories: טיפולי פנים, טיפולים מעצבים, אקנה ושיקום עור, אנטי אייג'ינג, ניקוי והבהרה
# Hardcoded categories: מניקור ופדיקור, טיפולי גוף, איפור קבוע ועיצוב גבות, סטיילינג אישי
# ------------------------------------------------------------
CATEGORY_FIELDS: Dict[str, List[Dict]] = {

    # ── קוסמטיקה — sub-categories from Excel ─────────────────
    # General cosmetics entry point (when category=קוסמטיקה before sub-cat is known)
    "קוסמטיקה": [
        {"field": "sub_category", "priority": "high", "question": "מה תחום הטיפול שמעניין אותך?",
         "options": ["טיפולי פנים", "טיפולים מעצבים", "אקנה ושיקום עור", "אנטי אייג'ינג", "ניקוי והבהרה"],
         "guidance": "שאלי על המטרה הכללית שלה — האם מחפשת ריענון, טיפול בבעיה ספציפית, שיקום עור, או הרמה ועיצוב"},
        {"field": "skin_type", "priority": "high", "question": "מה סוג העור שלך?",
         "options": ["שמן", "יבש", "מעורב", "רגיש", "נורמלי"],
         "guidance": "שאלי על תחושת העור אחרי שטיפת פנים, האם יש ברק אחרי שעה, נטייה לקשקשים או אודם"},
        {"field": "age_range", "priority": "medium", "question": "מה טווח הגיל שלך?",
         "options": ["עד 25", "25-40", "40+"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה כרגע?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # טיפולי פנים — general / maintenance facials
    "טיפולי פנים": [
        {"field": "skin_type", "priority": "high", "question": "מה סוג העור שלך?",
         "options": ["שמן", "יבש", "מעורב", "רגיש", "נורמלי"],
         "guidance": "שאלי על תחושת העור אחרי שטיפת פנים, האם יש ברק אחרי שעה, נטייה לקשקשים או אודם"},
        {"field": "age_range", "priority": "medium", "question": "מה טווח הגיל שלך?",
         "options": ["עד 25", "25-40", "40+"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה כרגע?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # טיפולים מעצבים — sculpting / lifting treatments
    "טיפולים מעצבים": [
        {"field": "concern", "priority": "high", "question": "מה הדבר שהכי מפריע לך כרגע?",
         "options": ["עור רפוי", "חוסר מתיחות", "עייפות בפנים", "קמטים", "אובדן נפח"],
         "guidance": None},
        {"field": "age_range", "priority": "high", "question": "מה טווח הגיל שלך?",
         "options": ["עד 30", "30-45", "45+"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # אקנה ושיקום עור
    "אקנה ושיקום עור": [
        {"field": "acne_severity", "priority": "high", "question": "כמה חמורה הבעיה?",
         "options": ["קלה — כמה פצעונים", "בינונית — פרצוף מלא", "חמורה — דלקתי"],
         "guidance": "שאלי כמה זמן קיימת הבעיה, אם היה טיפול קודם, ואם יש צלקות"},
        {"field": "skin_type", "priority": "high", "question": "מה סוג העור שלך?",
         "options": ["שמן", "מעורב", "רגיש"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # אנטי אייג'ינג
    "אנטי אייג'ינג": [
        {"field": "main_concern", "priority": "high", "question": "מה הדאגה העיקרית שלך?",
         "options": ["קמטים עדינים", "קמטים עמוקים", "עור רפוי", "כתמי גיל", "חוסר זוהר"],
         "guidance": None},
        {"field": "age_range", "priority": "high", "question": "מה טווח הגיל שלך?",
         "options": ["35-45", "45-55", "55+"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ניקוי והבהרה
    "ניקוי והבהרה": [
        {"field": "skin_issue", "priority": "high", "question": "מה הבעיה העיקרית שתרצי לטפל בה?",
         "options": ["נקבוביות פתוחות", "עור עמום", "כתמים / פיגמנטציה", "עור לא אחיד", "ניקוי כללי"],
         "guidance": None},
        {"field": "skin_type", "priority": "high", "question": "מה סוג העור שלך?",
         "options": ["שמן", "יבש", "מעורב", "רגיש", "נורמלי"],
         "guidance": "שאלי על תחושת העור אחרי שטיפה, ברק, נטייה לקשקשים"},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ── מניקור ופדיקור ────────────────────────────────────────
    "מניקור ופדיקור": [
        {"field": "nail_service", "priority": "high", "question": "מה את מחפשת?",
         "options": ["מניקור רגיל", "לק ג'ל", "עיצוב ופיסול ציפורן", "פדיקור אסתטי", "פדיקור טיפולי"],
         "guidance": None},
    ],

    # ── טיפולי גוף ───────────────────────────────────────────
    "טיפולי גוף": [
        {"field": "massage_goal", "priority": "high", "question": "מה מטרת העיסוי?",
         "options": ["הרפיה וסטרס", "כאבי גב / צוואר / כתפיים", "ספורט ושיקום", "מהלך הריון", "רפלקסולוגיה"],
         "guidance": "שאלי אם יש כאב ספציפי, מה רמת הפעילות הגופנית שלה, האם יש הריון"},
        {"field": "intensity", "priority": "medium", "question": "עיסוי עדין או עמוק?",
         "options": ["עדין ומרגיע", "עמוק ואינטנסיבי", "בינוני"],
         "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון כרגע?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ── איפור קבוע ועיצוב גבות ───────────────────────────────
    "איפור קבוע ועיצוב גבות": [
        {"field": "pmu_area", "priority": "high", "question": "באיזה אזור מעוניינת?",
         "options": ["גבות", "עיניים / אייליינר", "שפתיים", "קרקפת"],
         "guidance": None},
        {"field": "pmu_style", "priority": "high", "question": "איזה סגנון מעניין אותך?",
         "options": ["טבעי ועדין", "מודגש ומובהק", "לא בטוחה — עזרי לי לבחור"],
         "guidance": "שאלי על הסגנון האישי שלה, אם היא מאפרת את עצמה בדרך כלל ואיך"},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ── סטיילינג אישי ────────────────────────────────────────
    "סטיילינג אישי": [
        {"field": "styling_goal", "priority": "high", "question": "מה המטרה של מפגש הסטיילינג?",
         "options": ["חידוש המראה הכללי", "לקראת אירוע / עסקי", "קניות וארגון ארון", "שינוי מוחלט"],
         "guidance": None},
        {"field": "session_length", "priority": "medium", "question": "כמה זמן יש לך?",
         "options": ["2.5 שעות", "4 שעות"], "guidance": None},
    ],

    # ── טיפולי קוסמטיקה (alias for קוסמטיקה — frontend category name) ──
    "טיפולי קוסמטיקה": [
        {"field": "sub_category", "priority": "high", "question": "מה תחום הטיפול שמעניין אותך?",
         "options": ["טיפולי פנים", "טיפולים מעצבים", "אקנה ושיקום עור", "אנטי אייג'ינג", "ניקוי והבהרה"],
         "guidance": "שאלי על המטרה הכללית שלה — האם מחפשת ריענון, טיפול בבעיה ספציפית, שיקום עור, או הרמה ועיצוב"},
        {"field": "skin_type", "priority": "high", "question": "מה סוג העור שלך?",
         "options": ["שמן", "יבש", "מעורב", "רגיש", "נורמלי"],
         "guidance": "שאלי על תחושת העור אחרי שטיפת פנים, האם יש ברק אחרי שעה, נטייה לקשקשים או אודם"},
        {"field": "age_range", "priority": "medium", "question": "מה טווח הגיל שלך?",
         "options": ["עד 25", "25-40", "40+"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה כרגע?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ── עיצוב שיער ───────────────────────────────────────────
    "עיצוב שיער": [
        {"field": "hair_service", "priority": "high", "question": "מה את מחפשת?",
         "options": ["תספורת / עיצוב", "צביעה", "טיפול משקם", "החלקה / קרטין", "תסרוקת לאירוע"],
         "guidance": "שאלי על מטרת הביקור — שינוי מראה, תחזוקה, טיפול בנזק, או הכנה לאירוע"},
        {"field": "hair_length", "priority": "medium", "question": "מה אורך השיער שלך?",
         "options": ["קצר", "בינוני", "ארוך"], "guidance": None},
    ],

    # ── הסרת שיער ────────────────────────────────────────────
    "הסרת שיער": [
        {"field": "removal_area", "priority": "high", "question": "באיזה אזור מעוניינת בהסרת שיער?",
         "options": ["פנים", "בית שחי", "רגליים", "ביקיני", "גוף מלא"],
         "guidance": "שאלי אם יש שיער בהיר / כהה ומה גוון העור, כי זה משפיע על סוג הלייזר המתאים"},
        {"field": "skin_tone", "priority": "high", "question": "מה גוון העור שלך?",
         "options": ["בהיר מאוד", "בהיר", "בינוני", "כהה"],
         "guidance": "גוון עור כהה עם שיער בהיר דורש טכנולוגיה ספציפית — חשוב לדעת"},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ── איפור מקצועי ─────────────────────────────────────────
    "איפור מקצועי": [
        {"field": "occasion", "priority": "high", "question": "לאיזה אירוע את מעוניינת באיפור?",
         "options": ["חתונה / כלה", "ערב / גאלה", "צילומים", "יומיומי / עסקי", "ספיישל אחר"],
         "guidance": None},
        {"field": "makeup_style", "priority": "high", "question": "איזה סגנון איפור מעניין אותך?",
         "options": ["טבעי ועדין", "גלאם ומודגש", "ערבי / ספרדי", "לא בטוחה — עזרי לי לבחור"],
         "guidance": "שאלי על הסגנון האישי שלה — האם היא מאפרת בעצמה, ומה הסגנון הרגיל שלה"},
    ],

    # ── טיפולי אסתטיקה ───────────────────────────────────────
    "טיפולי אסתטיקה": [
        {"field": "aesthetic_concern", "priority": "high", "question": "מה הדאגה המרכזית שאת רוצה לטפל בה?",
         "options": ["קמטים", "כתמים / פיגמנטציה", "צלקות אקנה", "הידוק עור", "זוהר ורענון"],
         "guidance": "שאלי כמה זמן הבעיה קיימת ואם עברה טיפולים קודמים"},
        {"field": "skin_type", "priority": "high", "question": "מה סוג העור שלך?",
         "options": ["שמן", "יבש", "מעורב", "רגיש", "נורמלי"],
         "guidance": "שאלי על תחושת העור אחרי שטיפה, ברק, נטייה לקשקשים"},
        {"field": "age_range", "priority": "medium", "question": "מה טווח הגיל שלך?",
         "options": ["עד 30", "30-45", "45+"], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],

    # ── fallback ──────────────────────────────────────────────
    "_default": [
        {"field": "goal",     "priority": "high",     "question": "מה המטרה שלך?",
         "options": [], "guidance": None},
        {"field": "pregnant", "priority": "critical", "question": "את בהריון או מניקה?",
         "options": ["כן", "לא"], "guidance": None},
    ],
}

MINIMUM_FIELDS: Dict[str, List[str]] = {
    "קוסמטיקה":                ["sub_category", "skin_type", "pregnant"],
    "טיפולי קוסמטיקה":         ["sub_category", "skin_type", "pregnant"],
    "טיפולי פנים":             ["skin_type", "pregnant"],
    "טיפולים מעצבים":          ["concern", "pregnant"],
    "אקנה ושיקום עור":         ["acne_severity", "pregnant"],
    "אנטי אייג'ינג":           ["main_concern", "pregnant"],
    "ניקוי והבהרה":            ["skin_issue", "pregnant"],
    "מניקור ופדיקור":          ["nail_service"],
    "טיפולי גוף":              ["massage_goal", "pregnant"],
    "איפור קבוע ועיצוב גבות":  ["pmu_area", "pregnant"],
    "סטיילינג אישי":           ["styling_goal"],
    "עיצוב שיער":              ["hair_service"],
    "הסרת שיער":               ["removal_area", "pregnant"],
    "איפור מקצועי":            ["occasion"],
    "טיפולי אסתטיקה":          ["aesthetic_concern", "pregnant"],
    "_default":                ["goal"],
}


# ------------------------------------------------------------
# Helper: field registry utilities
# ------------------------------------------------------------
def get_fields_for_category(category: str) -> List[Dict]:
    return CATEGORY_FIELDS.get(category, CATEGORY_FIELDS["_default"])


def get_next_field(category: str, profile: Dict) -> Optional[Dict]:
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


# ------------------------------------------------------------
# LLM helpers
# ------------------------------------------------------------

def classify_intent(message: str, history: List[Dict]) -> Dict:
    """Call 1 — Intent Router. Returns intent + category."""
    if not groq_client:
        return {"intent": "general", "category": None}

    categories = ALL_CATEGORIES
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
        return {"intent": result.get("intent", "general"), "category": result.get("category")}
    except Exception as e:
        print(f"[Intent router error] {e}")
        return {"intent": "general", "category": None}


def general_answer(message: str, history: List[Dict], selected: Optional[Dict], post_recommendation: bool = False) -> str:
    """Call 2A — Pure conversation for general questions."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="Chat service not configured")

    if selected:
        faq_text = "\n".join([f"ש: {q}\nת: {a}" for q, a in selected.get("faq", {}).items()])
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
        context = f"קטגוריות טיפולים בקליניקה: {', '.join(ALL_CATEGORIES)}"

    system = (
        "אתה עוזרת AI של MeDay - קליניקת יופי וטיפולים קוסמטיים.\n"
        "ענה תמיד בעברית בצורה חמה, מקצועית ומזמינה.\n"
        "בסס את תשובותיך על המידע שנמסר לך בלבד.\n\n" + context
    )

    if post_recommendation:
        system += (
            "\n\nשים לב: ההמלצות כבר ניתנו ללקוחה בהודעה הקודמת. "
            "אל תחזרי על רשימת הטיפולים המומלצים ואל תציגי אותם שוב. "
            "ענה רק על שאלת ההמשך הנוכחית בצורה קצרה וממוקדת."
        )

    messages = [{"role": "system", "content": system}]
    for msg in history[-8:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": message})

    try:
        resp = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, temperature=0.7)
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[General answer error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


def guided_conversation(message: str, history: List[Dict], profile: Dict, category: str, next_field_info: Optional[Dict]) -> Dict:
    """Call 2B — Guided flow, extracts profile fields from free text."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="Chat service not configured")

    known = "\n".join([f"- {k}: {v}" for k, v in profile.items()]) or "עדיין לא נאסף מידע"

    if next_field_info:
        next_instruction = (
            f"השאלה הבאה שצריך לשאול (אם עוד לא נענתה): {next_field_info['question']}\n"
            f"אפשרויות לשדה זה: {', '.join(next_field_info['options']) if next_field_info['options'] else 'תשובה חופשית'}"
        )
        ready_instruction = "קבע ready_to_recommend: false אלא אם כן כבר נאסף מספיק מידע."
    else:
        next_instruction = "נאסף מספיק מידע. אין צורך לשאול שאלות נוספות."
        ready_instruction = "קבע ready_to_recommend: true."

    system = f"""אתה יועצת יופי חכמה של MeDay בקטגוריה: {category}.
מנהלת שיחה אישית עם לקוחה כדי להמליץ על הטיפול הכי מתאים לה.

מידע שכבר ידוע על הלקוחה:
{known}

{next_instruction}

כללים חשובים:
1. ענה בעברית חמה ואישית — כמו חברה שמבינה יופי
2. אם הלקוחה ענתה על שאלה קודמת — **הכירי בתשובה שלה בחום** לפני שתשאלי את השאלה הבאה
   לדוגמה: "מעולה, עור מעורב — הבנתי 😊 ועכשיו..."
3. אם הלקוחה שאלה שאלה כללית — ענה עליה בקצרה ואז המשיכי לשאלה הבאה
4. {ready_instruction}
5. אל תמציאי מידע רפואי שאינו מוצג לך
6. אל תחזרי על שאלות שכבר נענו

החזירי ONLY valid JSON:
{{"reply": "...", "profile_update": {{}}, "ready_to_recommend": false}}"""

    messages = [{"role": "system", "content": system}]
    for msg in history[-6:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": message})

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", messages=messages, temperature=0.7,
            response_format={"type": "json_object"},
        )
        result = json.loads(resp.choices[0].message.content)
        reply_text = result.get("reply", "")
        # Strip any leaked JSON field artifacts from the reply text
        reply_text = re.sub(r'ready_to_recommend\s*:\s*(true|false)', '', reply_text, flags=re.IGNORECASE).strip()
        return {
            "reply": reply_text,
            "profile_update": result.get("profile_update", {}),
            "ready_to_recommend": bool(result.get("ready_to_recommend", False)),
        }
    except Exception as e:
        print(f"[Guided conversation error] {e}")
        return {"reply": "מצטערת, יש לי תקלה קטנה. אנא נסי שוב.", "profile_update": {}, "ready_to_recommend": False}


def sub_discovery(message: str, field: str, category: str, history: List[Dict], next_field_info: Optional[Dict] = None) -> str:
    """Sub-discovery — helps client figure out an answer. Ends with [RESOLVED: value]."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="Chat service not configured")

    fields = get_fields_for_category(category)
    field_info = next((f for f in fields if f["field"] == field), None)
    guidance = field_info["guidance"] if field_info else None
    options = field_info["options"] if field_info else []

    # If there is a next question to bridge into after resolving, tell the LLM
    bridge_hint = ""
    if next_field_info:
        bridge_hint = (
            f"\nאם סיימת לזהות את התשובה, לאחר ה-[RESOLVED:] הוסיפי משפט מעבר חם לשאלה הבאה: "
            f'"{next_field_info["question"]}" — הסבירי במשפט אחד קצר למה זה חשוב לנו לדעת.'
        )

    system = (
        f"אתה יועצת יופי של MeDay המנסה לעזור ללקוחה להבין מה ה-{field} שלה.\n\n"
        + (f"הנחיה לאבחון: {guidance}\n" if guidance else "")
        + (f"האפשרויות הסופיות: {', '.join(options)}\n" if options else "")
        + "\nשאלי שאלות אבחון פשוטות, חמות ומובנות. "
        "ברגע שאת בטוחה מה התשובה, ציני בסוף התשובה: [RESOLVED: הערך]\n"
        "לדוגמה: 'מעולה! נראה שיש לך עור שמן 😊 [RESOLVED: שמן]'\n"
        "אל תכתבי [RESOLVED:] עד שאת בטוחה לגמרי."
        + bridge_hint
    )

    messages = [{"role": "system", "content": system}]
    for msg in history[-6:]:
        role = "user" if msg.get("from") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    messages.append({"role": "user", "content": message})

    try:
        resp = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, temperature=0.7)
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Sub-discovery error] {e}")
        return f"מצטערת, יש לי תקלה. נסי לתאר את ה-{field} שלך בכמה מילים."


def build_recommendation(profile: Dict, category: str, history: List[Dict]) -> Dict:
    """Final recommendation — filters treatments to category, picks best matches."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="Chat service not configured")

    # Translate frontend category name → Excel class_name using the map
    excel_class = CATEGORY_TO_CLASS.get(category, category)

    # For קוסמטיקה sub-categories: filter by sub_category field in profile
    sub_cat = profile.get("sub_category")
    if sub_cat and sub_cat in CATEGORY_FIELDS:
        # Filter Excel treatments by תת_קטגוריה matching the sub-category
        category_treatments = [t for t in TREATMENTS if t.get("category") == sub_cat]
    else:
        category_treatments = [t for t in TREATMENTS if t.get("class_name") == excel_class]

    if not category_treatments:
        # Fallback: all treatments in class_name (try original category name too)
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
        resp = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, temperature=0.7)
        reply = resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Recommendation error] {e}")
        reply = "מצטערת, יש לי תקלה בהפקת ההמלצות. אנא פני לצוות שלנו ישירות."

    suggested = []
    for t in category_treatments:
        if t["name"] in reply:
            suggested.append({"id": t["id"], "name": t["name"], "category": t["category"]})

    return {"reply": reply, "suggested_treatments": suggested[:3]}


# ------------------------------------------------------------
# Basic routes
# ------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "ok": True,
        "services": {
            "chat": {"configured": bool(GROQ_API_KEY), "provider": "groq"}
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
# All clinic categories — must match serviceCatalog.js names exactly
# ------------------------------------------------------------
ALL_CATEGORIES = [
    "טיפולי קוסמטיקה",
    "מניקור ופדיקור",
    "עיצוב שיער",
    "טיפולי גוף",
    "הסרת שיער",
    "איפור מקצועי",
    "איפור קבוע ועיצוב גבות",
    "סטיילינג אישי",
    "טיפולי אסתטיקה",
]

# Map category name → class_name used in TREATMENTS/Excel
# (Excel uses "קוסמטיקה", frontend shows "טיפולי קוסמטיקה")
CATEGORY_TO_CLASS: Dict[str, str] = {
    "טיפולי קוסמטיקה":         "קוסמטיקה",
    "מניקור ופדיקור":          "מניקור ופדיקור",
    "עיצוב שיער":              "עיצוב שיער",
    "טיפולי גוף":              "טיפולי גוף",
    "הסרת שיער":               "הסרת שיער",
    "איפור מקצועי":            "איפור מקצועי",
    "איפור קבוע ועיצוב גבות":  "איפור קבוע ועיצוב גבות",
    "סטיילינג אישי":           "סטיילינג אישי",
    "טיפולי אסתטיקה":          "טיפולי אסתטיקה",
}

# ------------------------------------------------------------
# Warm openers — one per category, shown before the first question
# ------------------------------------------------------------
WARM_OPENERS: Dict[str, str] = {
    "טיפולי קוסמטיקה":         "נשמח לעזור לך למצוא את הטיפול הקוסמטי המתאים ביותר 💆‍♀️\nכמה שאלות קצרות ואני אדע בדיוק מה יעשה לך טוב —",
    "מניקור ופדיקור":          "מניקור ופדיקור זה טיפול שנותן תוצאות מיידיות 💅\nמה את מחפשת היום?",
    "עיצוב שיער":              "עיצוב שיער מקצועי יכול לשנות הכל ✂️\nספרי לי קצת על מה שאת מחפשת —",
    "טיפולי גוף":              "עיסוי טוב הוא אחד הדברים הכי טובים שאפשר לעשות לגוף ולנפש 🌿\nבואי נמצא את העיסוי שהכי מתאים לך —",
    "הסרת שיער":               "הסרת שיער בלייזר היא אחת ההחלטות הכי משחררות שתעשי 🌟\nכמה שאלות קצרות ואמצא לך את הטיפול המדויק —",
    "איפור מקצועי":            "איפור מקצועי שמתאים לך בדיוק — זה האמנות שלנו 💄\nספרי לי קצת על האירוע או המטרה שלך —",
    "איפור קבוע ועיצוב גבות":  "איפור קבוע הוא החלטה שמשנה את השגרה היומית לגמרי 🎨\nכמה שאלות ואמצא את הטיפול המדויק בשבילך —",
    "סטיילינג אישי":           "מפגש סטיילינג הוא הזדמנות לגלות את הסגנון שלך 👗\nבואי נבין מה הכי מתאים לך —",
    "טיפולי אסתטיקה":          "טיפולי אסתטיקה שלנו מותאמים לכל צורך וכל עור ✨\nכמה שאלות ואמצא לך את הפתרון הנכון —",
    # Sub-categories of טיפולי קוסמטיקה
    "טיפולי פנים קלאסיים":     "טיפולי פנים קלאסיים הם הבסיס לעור בריא ומטופח ✨\nבואי נמצא את הטיפול שהכי מתאים לעור שלך —",
    "טיפולי פנים מפנקים":      "מגיע לך קצת פינוק 💛\nבואי נבין מה יגרום לך להרגיש הכי טוב —",
    "טיפולי פנים טכנולוגיים מיוחדים": "טכנולוגיה מתקדמת לתוצאות אמיתיות ⭐\nכמה שאלות ואמצא לך את הטיפול המדויק —",
}


# ------------------------------------------------------------
# Progress helpers
# ------------------------------------------------------------
def get_progress(category: str, profile: Dict) -> Dict:
    """Returns current question number and total for the progress indicator."""
    fields = get_fields_for_category(category)
    minimums = MINIMUM_FIELDS.get(category, MINIMUM_FIELDS["_default"])
    # Count only minimum fields for progress (don't show medium-priority extras)
    minimum_fields_info = [f for f in fields if f["field"] in minimums]
    total = len(minimum_fields_info)
    answered = sum(1 for f in minimum_fields_info if f["field"] in profile)
    return {"question_number": answered + 1, "total_questions": total}


# ------------------------------------------------------------
# Chat schemas
# ------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict]] = None
    selected_treatment_id: Optional[str] = None
    profile: Optional[Dict] = None
    mode: Optional[str] = "idle"
    category: Optional[str] = None
    current_field: Optional[str] = None
    chip_field: Optional[str] = None
    chip_value: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    mode: str
    profile: Dict
    category: Optional[str] = None
    current_field: Optional[str] = None
    quick_replies: Optional[List[str]] = None
    suggested_treatments: Optional[List[Dict]] = None
    question_number: Optional[int] = None
    total_questions: Optional[int] = None


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

    def make_question_response(next_field: Dict, reply_override: Optional[str] = None) -> ChatResponse:
        """Build a questioning response with progress numbers."""
        progress = get_progress(category, profile)
        reply = reply_override if reply_override is not None else next_field["question"]
        return ChatResponse(
            reply=reply,
            mode="questioning",
            profile=profile,
            category=category,
            current_field=next_field["field"],
            quick_replies=field_chips(next_field),
            question_number=progress["question_number"],
            total_questions=progress["total_questions"],
        )

    def make_recommendation_response(rec: Dict, prefix: str = "") -> ChatResponse:
        """Build a recommendation response."""
        reply = (prefix + "\n\n" + rec["reply"]).strip() if prefix else rec["reply"]
        profile["recommendations_given"] = True
        return ChatResponse(
            reply=reply,
            mode="recommending",
            profile=profile,
            category=category,
            suggested_treatments=rec["suggested_treatments"] or None,
        )

    # ── 0. Treatment-page context ──────────────────────────────
    selected = TREATMENT_MAP.get(req.selected_treatment_id) if req.selected_treatment_id else None
    if selected:
        reply = general_answer(req.message, history, selected)
        return ChatResponse(reply=reply, mode="idle", profile=profile)

    # ── 1. Chip tap: real answer ───────────────────────────────
    if req.chip_value and req.chip_field and req.chip_value != "dont_know":
        profile[req.chip_field] = req.chip_value
        next_field = get_next_field(category, profile)
        if next_field is None or can_recommend(category, profile):
            return make_recommendation_response(build_recommendation(profile, category, history))
        return make_question_response(next_field)

    # ── 2. Chip tap: "I don't know" → sub-discovery ───────────
    if req.chip_value == "dont_know" and req.chip_field:
        # Pass next field so sub-discovery can bridge into it on resolve
        temp_profile_after = {**profile}
        # We don't know the resolved value yet, so peek at what comes after current field
        peek_next = get_next_field(category, {**profile, req.chip_field: "__placeholder__"})
        reply = sub_discovery(req.message, req.chip_field, category, history, next_field_info=peek_next)
        resolved = re.search(r'\[RESOLVED:\s*(.+?)\]', reply)
        clean_reply = re.sub(r'\[RESOLVED:\s*.+?\]', '', reply).strip()
        if resolved:
            profile[req.chip_field] = resolved.group(1).strip()
            next_field = get_next_field(category, profile)
            if next_field is None or can_recommend(category, profile):
                return make_recommendation_response(build_recommendation(profile, category, history), prefix=clean_reply)
            return make_question_response(next_field, reply_override=clean_reply)
        return ChatResponse(reply=clean_reply, mode="sub_discovery", profile=profile, category=category, current_field=req.chip_field)

    # ── 3. Continuing sub-discovery with free text ────────────
    if mode == "sub_discovery" and current_field:
        peek_next = get_next_field(category, {**profile, current_field: "__placeholder__"})
        reply = sub_discovery(req.message, current_field, category, history, next_field_info=peek_next)
        resolved = re.search(r'\[RESOLVED:\s*(.+?)\]', reply)
        clean_reply = re.sub(r'\[RESOLVED:\s*.+?\]', '', reply).strip()
        if resolved:
            profile[current_field] = resolved.group(1).strip()
            next_field = get_next_field(category, profile)
            if next_field is None or can_recommend(category, profile):
                return make_recommendation_response(build_recommendation(profile, category, history), prefix=clean_reply)
            return make_question_response(next_field, reply_override=clean_reply)
        return ChatResponse(reply=clean_reply, mode="sub_discovery", profile=profile, category=category, current_field=current_field)

    # ── 4. Post-recommendation: user is just chatting ─────────
    # Once a recommendation was already given, treat follow-up messages
    # as general conversation — never re-trigger the guided flow.
    # Check both mode and the profile flag so stale mode doesn't bypass this.
    if mode == "recommending" or profile.get("recommendations_given"):
        reply = general_answer(req.message, history, None, post_recommendation=True)
        return ChatResponse(reply=reply, mode="recommending", profile=profile, category=category)

    # ── 5. Intent classification ───────────────────────────────
    is_first_question = False
    if not category:
        classification = classify_intent(req.message, history)
        if classification["intent"] == "recommendation" and classification.get("category"):
            category = classification["category"]
            mode = "questioning"
            is_first_question = True

    # ── 6. General answer ──────────────────────────────────────
    if mode == "idle" or not category:
        reply = general_answer(req.message, history, None)
        return ChatResponse(reply=reply, mode="idle", profile=profile, category=category)

    # ── 7. First question — prepend warm opener ────────────────
    if is_first_question:
        next_field = get_next_field(category, profile)
        if next_field:
            opener = WARM_OPENERS.get(category, "כמה שאלות קצרות ואמצא לך את הטיפול המתאים —")
            progress = get_progress(category, profile)
            return ChatResponse(
                reply=f"{opener}\n\n{next_field['question']}",
                mode="questioning",
                profile=profile,
                category=category,
                current_field=next_field["field"],
                quick_replies=field_chips(next_field),
                question_number=progress["question_number"],
                total_questions=progress["total_questions"],
            )

    # ── 8. Guided conversation (free text in recommendation flow)
    next_field = get_next_field(category, profile)
    result = guided_conversation(req.message, history, profile, category, next_field)
    profile.update(result.get("profile_update", {}))
    next_field = get_next_field(category, profile)

    if (result.get("ready_to_recommend") or next_field is None) and can_recommend(category, profile):
        rec = build_recommendation(profile, category, history)
        return make_recommendation_response(rec, prefix=result["reply"])

    if next_field:
        return make_question_response(next_field, reply_override=result["reply"])

    return ChatResponse(reply=result["reply"], mode="questioning", profile=profile, category=category)


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
    for col in ("end_time TEXT", "treatment_category TEXT", "treatment_subcategory TEXT"):
        try:
            conn.execute(f"ALTER TABLE appointments ADD COLUMN {col}")
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
    rows = conn.execute("SELECT * FROM appointments ORDER BY date, time").fetchall()
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
        (appt.client_name, appt.client_phone, appt.treatment_id, appt.treatment_name,
         appt.treatment_category, appt.treatment_subcategory, appt.date, appt.time, appt.end_time, appt.notes),
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
def get_analytics(from_date: Optional[str] = None, to_date: Optional[str] = None):
    conn = get_db()

    # Build optional date range filter
    where_parts = []
    params = []
    if from_date:
        where_parts.append("date >= ?")
        params.append(from_date)
    if to_date:
        where_parts.append("date <= ?")
        params.append(to_date)
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    total = conn.execute(f"SELECT COUNT(*) as c FROM appointments {where_clause}", params).fetchone()["c"]

    by_treatment = conn.execute(
        f"SELECT treatment_name, COUNT(*) as count FROM appointments {where_clause} GROUP BY treatment_name ORDER BY count DESC LIMIT 10",
        params,
    ).fetchall()

    by_day = conn.execute(
        f"SELECT strftime('%w', date) as day_num, COUNT(*) as count FROM appointments {where_clause} GROUP BY day_num ORDER BY day_num",
        params,
    ).fetchall()

    by_hour = conn.execute(
        f"SELECT substr(time, 1, 2) as hour, COUNT(*) as count FROM appointments {where_clause} GROUP BY hour ORDER BY hour",
        params,
    ).fetchall()

    recent = conn.execute(
        f"SELECT * FROM appointments {where_clause} ORDER BY date DESC, time DESC LIMIT 10",
        params,
    ).fetchall()

    # Today's count (always absolute, ignores date range filter)
    today_count = conn.execute(
        "SELECT COUNT(*) as c FROM appointments WHERE date = date('now', 'localtime')"
    ).fetchone()["c"]

    # This week's count (always absolute)
    this_week_count = conn.execute(
        "SELECT COUNT(*) as c FROM appointments WHERE strftime('%Y-%W', date) = strftime('%Y-%W', date('now', 'localtime'))"
    ).fetchone()["c"]

    # By category breakdown (respects date filter)
    cat_where_parts = list(where_parts) + ["treatment_category IS NOT NULL", "treatment_category != ''"]
    cat_where = "WHERE " + " AND ".join(cat_where_parts)
    by_category = conn.execute(
        f"SELECT treatment_category, COUNT(*) as count FROM appointments {cat_where} GROUP BY treatment_category ORDER BY count DESC",
        params,
    ).fetchall()

    # Monthly trend — last 6 calendar months (always absolute)
    monthly_trend = conn.execute(
        """
        SELECT strftime('%Y-%m', date) as month, COUNT(*) as count
        FROM appointments
        WHERE date >= date('now', 'localtime', '-5 months', 'start of month')
        GROUP BY month
        ORDER BY month
        """
    ).fetchall()

    conn.close()

    day_names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
    return {
        "total": total,
        "today": today_count,
        "this_week": this_week_count,
        "by_treatment": [{"name": r["treatment_name"], "count": r["count"]} for r in by_treatment],
        "by_day": [{"day": day_names[int(r["day_num"])], "count": r["count"]} for r in by_day],
        "by_hour": [{"hour": f"{r['hour']}:00", "count": r["count"]} for r in by_hour],
        "by_category": [{"category": r["treatment_category"], "count": r["count"]} for r in by_category],
        "monthly_trend": [{"month": r["month"], "count": r["count"]} for r in monthly_trend],
        "recent": [dict(r) for r in recent],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
