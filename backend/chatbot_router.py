"""
MeDay chatbot router — single-call LLM approach.

Every free-text message goes through ONE LLM call that has full clinic
context (categories + FAQs) and generates the reply directly.  The only
keyword short-circuit kept is the price guard (hard rule, belt-and-suspenders).

Routing for in_flow (recommendation) mode is still button-based and LLM-free.
"""
import os
import json
from typing import Optional
from groq import (
    Groq, APIConnectionError, APITimeoutError, RateLimitError,
    AuthenticationError, APIStatusError, GroqError,
)

from chatbot_config import (
    CONFIDENCE_THRESHOLD, MAX_CONTEXT_MESSAGES,
    CLINIC_PHONE, GROQ_MODEL, SYSTEM_PROMPT,
)
from chatbot_db import (
    get_session, save_session, append_context,
    get_faq_entries, get_categories, get_category_by_id,
    get_treatment_by_id, get_all_treatments_summary,
)
from chatbot_flow import (
    build_question_response, apply_score, get_top_treatments,
    get_base_treatment, format_recommendation_text,
    format_terminal_text, format_intro, format_recommendation_reason,
    find_treatments_by_mention, is_followup_question, is_comparison_request,
    FOLLOWUP_KEYWORDS,
)

_GROQ_KEY = os.getenv("GROQ_API_KEY", "")
_groq = Groq(api_key=_GROQ_KEY) if _GROQ_KEY else None


def _groq_ok() -> bool:
    return bool(_GROQ_KEY and _GROQ_KEY.strip().startswith("gsk_") and _groq)


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


# ── Focused treatment detail (feeds the LLM the real DB fields) ──────────────

_DETAIL_LABELS = [
    ("short_description", "תיאור"),
    ("good_for", "מתאים ל"),
    ("technique_or_equipment", "טכניקה/מכשור"),
]


def _format_treatment_detail_block(t: dict) -> str:
    """Render one treatment's known DB fields, and name which fields are missing
    so the LLM can say 'not documented' instead of guessing."""
    lines = [f"טיפול: {t.get('treatment_name', '')} (id: {t.get('treatment_id', '')})"]
    missing = []
    for key, label in _DETAIL_LABELS:
        val = t.get(key)
        if val:
            lines.append(f"{label}: {val}")
        else:
            missing.append(label)

    if t.get("duration_min"):
        dur = f"{t['duration_min']} דקות"
        if t.get("duration_notes"):
            dur += f" ({t['duration_notes']})"
        lines.append(f"משך הטיפול: {dur}")
    elif t.get("duration_notes"):
        lines.append(f"משך הטיפול: {t['duration_notes']}")
    else:
        missing.append("משך הטיפול")

    if missing:
        lines.append("לא מתועד במערכת עבור טיפול זה: " + ", ".join(missing))
    return "\n".join(lines)


def _build_focus_block(focus_treatments: list, compare_mode: bool) -> str:
    if not focus_treatments:
        return ""
    details = "\n\n".join(_format_treatment_detail_block(t) for t in focus_treatments[:4])
    instruction = (
        "\n\nמידע מפורט על הטיפול/ים שהלקוחה מתעניינת בהם כרגע — זהו המידע היחיד שיש לך עליהם, "
        "השתמשי בו כדי לענות במדויק. אם עובדה ספציפית שנשאלת עליה מסומנת 'לא מתועד', אמרי בבירור "
        "שהיא לא מתועדת אצלכם — אל תמציאי אותה, ואל תפני לקליניקה רק בגלל שהפרט הזה חסר.\n\n" + details
    )
    if compare_mode and len(focus_treatments) >= 2:
        instruction += (
            "\n\nהלקוחה מבקשת להשוות בין הטיפולים הנ\"ל. השוו רק לפי השדות שסופקו למעלה; "
            "אם שדה חסר לאחד הטיפולים, ציינו זאת במפורש במקום לנחש."
        )
    return instruction


# ── Single LLM call: understand + respond ────────────────────────────────────

def _llm_respond(message: str, context: list, lang: str, focus_treatments: list = None, compare_mode: bool = False) -> dict:
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

    focus_block = _build_focus_block(focus_treatments or [], compare_mode)

    prompt = f"""אתה יועצת יופי חכמה של קליניקת MeDay. תפקידך לעזור ללקוחות באמת, לא רק להפנות אותן הלאה.

כללים נוקשים — אסור לעבור עליהם:
1. אל תציין מחירים, עלויות או תעריפים — הפנה תמיד ל-{CLINIC_PHONE}.
2. ענה תמיד באותה שפה שהמשתמש כותב (עברית / ערבית / אנגלית).
3. אל תמציא מידע שלא מופיע כאן. אם עובדה ספציפית לא מתועדת, אמרי זאת בבירור במקום לנחש — וזה לא סיבה
   להפנות לקליניקה, אלא אם מדובר באחד מנושאי ההפניה שמפורטים למטה.
4. אל תתחיל תשובה עם "ב-MeDay" או משפט פתיחה חוזר — ענה ישירות לשאלה.
5. שירות שמסומן [שם בלבד] — אין לך שום פרט עליו מלבד השם. אמרי בחום שהפרטים לא מתועדים אצלך כרגע,
   ואם רלוונטי הציעי שהצוות ב-{CLINIC_PHONE} ישמח להרחיב — אך אל תמציאי תיאור.
6. אם השאלה עמומה (לא ברור על איזה טיפול/אזור בגוף מדובר) — שאלי שאלה מבהירה קצרה אחת, במקום לנחש
   או להפנות.
7. כשאת ממליצה או מתארת טיפול ספציפי, הסבירי בקצרה למה הוא מתאים, על בסיס הנתונים שלו.
8. אם סופק לך למטה "מידע מפורט" על טיפול ספציפי — סימן שהלקוחה שואלת עליו (או ממשיכה לשאול עליו).
   עני עליו ישירות תוך שימוש בנתונים שסופקו. אל תחזירי action=offer_recommendation ואל תיתני סקירה
   כללית של הקטגוריה במקרה כזה — רק אם היא שואלת במפורש מה יש בכל הקטגוריה.
{focus_block}

קטגוריות ושירותים שלנו:
{cat_block}

שאלות נפוצות ותשובותיהן:
{faq_block}
{ctx_str}

הודעת המשתמש: "{message}"

החזר JSON בלבד:
- "reply": התשובה — חמה, בטוחה בעצמה, ישירה לנושא. אם שואלים מה אנחנו מציעים — פרט את כל הקטגוריות.
- "action": אחת מהאפשרויות הבאות —
  • null — ברירת מחדל, לא נדרש פעולה
  • "offer_recommendation:CATEGORY_ID" — כאשר המשתמש שואל מה יש בקטגוריה מסוימת שיש לה שאלון (רק: {', '.join(rec_ids) or 'אין'}). פרטי את השירותים בתשובה, וסיימי בשאלה כמו "האם תרצי שאעזור לך לבחור את הטיפול המתאים ביותר?" — אז המערכת תציג כפתורי כן/לא.
  • "start_flow:CATEGORY_ID" — רק כאשר המשתמש מבקש בפירוש המלצה או עזרה בבחירה ("תמליצי לי", "עזרי לי לבחור", "מה מתאים לי") — לא כאשר הוא רק שואל מה יש.
- "forward": true אך ורק עבור אחד מהנושאים הבאים — (א) מחיר/עלות, (ב) קביעת תור, (ג) התאמה רפואית
  אישית (הריון, תרופות, אלרגיות, "האם זה מתאים/בטוח לי"), (ד) תגובה חריגה או דחופה אחרי טיפול,
  (ה) זמינות תורים בזמן אמת. אל תסמני forward=true רק כי פרט תיאורי חסר — אמרי שהוא לא מתועד."""

    try:
        resp = _groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            # gpt-oss-120b is a reasoning model: some of the budget goes to hidden
            # reasoning tokens before the JSON reply itself. 500 (fine for the old
            # non-reasoning llama model) truncates the JSON on longer answers like
            # a full category listing, so this needs more headroom.
            max_tokens=1500,
            reasoning_effort="low",
        )
        data = json.loads(resp.choices[0].message.content)
        # Safety: strip price info from reply
        reply = data.get("reply") or ""
        return {
            "reply": reply,
            "action": data.get("action") or None,
            "forward": bool(data.get("forward", False)),
        }
    except RateLimitError as e:
        print(f"[chatbot llm error] Groq rate limit hit: {e}")
    except AuthenticationError as e:
        print(f"[chatbot llm error] Groq API key invalid/rejected: {e}")
    except (APIConnectionError, APITimeoutError) as e:
        print(f"[chatbot llm error] Groq unreachable/timed out: {e}")
    except APIStatusError as e:
        print(f"[chatbot llm error] Groq returned HTTP {e.status_code}: {e}")
    except json.JSONDecodeError as e:
        print(f"[chatbot llm error] Groq returned non-JSON content: {e}")
    except GroqError as e:
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
    flow_answers = session.get("flow_answers", [])
    top = get_top_treatments(category_id, scores)

    if not top:
        base = get_base_treatment(category_id)
        top = [base] if base else []

    cat = get_category_by_id(category_id)
    cat_name = cat["category_name"] if cat else ""
    reply = format_recommendation_text(top, "he", cat_name)

    if top:
        reason = format_recommendation_reason(category_id, flow_answers, top[0])
        if reason:
            reply += "\n\n" + reason
        session["last_treatment_id"] = top[0]["treatment_id"]

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
        if t:
            session["last_treatment_id"] = terminal_id
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


_UNTRACKED_FOLLOWUP_NOTE = {
    "he": "לתשומת ליבך: פרטים כמו רמת כאב, זמן החלמה מדויק ומספר הטיפולים הנדרש עדיין לא מתועדים במערכת שלנו — הצוות ישמח לפרט על כך.",
    "ar": "ملاحظة: تفاصيل مثل مستوى الألم ووقت التعافي الدقيق وعدد الجلسات المطلوبة غير موثقة بعد في نظامنا — يسعد فريقنا بتوضيح ذلك.",
    "en": "Note: details like pain level, exact recovery time, and number of sessions needed aren't documented in our system yet — the team can fill you in.",
}

_UNTRACKED_FOLLOWUP_GROUPS = {"pain", "recovery", "sessions"}


def _build_treatment_db_reply(treatments: list, lang: str, message: str = "") -> Optional[dict]:
    """Deterministic (no-LLM) treatment answer straight from the DB fields —
    used when Groq isn't configured or the LLM call failed."""
    if not treatments:
        return None
    field_labels = {
        "he": {"good_for": "מתאים ל", "technique_or_equipment": "טכניקה/מכשור", "duration": "משך"},
        "ar": {"good_for": "مناسب لـ", "technique_or_equipment": "التقنية/الجهاز", "duration": "المدة"},
        "en": {"good_for": "Good for", "technique_or_equipment": "Technique/equipment", "duration": "Duration"},
    }
    labels = field_labels.get(lang, field_labels["he"])
    none_documented = {
        "he": "אין לי כרגע פרטים נוספים על הטיפול הזה במערכת.",
        "ar": "ليس لدي حالياً تفاصيل إضافية عن هذا العلاج في النظام.",
        "en": "I don't have further details on this treatment in the system yet.",
    }.get(lang, "אין לי כרגע פרטים נוספים על הטיפול הזה במערכת.")

    parts = []
    for t in treatments[:3]:
        bits = []
        if t.get("short_description"):
            bits.append(t["short_description"])
        if t.get("good_for"):
            bits.append(f"{labels['good_for']}: {t['good_for']}")
        if t.get("technique_or_equipment"):
            bits.append(f"{labels['technique_or_equipment']}: {t['technique_or_equipment']}")
        if t.get("duration_min"):
            dur = f"{t['duration_min']} min" if lang == "en" else f"{t['duration_min']} דקות"
            if t.get("duration_notes"):
                dur += f" ({t['duration_notes']})"
            bits.append(f"{labels['duration']}: {dur}")
        if not bits:
            bits.append(none_documented)
        parts.append(f"**{t.get('treatment_name', '')}**\n" + "\n".join(bits))

    reply = "\n\n".join(parts)
    low = (message or "").lower()
    asked_untracked = any(
        kw in low for group in _UNTRACKED_FOLLOWUP_GROUPS for kw in FOLLOWUP_KEYWORDS.get(group, [])
    )
    if asked_untracked:
        reply += "\n\n" + _UNTRACKED_FOLLOWUP_NOTE.get(lang, _UNTRACKED_FOLLOWUP_NOTE["he"])

    return {"reply": reply, "buttons": None, "mode": "general"}


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

    # Resolve which treatment(s) this message concerns, so we can hand the LLM
    # (or the no-LLM fallback) the real DB fields instead of just names.
    # A follow-up like "is it painful?" with no treatment named resolves to the
    # last treatment discussed in this session.
    all_treatments = get_all_treatments_summary()
    mentioned = find_treatments_by_mention(message, all_treatments)
    compare_mode = is_comparison_request(message) or len(mentioned) >= 2

    focus_ids = [t["treatment_id"] for t in mentioned]
    if not focus_ids and is_followup_question(message) and session.get("last_treatment_id"):
        focus_ids = [session["last_treatment_id"]]

    focus_treatments = [t for t in (get_treatment_by_id(tid) for tid in focus_ids) if t]
    if focus_treatments:
        session["last_treatment_id"] = focus_treatments[-1]["treatment_id"]

    # Single LLM call
    if not _groq_ok():
        if focus_treatments:
            det_reply = _build_treatment_db_reply(focus_treatments, lang, message)
            if det_reply:
                append_context(session, "assistant", det_reply["reply"], MAX_CONTEXT_MESSAGES)
                save_session(session_id, session)
                return {**det_reply, "offer_continue": None}
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

    result = _llm_respond(message, session.get("recent_context", []), lang, focus_treatments, compare_mode)
    reply = (result.get("reply") or "").strip()
    action = result.get("action") or ""

    if not reply:
        # LLM failed (rate limit / error) — try DB fallback
        if focus_treatments:
            det_reply = _build_treatment_db_reply(focus_treatments, lang, message)
            if det_reply:
                append_context(session, "assistant", det_reply["reply"], MAX_CONTEXT_MESSAGES)
                save_session(session_id, session)
                return {**det_reply, "offer_continue": None}
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
