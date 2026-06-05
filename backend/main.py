from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from typing import Optional, List, Dict
from pydantic import BaseModel
from groq import Groq
import os
import sqlite3
import json
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

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
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

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
# Category field registry
# Defines what to ask per category and how to guide "I don't know"
# TODO: Replace with category_questions.xlsx once prepared
# ------------------------------------------------------------
CATEGORY_FIELDS: Dict[str, List[Dict]] = {
    "טיפולי פנים": [
        {
            "field": "goal",
            "priority": "high",
            "question": "מה המטרה הראשית שלך?",
            "options": ["אקנה", "לחות", "זוהר", "אנטי-אייג'ינג", "פיגמנטציה", "ריענון כללי"],
            "guidance": None,
        },
        {
            "field": "skin_type",
            "priority": "high",
            "question": "מה סוג העור שלך?",
            "options": ["שמן", "יבש", "מעורב", "רגיש", "נורמלי"],
            "guidance": "שאלי על תחושת העור אחרי שטיפת פנים, האם יש ברק אחרי שעה-שעתיים, ואם יש נטייה לקשקשים או אודם",
        },
        {
            "field": "age_range",
            "priority": "medium",
            "question": "מה טווח הגיל שלך?",
            "options": ["עד 25", "25-40", "40+"],
            "guidance": None,
        },
        {
            "field": "pregnant",
            "priority": "critical",
            "question": "את בהריון או מניקה כרגע?",
            "options": ["כן", "לא"],
            "guidance": None,
        },
    ],
    "לייזר": [
        {
            "field": "area",
            "priority": "high",
            "question": "באיזה אזור מעוניינת בטיפול לייזר?",
            "options": ["פנים", "גוף", "ביקיני", "רגליים", "בית שחי"],
            "guidance": None,
        },
        {
            "field": "skin_tone",
            "priority": "high",
            "question": "מה גוון העור שלך?",
            "options": ["בהיר מאוד", "בהיר", "בינוני", "כהה"],
            "guidance": "שאלי האם העור משחיר בקלות בשמש, ומה קורה אחרי חשיפה לשמש - האם משחיר ואז מחוויר או נשאר כהה",
        },
        {
            "field": "hair_color",
            "priority": "high",
            "question": "מה צבע השיער באזור הטיפול?",
            "options": ["שחור / כהה מאוד", "חום כהה", "חום בהיר", "בלונד / אדמוני / אפור"],
            "guidance": None,
        },
        {
            "field": "pregnant",
            "priority": "critical",
            "question": "את בהריון או מניקה כרגע?",
            "options": ["כן", "לא"],
            "guidance": None,
        },
    ],
    "מניקור ופדיקור": [
        {
            "field": "service_type",
            "priority": "high",
            "question": "מה את מחפשת?",
            "options": ["מניקור רגיל", "לק גל", "עיצוב ציפורניים", "פדיקור אסתטי", "פדיקור טיפולי"],
            "guidance": None,
        },
    ],
    "_default": [
        {
            "field": "goal",
            "priority": "high",
            "question": "מה המטרה שלך?",
            "options": [],
            "guidance": None,
        },
        {
            "field": "pregnant",
            "priority": "critical",
            "question": "את בהריון או מניקה?",
            "options": ["כן", "לא"],
            "guidance": None,
        },
    ],
}

# Minimum fields that must be filled before a recommendation is made
MINIMUM_FIELDS: Dict[str, List[str]] = {
    "טיפולי פנים": ["goal", "skin_type", "pregnant"],
    "קוסמטיקה": ["goal", "skin_type", "pregnant"],
    "טיפולי קוסמטיקה": ["goal", "skin_type", "pregnant"],
    "לייזר": ["area", "pregnant"],
    "מניקור ופדיקור": ["service_type"],
    "_default": ["goal"],
}

CATEGORY_FIELDS["קוסמטיקה"] = CATEGORY_FIELDS["טיפולי פנים"]
CATEGORY_FIELDS["טיפולי קוסמטיקה"] = CATEGORY_FIELDS["טיפולי פנים"]


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
# LLM helpers
# ------------------------------------------------------------

def classify_intent(message: str, history: List[Dict]) -> Dict:
    """
    Call 1 — Intent Router.
    Returns {"intent": "general"|"recommendation", "category": str|None}
    """
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
        "בסס את תשובותיך על המידע שנמסר לך בלבד.\n\n"
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
        raise HTTPException(status_code=500, detail=str(e))


def guided_conversation(
    message: str,
    history: List[Dict],
    profile: Dict,
    category: str,
    next_field_info: Optional[Dict],
) -> Dict:
    """
    Call 2B — Guided recommendation flow with free-text input.
    The LLM knows what field to ask next and extracts profile updates.
    Returns {"reply": str, "profile_update": dict, "ready_to_recommend": bool}
    """
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

מידע שכבר ידוע:
{known}

{next_instruction}

כללים:
1. ענה בעברית חמה ואישית
2. אם הלקוחה ענתה על שאלה קודמת — חלצי את הערך ל-profile_update
3. אם הלקוחה שאלה שאלה כללית — ענה עליה בקצרה ואז המשיכי לשאלה הבאה
4. {ready_instruction}
5. אל תמציאי מידע רפואי שאינו מוצג לך

החזירי ONLY valid JSON:
{{"reply": "...", "profile_update": {{}}, "ready_to_recommend": false}}"""

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
        )
        result = json.loads(resp.choices[0].message.content)
        return {
            "reply": result.get("reply", ""),
            "profile_update": result.get("profile_update", {}),
            "ready_to_recommend": bool(result.get("ready_to_recommend", False)),
        }
    except Exception as e:
        print(f"[Guided conversation error] {e}")
        return {
            "reply": "מצטערת, יש לי תקלה קטנה. אנא נסי שוב.",
            "profile_update": {},
            "ready_to_recommend": False,
        }


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
        reply = "מצטערת, יש לי תקלה בהפקת ההמלצות. אנא פני לצוות שלנו ישירות."

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

    profile.update(result.get("profile_update", {}))

    # Re-evaluate after profile update
    next_field = get_next_field(category, profile)

    if (result.get("ready_to_recommend") or next_field is None) and can_recommend(category, profile):
        rec = build_recommendation(profile, category, history)
        return ChatResponse(
            reply=result["reply"] + ("\n\n" + rec["reply"] if result["reply"] else rec["reply"]),
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
            employee_name TEXT,
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
        conn.execute("ALTER TABLE appointments ADD COLUMN employee_name TEXT")
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
    employee_name: Optional[str] = None
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
           (client_name, client_phone, treatment_id, treatment_name, employee_name, date, time, end_time, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (appt.client_name, appt.client_phone, appt.treatment_id,
         appt.treatment_name, appt.employee_name, appt.date, appt.time, appt.end_time, appt.notes),
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
