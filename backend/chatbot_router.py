"""
MeDay chatbot router — single-call LLM approach.

Every free-text message goes through ONE LLM call that has full clinic
context (categories + FAQs) and generates the reply directly.  The only
keyword short-circuit kept is the price guard (hard rule, belt-and-suspenders).

Routing for in_flow (recommendation) mode is still button-based and LLM-free.
"""
import os
import json
import requests
from typing import Optional
from groq import Groq

from chatbot_config import (
    CONFIDENCE_THRESHOLD, MAX_CONTEXT_MESSAGES,
    CLINIC_PHONE, GROQ_MODEL, SYSTEM_PROMPT,
)
from chatbot_db import (
    get_session, save_session, append_context,
    get_faq_entries, get_categories, get_category_by_id,
    get_treatment_by_id,
)
from chatbot_flow import (
    build_question_response, apply_score, get_top_treatments,
    get_base_treatment, format_recommendation_text,
    format_terminal_text, format_intro,
)

_GROQ_KEY = os.getenv("GROQ_API_KEY", "")
_groq = Groq(api_key=_GROQ_KEY) if _GROQ_KEY else None
_OLLAMA_ENABLED = os.getenv("OLLAMA_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
_OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b-instruct").strip() or "qwen3:4b-instruct"
_OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))


def _groq_ok() -> bool:
    return bool(_GROQ_KEY and _GROQ_KEY.strip().startswith("gsk_") and _groq)


def _ollama_ok() -> bool:
    if not _OLLAMA_ENABLED:
        return False
    try:
        return requests.get(f"{_OLLAMA_BASE_URL}/api/tags", timeout=0.75).ok
    except requests.RequestException:
        return False


def _llm_available() -> bool:
    return _ollama_ok() or _groq_ok()


def _json_llm_completion(messages: list[dict]) -> str:
    """Use the project's local Ollama model first, then Groq as fallback."""
    ollama_error = None
    if _ollama_ok():
        try:
            response = requests.post(
                f"{_OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": _OLLAMA_MODEL,
                    "messages": messages,
                    "format": "json",
                    "stream": False,
                    "options": {"temperature": 0.4, "num_predict": 500},
                },
                timeout=_OLLAMA_TIMEOUT,
            )
            response.raise_for_status()
            content = response.json().get("message", {}).get("content", "").strip()
            if content:
                return content
            raise RuntimeError("Ollama response did not include content")
        except Exception as error:
            ollama_error = error
            print(f"[chatbot Ollama error] {error}")

    if _groq_ok():
        response = _groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=500,
        )
        return response.choices[0].message.content

    raise ollama_error or RuntimeError("No chatbot LLM provider is available")


# ── Small-talk / acknowledgment short-circuit (no LLM) ───────────────────────

_ACK_WORDS = {
    # Hebrew
    "אוקי", "אוקיי", "בסדר", "ברור", "הבנתי", "סבבה", "סבבא",
    "תודה", "תנקיו", "ממש תודה", "תודה רבה", "תודות",
    "מעולה", "יופי", "סופר", "אחלה", "כל הכבוד", "נהדר",
    # English
    "ok", "okay", "got it", "thanks", "thank you", "ty", "thx", "great", "cool", "awesome", "nice",
    # Arabic
    "شكرا", "ماشي", "تمام", "حسنا", "حسناً",
}

_GREET_WORDS = {
    "שלום", "היי", "הי", "היי", "בוקר טוב", "ערב טוב", "לילה טוב",
    "hello", "hi", "hey", "good morning", "good evening",
    "مرحبا", "أهلا", "هاي", "هلو",
}


def _is_acknowledgment(msg: str) -> bool:
    """True for short pure acknowledgments that need no LLM."""
    cleaned = msg.strip()
    if len(cleaned) > 25:
        return False
    low = cleaned.lower().rstrip("!.,?")
    return low in _ACK_WORDS


def _is_greeting(msg: str) -> bool:
    """True for short pure greetings."""
    cleaned = msg.strip()
    if len(cleaned) > 25:
        return False
    low = cleaned.lower().rstrip("!.,?")
    return low in _GREET_WORDS


def _ack_reply(lang: str) -> str:
    msgs = {
        "he": "מעולה 😊 במה אוכל לעזור לך עוד?",
        "ar": "رائع 😊 كيف يمكنني مساعدتك أكثر؟",
        "en": "Great 😊 How else can I help you?",
    }
    return msgs.get(lang, msgs["he"])


def _greeting_reply(lang: str) -> str:
    msgs = {
        "he": f"היי! שמחה שפנית 😊 אני כאן לעזור לך עם כל שאלה על הטיפולים שלנו. במה אוכל לעזור?",
        "ar": f"أهلاً! سعيدة بتواصلك 😊 أنا هنا للمساعدة في أي سؤال عن علاجاتنا. كيف يمكنني المساعدة؟",
        "en": f"Hi! Happy you reached out 😊 I'm here to help with any questions about our treatments. How can I help?",
    }
    return msgs.get(lang, msgs["he"])


# ── Hard price guard (no LLM — enforced before everything) ───────────────────

_PRICE_KW = [
    "מחיר", "עלות", "עולה", "כמה עולה", "כמה זה", "כמה יעלה", "מחירון",
    "זול", "יקר", "תשלום", "מבצע", "הנחה", "תעריף",
    "price", "cost", "how much", "cheap", "expensive", "discount", "fee",
    "سعر", "كم", "تكلفة", "غالي", "رخيص",
]


def _is_price(msg: str) -> bool:
    ml = msg.lower()
    return any(kw in ml for kw in _PRICE_KW)


# ── Language detection (heuristic, no LLM) ───────────────────────────────────

def _detect_language(text: str) -> str:
    he = sum(1 for c in text if "א" <= c <= "ת")
    ar = sum(1 for c in text if "؀" <= c <= "ۿ")
    if ar > he and ar > 1:
        return "ar"
    if he > 1:
        return "he"
    return "en"


# ── Static template replies ───────────────────────────────────────────────────

def _price_msg(lang: str = "he") -> str:
    msgs = {
        "he": f"מחירים הם משהו שהצוות שלנו יוכל לענות עליו בדיוק הכי טוב 😊\nצרי קשר ב-{CLINIC_PHONE} או בוואטסאפ ונשמח לעזור!",
        "ar": f"الأسعار يجيب عنها فريقنا بشكل أدق 😊\nتواصل معنا على {CLINIC_PHONE} أو واتساب وسنكون سعداء بمساعدتك!",
        "en": f"Pricing is best answered by our team 😊\nReach us at {CLINIC_PHONE} or via WhatsApp!",
    }
    return msgs.get(lang, msgs["he"])


def _forward_msg(lang: str = "he") -> str:
    msgs = {
        "he": f"זה משהו שהצוות שלנו יוכל לעזור לך בו הכי טוב 😊\nניתן ליצור קשר בטלפון {CLINIC_PHONE} או בוואטסאפ.",
        "ar": f"فريقنا سيكون سعيداً للمساعدة في هذا الأمر 😊\nيمكنك التواصل عبر {CLINIC_PHONE} أو واتساب.",
        "en": f"That's best answered by our team directly 😊\nReach them at {CLINIC_PHONE} or via WhatsApp.",
    }
    return msgs.get(lang, msgs["he"])


def _not_now_msg(lang: str = "he") -> str:
    msgs = {
        "he": "בסדר גמור! אם תרצי עזרה בעתיד, אני כאן 😊",
        "ar": "حسناً! إذا احتجت مساعدة لاحقاً، أنا هنا 😊",
        "en": "No problem! I'm here whenever you need help 😊",
    }
    return msgs.get(lang, msgs["he"])


# ── Single LLM call: understand + respond ────────────────────────────────────

def _llm_respond(message: str, context: list, lang: str) -> dict:
    """
    One LLM call with full clinic context.
    Returns {reply, action, forward}
      action: null | "start_flow:CAT-03"
      forward: bool
    """
    from chatbot_db import get_treatments_in_category
    categories = get_categories()
    faqs = get_faq_entries()

    # Build category block + treatment names per category
    cat_lines = []
    rec_ids = []
    for c in categories:
        suffix = ""
        if c.get("has_recommendation"):
            suffix = f"  ← ניתן להפעיל שאלון המלצה (action=start_flow:{c['category_id']})"
            rec_ids.append(c["category_id"])
        treatments = get_treatments_in_category(c["category_id"])
        t_names = [t["treatment_name"] for t in treatments if t.get("treatment_name")]
        # Mark which treatments have detail vs. name-only
        detailed = {t["treatment_id"] for t in treatments if t.get("good_for") or t.get("short_description")}
        t_parts = []
        for t in treatments:
            if t.get("treatment_name"):
                marker = "" if t["treatment_id"] in detailed else " [שם בלבד]"
                t_parts.append(t["treatment_name"] + marker)
        t_block = ", ".join(t_parts) if t_parts else "—"
        cat_lines.append(f"• [{c['category_id']}] {c['category_name']}{suffix}\n  שירותים: {t_block}")
    cat_block = "\n".join(cat_lines)

    faq_block = "\n\n".join(
        f"שאלה: {f['canonical_question']}\nתשובה: {f['answer']}"
        for f in faqs
    )

    ctx_str = ""
    if context:
        ctx_str = "\n\nשיחה אחרונה:\n" + "\n".join(
            f"{m['role']}: {m['content']}" for m in context[-MAX_CONTEXT_MESSAGES:]
        )

    prompt = f"""אתה צ'אטבוט של קליניקת יופי ועיצוב MeDay. תפקידך לעזור ללקוחות.

כללים נוקשים — אסור לעבור עליהם:
1. אל תציין מחירים, עלויות או תעריפים — הפנה תמיד ל-{CLINIC_PHONE}.
2. אל תבטיח תוצאות רפואיות או טיפוליות.
3. ענה תמיד באותה שפה שהמשתמש כותב (עברית / ערבית / אנגלית).
4. אל תמציא מידע שלא מופיע כאן.
5. אל תתחיל תשובה עם "ב-MeDay" או משפט פתיחה חוזר — ענה ישירות לשאלה.
6. שירות שמסומן [שם בלבד] — קיים אבל אין לי פרטים עליו. אם שואלים עליו, אמרי בצורה חמה: "נשמח לספר לך יותר על [שם השירות]! הצוות שלנו ב-{CLINIC_PHONE} זמין לכל שאלה 💛" — אל תמציאי פרטים.

קטגוריות ושירותים שלנו:
{cat_block}

שאלות נפוצות ותשובותיהן:
{faq_block}
{ctx_str}

הודעת המשתמש: "{message}"

החזר JSON בלבד:
- "reply": התשובה — חמה, תמציתית, ישירה לנושא. אם שואלים מה אנחנו מציעים — פרט את כל הקטגוריות.
- "action": אחת מהאפשרויות הבאות —
  • null — ברירת מחדל, לא נדרש פעולה
  • "offer_recommendation:CATEGORY_ID" — כאשר המשתמש שואל מה יש בקטגוריה מסוימת שיש לה שאלון (רק: {', '.join(rec_ids) or 'אין'}). פרטי את השירותים בתשובה, וסיימי בשאלה כמו "האם תרצי שאעזור לך לבחור את הטיפול המתאים ביותר?" — אז המערכת תציג כפתורי כן/לא.
  • "start_flow:CATEGORY_ID" — רק כאשר המשתמש מבקש בפירוש המלצה או עזרה בבחירה ("תמליצי לי", "עזרי לי לבחור", "מה מתאים לי") — לא כאשר הוא רק שואל מה יש.
- "forward": true רק אם נדרשת התערבות אנושית (שאלה רפואית ספציפית, תלונה, תיאום תור)"""

    try:
        content = _json_llm_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        data = json.loads(content)
        # Safety: strip price info from reply
        reply = data.get("reply") or ""
        return {
            "reply": reply,
            "action": data.get("action") or None,
            "forward": bool(data.get("forward", False)),
        }
    except Exception as e:
        print(f"[chatbot llm error] {e}")
        return {"reply": "", "action": None, "forward": False}


# ── Continue offer ────────────────────────────────────────────────────────────

def _make_continue_offer(session: dict) -> Optional[dict]:
    if not session.get("flow_answers") or not session.get("flow_category_id"):
        return None
    cat = get_category_by_id(session["flow_category_id"])
    answered = len({a["question_id"] for a in session["flow_answers"]})
    return {
        "category_id": session["flow_category_id"],
        "category_name": cat["category_name"] if cat else "",
        "questions_answered": answered,
    }


# ── Recommendation flow ───────────────────────────────────────────────────────

def _build_flow_reply(session: dict, session_id: str) -> dict:
    cat = get_category_by_id(session["flow_category_id"])
    q_resp = build_question_response(
        session["flow_category_id"], session["flow_question_index"]
    )
    if not q_resp:
        return _finish_flow(session, session_id)

    prefix = ""
    if session["flow_question_index"] == 0 and cat:
        lang = _detect_language("")
        prefix = format_intro(cat, lang) + "\n\n"

    return {
        "reply": prefix + q_resp["question_text"],
        "buttons": q_resp["buttons"],
        "offer_continue": None,
        "mode": "in_flow",
        "question_progress": {
            "current": q_resp["question_index"] + 1,
            "total": q_resp["total_questions"],
        },
    }


def _finish_flow(session: dict, session_id: str) -> dict:
    category_id = session["flow_category_id"]
    scores = session["flow_scores"]
    top = get_top_treatments(category_id, scores)

    if not top:
        base = get_base_treatment(category_id)
        top = [base] if base else []

    cat = get_category_by_id(category_id)
    cat_name = cat["category_name"] if cat else ""
    reply = format_recommendation_text(top, "he", cat_name)

    session["mode"] = "general"
    session["flow_category_id"] = None
    session["flow_question_index"] = 0
    session["flow_scores"] = {}
    session["flow_answers"] = []
    save_session(session_id, session)

    return {"reply": reply, "buttons": None, "offer_continue": None, "mode": "general"}


def _handle_flow_button(session: dict, session_id: str, button_value: str, question_id: str) -> dict:
    category_id = session["flow_category_id"]

    q_resp = build_question_response(category_id, session["flow_question_index"])
    terminal_id = None
    if q_resp:
        matched = [b for b in q_resp["buttons"] if b["value"] == button_value]
        if matched:
            terminal_id = matched[0].get("terminal_treatment_id")

    if terminal_id:
        t = get_treatment_by_id(terminal_id)
        session["mode"] = "general"
        session["flow_category_id"] = None
        session["flow_question_index"] = 0
        session["flow_scores"] = {}
        session["flow_answers"] = []
        save_session(session_id, session)
        reply = format_terminal_text(t, "he") if t else _forward_msg("he")
        return {"reply": reply, "buttons": None, "offer_continue": None, "mode": "general"}

    session["flow_scores"] = apply_score(
        session["flow_scores"], category_id, question_id, button_value
    )
    session["flow_answers"].append({"question_id": question_id, "option_value": button_value})
    session["flow_question_index"] += 1
    save_session(session_id, session)

    next_q = build_question_response(category_id, session["flow_question_index"])
    if next_q:
        return {
            "reply": next_q["question_text"],
            "buttons": next_q["buttons"],
            "offer_continue": None,
            "mode": "in_flow",
            "question_progress": {
                "current": next_q["question_index"] + 1,
                "total": next_q["total_questions"],
            },
        }
    return _finish_flow(session, session_id)


# ── Category-keyword fallback (no LLM needed) ────────────────────────────────

# Words that appear in only ONE category — safe to use for unambiguous detection
_CAT_UNIQUE_KW: dict[str, list[str]] = {
    "CAT-01": ["מניקור", "פדיקור", "ציפורניים", "ג'ל", "אקריל", "שעלק"],
    "CAT-02": ["עיצוב שיער", "תספורת", "צביעה", "בלייצ'", "החלקה", "קרטין", "גוונים"],
    "CAT-03": ["קוסמטיקה", "פנים", "ניקוי עמוק", "פילינג", "מסכה"],
    "CAT-04": ["טיפולי גוף", "גוף", "עיסוי", "דלקות", "ג'קוזי"],
    "CAT-05": ["הסרת שיער", "לייזר", "שעווה", "אלקטרולוגיה"],
    "CAT-06": ["איפור מקצועי", "מייקאפ", "כלה", "אירוע"],
    "CAT-07": ["גבות", "מיקרובליידינג", "פיגמנט", "קבוע"],
    "CAT-08": ["סטיילינג", "אישי", "סגנון", "ארון"],
    "CAT-09": ["אסתטיקה", "בוטוקס", "פילר", "מזותרפיה", "הרמה"],
}


def _detect_category_in_message(message: str) -> Optional[str]:
    """Return category_id if message clearly mentions one specific category."""
    msg_lower = " " + message + " "
    scores: dict[str, int] = {}
    for cat_id, keywords in _CAT_UNIQUE_KW.items():
        for kw in keywords:
            if kw in msg_lower:
                scores[cat_id] = scores.get(cat_id, 0) + 1
    if not scores:
        return None
    best = max(scores, key=scores.get)
    return best


def _build_category_db_reply(cat_id: str, lang: str) -> Optional[dict]:
    """Build a treatment-list reply from DB — no LLM, zero tokens."""
    from chatbot_db import get_treatments_in_category
    cat = get_category_by_id(cat_id)
    if not cat:
        return None
    treatments = get_treatments_in_category(cat_id)
    names = [t["treatment_name"] for t in treatments if t.get("treatment_name")]
    if not names:
        return None
    t_list = "\n".join(f"• {n}" for n in names)
    cat_name = cat["category_name"]
    intros = {
        "he": f"הנה הטיפולים שאנחנו מציעים בקטגוריית {cat_name}:\n\n{t_list}",
        "ar": f"إليك العلاجات التي نقدمها في فئة {cat_name}:\n\n{t_list}",
        "en": f"Here are the treatments we offer in {cat_name}:\n\n{t_list}",
    }
    reply = intros.get(lang, intros["he"])
    buttons = None
    if cat.get("has_recommendation"):
        offers = {
            "he": "\n\nהאם תרצי שאעזור לך לבחור את הטיפול המתאים ביותר?",
            "ar": "\n\nهل تريد مساعدتك في اختيار العلاج الأنسب لك؟",
            "en": "\n\nWould you like help choosing the right treatment?",
        }
        reply += offers.get(lang, offers["he"])
        yes_lbl = {"he": "כן, עזרי לי לבחור 💛", "ar": "نعم، ساعديني في الاختيار 💛", "en": "Yes, help me choose 💛"}.get(lang, "כן, עזרי לי לבחור 💛")
        no_lbl  = {"he": "לא תודה 😊", "ar": "لا شكراً 😊", "en": "No thanks 😊"}.get(lang, "לא תודה 😊")
        buttons = [
            {"label": yes_lbl, "value": f"__start_flow__:{cat_id}", "question_id": None, "terminal_treatment_id": None},
            {"label": no_lbl,  "value": "__no_recommendation__",    "question_id": None, "terminal_treatment_id": None},
        ]
    return {"reply": reply, "buttons": buttons, "mode": "general"}


# ── General routing ───────────────────────────────────────────────────────────

def _route_general(session: dict, session_id: str, message: str) -> dict:
    lang = _detect_language(message)
    append_context(session, "user", message, MAX_CONTEXT_MESSAGES)

    # Hard price guard — LLM never sees pricing questions
    if _is_price(message):
        reply = _price_msg(lang)
        append_context(session, "assistant", reply, MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {"reply": reply, "buttons": None, "mode": "general"}

    # Acknowledgment short-circuit — no LLM, instant reply
    if _is_acknowledgment(message):
        reply = _ack_reply(lang)
        append_context(session, "assistant", reply, MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {"reply": reply, "buttons": None, "mode": "general"}

    # Greeting short-circuit — no LLM, instant reply
    if _is_greeting(message):
        reply = _greeting_reply(lang)
        append_context(session, "assistant", reply, MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {"reply": reply, "buttons": None, "mode": "general"}

    # Single LLM call
    if not _llm_available():
        # Try DB category fallback before giving up
        cat_id = _detect_category_in_message(message)
        if cat_id:
            cat_resp = _build_category_db_reply(cat_id, lang)
            if cat_resp:
                append_context(session, "assistant", cat_resp["reply"], MAX_CONTEXT_MESSAGES)
                save_session(session_id, session)
                return {**cat_resp, "offer_continue": None}
        reply = _forward_msg(lang)
        append_context(session, "assistant", reply, MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {"reply": reply, "buttons": None, "mode": "general"}

    result = _llm_respond(message, session.get("recent_context", []), lang)
    reply = (result.get("reply") or "").strip()
    action = result.get("action") or ""

    if not reply:
        # LLM failed (rate limit / error) — try DB fallback
        cat_id = _detect_category_in_message(message)
        if cat_id:
            cat_resp = _build_category_db_reply(cat_id, lang)
            if cat_resp:
                append_context(session, "assistant", cat_resp["reply"], MAX_CONTEXT_MESSAGES)
                save_session(session_id, session)
                return {**cat_resp, "offer_continue": None}
        reply = _forward_msg(lang)

    # Offer yes/no before starting flow (user browsed a category)
    if action.startswith("offer_recommendation:"):
        category_id = action.split(":", 1)[1].strip()
        cat = get_category_by_id(category_id)
        if cat and cat.get("has_recommendation"):
            yes_label = {"he": "כן, עזרי לי לבחור 💛", "ar": "نعم، ساعديني في الاختيار 💛", "en": "Yes, help me choose 💛"}.get(lang, "כן, עזרי לי לבחור 💛")
            no_label  = {"he": "לא תודה 😊",            "ar": "لا شكراً 😊",                 "en": "No thanks 😊"}.get(lang, "לא תודה 😊")
            buttons = [
                {"label": yes_label, "value": f"__start_flow__:{category_id}", "question_id": None, "terminal_treatment_id": None},
                {"label": no_label,  "value": "__no_recommendation__",          "question_id": None, "terminal_treatment_id": None},
            ]
            append_context(session, "assistant", reply, MAX_CONTEXT_MESSAGES)
            save_session(session_id, session)
            return {"reply": reply, "buttons": buttons, "mode": "general"}

    # Start flow immediately (user explicitly asked for recommendation)
    if action.startswith("start_flow:"):
        category_id = action.split(":", 1)[1].strip()
        cat = get_category_by_id(category_id)
        if cat and cat.get("has_recommendation"):
            session["mode"] = "in_flow"
            session["flow_category_id"] = category_id
            session["flow_question_index"] = 0
            session["flow_scores"] = {}
            session["flow_answers"] = []
            first_q = build_question_response(category_id, 0)
            if first_q:
                intro = format_intro(cat, lang)
                flow_reply = intro + "\n\n" + first_q["question_text"]
                append_context(session, "assistant", flow_reply, MAX_CONTEXT_MESSAGES)
                save_session(session_id, session)
                return {
                    "reply": flow_reply,
                    "buttons": first_q["buttons"],
                    "offer_continue": None,
                    "mode": "in_flow",
                    "question_progress": {"current": 1, "total": first_q["total_questions"]},
                }

    append_context(session, "assistant", reply, MAX_CONTEXT_MESSAGES)
    save_session(session_id, session)
    return {"reply": reply, "buttons": None, "mode": "general"}


# ── Main entry point ──────────────────────────────────────────────────────────

def handle_message(
    session_id: str,
    message: Optional[str] = None,
    button_value: Optional[str] = None,
    question_id: Optional[str] = None,
) -> dict:
    session = get_session(session_id)
    mode = session.get("mode", "general")

    # Special control buttons
    if button_value == "__continue__":
        session["mode"] = "in_flow"
        save_session(session_id, session)
        return _build_flow_reply(session, session_id)

    if button_value == "__restart__":
        session["mode"] = "in_flow"
        session["flow_question_index"] = 0
        session["flow_scores"] = {}
        session["flow_answers"] = []
        save_session(session_id, session)
        return _build_flow_reply(session, session_id)

    if button_value == "__not_now__":
        lang = _detect_language(message or "")
        session["mode"] = "general"
        session["flow_category_id"] = None
        session["flow_question_index"] = 0
        session["flow_scores"] = {}
        session["flow_answers"] = []
        save_session(session_id, session)
        return {"reply": _not_now_msg(lang), "buttons": None, "offer_continue": None, "mode": "general"}

    # "Yes, help me choose" button from the offer_recommendation yes/no pair
    if button_value and button_value.startswith("__start_flow__:"):
        lang = _detect_language(message or "")
        category_id = button_value.split(":", 1)[1].strip()
        cat = get_category_by_id(category_id)
        if cat and cat.get("has_recommendation"):
            session["mode"] = "in_flow"
            session["flow_category_id"] = category_id
            session["flow_question_index"] = 0
            session["flow_scores"] = {}
            session["flow_answers"] = []
            save_session(session_id, session)
            return _build_flow_reply(session, session_id)
        return {"reply": _forward_msg(lang), "buttons": None, "offer_continue": None, "mode": "general"}

    # "No thanks" button from the offer_recommendation yes/no pair
    if button_value == "__no_recommendation__":
        lang = _detect_language(message or "")
        msgs = {
            "he": "בסדר גמור! 😊 אם תרצי עזרה בבחירה בעתיד — אני כאן.",
            "ar": "حسناً! 😊 إذا أردت مساعدة لاحقاً في الاختيار — أنا هنا.",
            "en": "No problem! 😊 I'm here whenever you need help choosing.",
        }
        return {"reply": msgs.get(lang, msgs["he"]), "buttons": None, "offer_continue": None, "mode": "general"}

    # In-flow: button → advance flow
    if mode == "in_flow" and button_value and question_id:
        return _handle_flow_button(session, session_id, button_value, question_id)

    # In-flow: free text → exit flow, answer normally, then offer Continue
    if mode == "in_flow" and message:
        session["mode"] = "general"
        save_session(session_id, session)
        result = _route_general(session, session_id, message)
        result["offer_continue"] = _make_continue_offer(session)
        return result

    # General mode
    if message:
        result = _route_general(session, session_id, message)
        result["offer_continue"] = _make_continue_offer(session)
        return result

    return {"reply": _forward_msg("he"), "buttons": None, "offer_continue": None, "mode": "general"}
