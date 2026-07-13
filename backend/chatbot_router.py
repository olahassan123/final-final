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
from groq import Groq

from chatbot_config import (
    CONFIDENCE_THRESHOLD, MAX_CONTEXT_MESSAGES,
    CLINIC_PHONE, GROQ_MODEL, SYSTEM_PROMPT,
)
from chatbot_db import (
    get_session, save_session, append_context,
    get_faq_entries, get_faq_by_id, get_categories, get_category_by_id,
    get_treatment_by_id, get_all_treatments_summary, get_treatments_in_category,
    get_forward_topics,
)
from chatbot_flow import (
    build_question_response, apply_score, get_top_treatments,
    get_base_treatment, format_recommendation_text,
    format_terminal_text, format_intro,
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


# Treatment duration/time questions → forwarded to the clinic (never answered).
_DURATION_KW = [
    "כמה זמן לוקח", "כמה זמן אורך", "כמה זמן נמשך", "כמה זמן הטיפול", "כמה זמן זה לוקח",
    "כמה זמן ייקח", "כמה זמן ייקח הטיפול", "משך הטיפול", "משך זמן הטיפול", "כמה זמן אורך הטיפול",
    "how long does it take", "how long is the treatment", "how long will it take",
    "treatment duration", "duration of the treatment",
    "كم يستغرق", "مدة العلاج", "كم مدة العلاج", "كم يأخذ العلاج",
]
_DURATION_EXCLUDE = ["מחזיק", "נשמר", "התוצאה", "results last", "how long do results", "تدوم"]


def _is_duration_question(msg: str) -> bool:
    ml = (msg or "").lower()
    if any(k in ml for k in _DURATION_EXCLUDE):  # "how long do results last" is different
        return False
    return any(k in ml for k in _DURATION_KW)


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


def _duration_msg(lang: str = "he") -> str:
    msgs = {
        "he": f"משך הטיפול משתנה לפי סוג הטיפול וההתאמה האישית 😊\nהצוות שלנו ב-{CLINIC_PHONE} או בוואטסאפ ישמח למסור לך את הפרטים המדויקים!",
        "ar": f"مدة العلاج تختلف حسب نوعه والتناسب الشخصي 😊\nفريقنا على {CLINIC_PHONE} أو واتساب سيسعد بإعطائك التفاصيل الدقيقة!",
        "en": f"Treatment length varies by type and personal fit 😊\nOur team at {CLINIC_PHONE} or WhatsApp will gladly give you the exact details!",
    }
    return msgs.get(lang, msgs["he"])


def _forward_msg(lang: str = "he") -> str:
    msgs = {
        "he": f"זה משהו שהצוות שלנו יוכל לעזור לך בו הכי טוב 😊\nניתן ליצור קשר בטלפון {CLINIC_PHONE} או בוואטסאפ.",
        "ar": f"فريقنا سيكون سعيداً للمساعدة في هذا الأمر 😊\nيمكنك التواصل عبر {CLINIC_PHONE} أو واتساب.",
        "en": f"That's best answered by our team directly 😊\nReach them at {CLINIC_PHONE} or via WhatsApp.",
    }
    return msgs.get(lang, msgs["he"])


def _out_of_scope_reply(lang: str = "he") -> dict:
    """For questions unrelated to the clinic: a short in-frame decline. No chips,
    and we do NOT forward random topics to the phone."""
    msgs = {
        "he": "אני כאן כדי לעזור עם כל מה שקשור ל-MeDay — טיפולים, שירותים ומידע על המכון 😊 במה אוכל לעזור לך?",
        "ar": "أنا هنا للمساعدة في كل ما يتعلق بـ MeDay — العلاجات والخدمات ومعلومات المركز 😊 كيف يمكنني مساعدتك؟",
        "en": "I'm here to help with anything about MeDay — treatments, services and clinic info 😊 How can I help you?",
    }
    return {"reply": msgs.get(lang, msgs["he"]), "buttons": None, "mode": "general", "no_suggest": True}


def _match_forward_topic(message: str):
    """True for clinic matters that need a human (medical suitability, complaints,
    appointment availability). Price/duration are handled by their own guards."""
    ml = (message or "").lower()
    for tp in get_forward_topics():
        if tp.get("topic_id") == "FWD-01":  # price → own guard
            continue
        for p in (tp.get("example_phrasings") or "").split(","):
            p = p.strip()
            if len(p) >= 4 and p.lower() in ml:
                return tp
    return None


def _not_now_msg(lang: str = "he") -> str:
    msgs = {
        "he": "בסדר גמור! אם תרצי עזרה בעתיד, אני כאן 😊",
        "ar": "حسناً! إذا احتجت مساعدة لاحقاً، أنا هنا 😊",
        "en": "No problem! I'm here whenever you need help 😊",
    }
    return msgs.get(lang, msgs["he"])


# ── Treatment detail block (data the LLM answers from) ───────────────────────

# label shown in prompt → treatment column
_DETAIL_FIELDS = [
    ("מתאים ל", "good_for"),
    ("שיטה/מכשור", "technique_or_equipment"),
    ("מה מרגישים", "pain_level"),
    ("החלמה", "downtime"),
    ("הכנה", "preparation"),
    ("אחרי הטיפול", "aftercare"),
    ("מספר טיפולים", "sessions_recommended"),
    ("משך התוצאה", "results_longevity"),
    ("מה קורה בטיפול", "what_to_expect"),
]


def _has_detail(t: dict) -> bool:
    """True if the treatment carries real attributes the LLM can describe from.
    A generic short_description alone does NOT count — the LLM never sees it, so
    such treatments stay marked [name only] and the bot won't invent specifics."""
    return any(t.get(col) for _, col in _DETAIL_FIELDS)


def _build_detail_block(treatments: list) -> str:
    """Compact per-treatment attribute block. Only non-empty fields are emitted."""
    lines = []
    for t in treatments:
        parts = []
        for label, col in _DETAIL_FIELDS:
            val = t.get(col)
            if not val:
                continue
            parts.append(f"{label}: {val}")
        if not parts:
            continue
        lines.append(f"■ {t['treatment_name']} ({t['category_id']})\n  " + " | ".join(parts))
    return "\n".join(lines)


# ── Soft guidance: suggestion chips (send free text, non-binding) ────────────
# These steer the user toward paths the bot answers well, WITHOUT forcing a
# choice — clicking one just sends that text like the user typed it. Deterministic
# (no LLM), so they add zero cost and no new failure mode.

def _L(d: dict, lang: str) -> str:
    return d.get(lang, d["he"])


_SG_CHOOSE = {
    "CAT-03": {"he": "עזרי לי לבחור טיפול פנים", "ar": "ساعديني في اختيار علاج للوجه", "en": "Help me choose a facial"},
    "CAT-04": {"he": "עזרי לי לבחור עיסוי", "ar": "ساعديني في اختيار مساج", "en": "Help me choose a massage"},
}
_SG_COMPARE  = {"he": "מה ההבדל בין הטיפולים?", "ar": "ما الفرق بين العلاجات؟", "en": "What's the difference between them?"}
_SG_TREATMENTS = {"he": "מה הטיפולים שלכם?", "ar": "ما هي علاجاتكم؟", "en": "What treatments do you offer?"}
_SG_HOURS = {"he": "שעות פתיחה ומיקום", "ar": "ساعات العمل والموقع", "en": "Hours & location"}
_SG_BOOK  = {"he": "איך מתאמים תור?", "ar": "كيف أحجز موعد؟", "en": "How do I book?"}
_SG_PREP  = {"he": "איך מתכוננים לטיפול?", "ar": "كيف أستعد للعلاج؟", "en": "How do I prepare?"}
_SG_AFTER = {"he": "מה עושים אחרי הטיפול?", "ar": "ماذا أفعل بعد العلاج؟", "en": "What should I do afterwards?"}


# Distinctive subgroup names — when one is mentioned the topic is narrower than a
# category, so we show no navigational guidance (per guidance policy).
_SUBGROUP_KW = [
    "בנייה ומילוי", "תוספות ועיצוב", "עיסוי גוף", "עיסוי ממוקד", "עיסויים מיוחדים",
    "תיחום עיניים", "טיפוח גבות וריסים", "הזרקות בוטוקס", "פילרים", "ביוסטימולטורים",
    "מניקור", "פדיקור", "קלאסיים", "מפנקים", "טכנולוגיים",
]


def _detect_subgroup(message: str) -> bool:
    ml = message or ""
    return any(k in ml for k in _SUBGROUP_KW)


# Subgroup index (subgroup name → category), built once from the DB.
_SUBGROUP_INDEX = None
_GENERIC_SUB = {"נשים", "גברים", "ילדים", "ראש"}  # too generic to match on safely


def _subgroup_index():
    global _SUBGROUP_INDEX
    if _SUBGROUP_INDEX is None:
        idx, seen = [], set()
        for c in get_categories():
            for t in get_treatments_in_category(c["category_id"]):
                sg = t.get("subgroup")
                if sg and (sg, c["category_id"]) not in seen:
                    seen.add((sg, c["category_id"]))
                    idx.append((sg, c["category_id"]))
        _SUBGROUP_INDEX = idx
    return _SUBGROUP_INDEX


def _find_subgroup(message: str):
    """Match the message against a real subgroup name (longest key wins)."""
    ml = message or ""
    best = None
    for sg, cid in _subgroup_index():
        key = sg.split(" (")[0].strip()  # drop parentheticals like "(תור כל 6 שבועות)"
        if key in _GENERIC_SUB or len(key) < 4:
            continue
        if key in ml and (best is None or len(key) > len(best[2])):
            best = (sg, cid, key)
    return best


_CMP_KW = ["הבדל", "עדיף", " מול ", "difference", "versus", " vs ", "الفرق"]


def _build_subgroup_reply(message: str, lang: str):
    """List a specific subgroup's treatments. No guidance chips (per policy)."""
    if any(k in (message or "").lower() for k in _CMP_KW):
        return None  # comparisons are the LLM's job, not a plain listing
    found = _find_subgroup(message)
    if not found:
        return None
    sg, cid, key = found
    names = [t["treatment_name"] for t in get_treatments_in_category(cid)
             if t.get("subgroup") == sg and t.get("treatment_name")]
    if not names:
        return None
    t_list = "\n".join(f"• {n}" for n in names)
    intro = {
        "he": f"הנה הטיפולים שלנו בקבוצת {key}:\n\n{t_list}",
        "ar": f"هذه علاجاتنا في مجموعة {key}:\n\n{t_list}",
        "en": f"Here are our treatments in {key}:\n\n{t_list}",
    }
    return {"reply": intro.get(lang, intro["he"]), "buttons": None,
            "mode": "general", "no_suggest": True}


# ── Comparison: "what's the difference between them / X and Y?" ───────────────
_COMPARE_KW = [
    "מה ההבדל", "מה הבדל", "ההבדל בין", "הבדל בין", "הבדל ביניהם", "במה שונ",
    "מה עדיף", "איזה עדיף", "מה ההבדלים", "להשוות", "השוואה",
    "difference between", "what's the difference", "compare", "which is better", "vs ",
    "الفرق بين", "ما الفرق", "أيهما أفضل", "ايهما افضل", "المقارنة",
]


def _is_comparison(message: str) -> bool:
    ml = (message or "").lower()
    return any(k in ml for k in _COMPARE_KW)


def _build_comparison(message: str, session: dict, lang: str):
    """Compare the treatments in the category/subgroup just discussed (resolves
    'them' via recent context), showing each one's purpose from existing data."""
    ctx = " ".join(m.get("content", "") for m in session.get("recent_context", [])
                   if m.get("role") == "assistant")
    # Subgroup only from the explicit message — category descriptions mention
    # subgroup words, which would wrongly narrow a category comparison.
    sub = _find_subgroup(message)
    if sub:
        sg, cid, title = sub
        treatments = [t for t in get_treatments_in_category(cid)
                      if t.get("subgroup") == sg and t.get("treatment_name")]
    else:
        cat = _detect_category_in_message(message) or _detect_category_in_message(ctx)
        if not cat:
            return None
        c = get_category_by_id(cat)
        title = c["category_name"] if c else ""
        treatments = [t for t in get_treatments_in_category(cat) if t.get("treatment_name")]
    if len(treatments) < 2:
        return None
    lines = []
    for t in treatments:
        desc = t.get("good_for") or t.get("short_description") or t.get("what_to_expect") or ""
        lines.append(f"• **{t['treatment_name']}** — {desc}" if desc else f"• **{t['treatment_name']}**")
    body = "\n".join(lines)
    intro = {
        "he": f"הנה במה נבדלים הטיפולים ב{title}:\n\n{body}",
        "ar": f"إليك كيف تختلف العلاجات في {title}:\n\n{body}",
        "en": f"Here's how the treatments in {title} differ:\n\n{body}",
    }
    return {"reply": intro.get(lang, intro["he"]), "buttons": None,
            "mode": "general", "no_suggest": True}


def _general_suggestions(message: str, lang: str):
    """Guidance policy:
      • rec category  → offer to recommend
      • non-rec category or a subgroup → no guidance
      • no specific topic (general) → entry chips into the recommendation flows
    Never suggests booking / contact / price (those are handoffs, not guidance)."""
    if _detect_subgroup(message):
        return None
    cat = _detect_category_in_message(message or "")
    if cat:
        c = get_category_by_id(cat)
        if c and c.get("has_recommendation") and cat in _SG_CHOOSE:
            return [_L(_SG_CHOOSE[cat], lang)]
        return None  # non-rec category → no guidance
    return [_L(_SG_TREATMENTS, lang), _L(_SG_CHOOSE["CAT-03"], lang), _L(_SG_CHOOSE["CAT-04"], lang)]


def _after_reco_suggestions(lang: str) -> list:
    # Prep / aftercare only — both answerable from data. No booking chip.
    return [_L(_SG_PREP, lang), _L(_SG_AFTER, lang)]


def _is_handoff_reply(reply: str) -> bool:
    """A pure 'contact the team' reply (forward / price / booking / contact FAQ).
    Guidance chips are never attached to these — the reply is itself the endpoint."""
    if not reply:
        return False
    r = reply.strip()
    for lg in ("he", "ar", "en"):
        if r in (_price_msg(lg).strip(), _duration_msg(lg).strip(),
                 _forward_msg(lg).strip(), _not_now_msg(lg).strip()):
            return True
    f15 = get_faq_by_id("FAQ-15")  # "how to book / contact" → *3691
    return bool(f15 and f15["answer"].strip() in r)


# ── Category picker: bridges a general "help me choose" → a specific flow ─────
# The recommendation flow is per-category. When the user wants a recommendation
# but hasn't said which area, we must NOT dead-end on free-text "yes" — we show
# buttons for the flow-enabled categories and let the existing __start_flow__
# handler take over. Data-driven: adding a category with has_recommendation=1
# makes it appear here automatically.

_PICKER_LABELS = {
    "CAT-03": {"he": "טיפולי פנים ✨", "ar": "علاجات الوجه ✨", "en": "Facial treatments ✨"},
    "CAT-04": {"he": "עיסוי / טיפולי גוף 💆", "ar": "مساج / علاجات الجسم 💆", "en": "Massage / body 💆"},
}


def _rec_category_buttons(lang: str) -> list:
    buttons = []
    for c in get_categories():
        if not c.get("has_recommendation"):
            continue
        cid = c["category_id"]
        label = _PICKER_LABELS.get(cid, {}).get(lang) or c["category_name"]
        buttons.append({
            "label": label,
            "value": f"__start_flow__:{cid}",
            "question_id": None,
            "terminal_treatment_id": None,
        })
    return buttons


def _category_picker_reply(lang: str, reply_text: str = "") -> dict:
    prompts = {
        "he": "בשמחה! באיזה תחום תרצי שאמליץ לך? 💛",
        "ar": "بكل سرور! في أي مجال تريدين أن أنصحك؟ 💛",
        "en": "Happy to help! Which area would you like a recommendation for? 💛",
    }
    return {
        "reply": reply_text or prompts.get(lang, prompts["he"]),
        "buttons": _rec_category_buttons(lang),
        "mode": "general",
    }


# ── Affirmation safety net (catches "yes" after a recommendation offer) ───────

_AFFIRM_WORDS = {
    "כן", "כן בבקשה", "בבקשה", "בטח", "אשמח", "כן תעזרי", "כן תעזור לי", "כן תעזור",
    "סבבה", "אוקיי כן", "כן בטח", "יאללה", "ברור",
    "yes", "yes please", "sure", "ok yes", "okay yes", "please", "yeah", "yep", "ying",
    "نعم", "أكيد", "نعم من فضلك", "من فضلك", "اي", "ايوة", "ايوه",
}

# Words that mark the previous bot turn as a "want a recommendation?" offer.
_OFFER_KW = ["לבחור", "להמליץ", "המלצה", "אמליץ", "מתאים ביותר",
             "choose", "recommend", "اختيار", "أنصح", "الأنسب"]


def _is_affirmation(msg: str) -> bool:
    low = (msg or "").strip().lower().rstrip("!.,?ـ")
    return low in _AFFIRM_WORDS


def _last_assistant_offered(session: dict) -> bool:
    for m in reversed(session.get("recent_context", [])):
        if m.get("role") == "assistant":
            txt = m.get("content") or ""
            return any(k in txt for k in _OFFER_KW)
    return False


# Markers that a reply is admitting it lacks the answer (vs. a real catalog answer).
_NODATA_KW = [
    "לא מופיע", "לא כאן", "אין לי", "אינני", "לא זמין", "לא מפורט",
    "لا تظهر", "غير متوفر", "لا يوجد لدي", "لا تتوفر",
    "don't appear", "do not appear", "not here", "not available", "i don't have",
]


# ── "What do you offer?" — deterministic catalog (never depends on the LLM) ──

_OFFER_Q_KW = [
    "מה אתם מציעים", "מה יש לכם", "מה אתם עושים", "אילו טיפולים", "איזה טיפולים",
    "מה הטיפולים", "מה השירותים", "אילו שירותים", "איזה שירותים", "הטיפולים שלכם",
    "what do you offer", "what do you have", "what treatments", "which treatments",
    "your treatments", "services do you", "what services",
    "ماذا تقدمون", "ما هي علاجاتكم", "شو عندكم", "ايش عندكم", "ما هي خدماتكم", "شو بتقدموا",
]


def _is_whats_offered(msg: str) -> bool:
    ml = (msg or "").lower()
    return any(k in ml for k in _OFFER_Q_KW)


def _build_catalog_overview(lang: str) -> dict:
    """List every category from the DB — a correct answer with zero LLM reliance.
    Chips are the category names: clicking one shows that category's description."""
    names = [c["category_name"] for c in get_categories() if c.get("category_name")]
    lst = "\n".join(f"• {n}" for n in names)
    intro = {
        "he": f"בשמחה! הנה התחומים שאנחנו מציעים ב-MeDay:\n\n{lst}\n\nבחרי תחום כדי לשמוע עליו עוד 💛",
        "ar": f"بكل سرور! هذه هي المجالات التي نقدمها في MeDay:\n\n{lst}\n\nاختاري مجالاً لمعرفة المزيد عنه 💛",
        "en": f"Happy to help! Here's what we offer at MeDay:\n\n{lst}\n\nPick an area to hear more about it 💛",
    }
    return {
        "reply": intro.get(lang, intro["he"]),
        "buttons": None,
        "mode": "general",
        "suggestions": names,  # one chip per category → clicking shows its description
    }


def _match_category_by_name(message: str):
    """Return the category whose name the message EXACTLY is (i.e. a category chip
    was clicked, or the user typed the category name)."""
    m = (message or "").strip().rstrip("?.!,،؟ ")
    for c in get_categories():
        if m == (c.get("category_name") or "").strip():
            return c
    return None


def _catalog_deflection(reply: str) -> bool:
    """True when a reply pads a no-data answer with the full service catalog.
    Requires BOTH: 4+ category names present AND a 'no info / go to team' marker.
    A genuine 'what do you offer?' answer lists categories but has no such marker."""
    if not reply:
        return False
    names = [c["category_name"] for c in get_categories()]
    hits = sum(1 for n in names if n and n in reply)
    if hits < 4:
        return False
    low = reply.lower()
    if CLINIC_PHONE in reply:
        return True
    return any(k in reply or k in low for k in _NODATA_KW)


# ── Deterministic intent layer (context-aware; works even if the LLM is down) ─

def _rec_category_ids() -> list:
    return [c["category_id"] for c in get_categories() if c.get("has_recommendation")]


_RECOMMEND_KW = [
    "תמליצי", "תמליץ", "המלצה", "המלצי", "עזרי לי לבחור", "עזור לי לבחור", "עזרו לי לבחור",
    "לבחור טיפול", "מה מתאים לי", "איזה טיפול מתאים", "מה הכי מתאים", "לבחור לי", "תעזרי לי לבחור",
    "recommend", "help me choose", "which treatment", "what suits me", "help me pick",
    "أنصحيني", "انصحيني", "ساعديني في الاختيار", "ساعدني في الاختيار", "شو يناسبني", "ايش يناسبني",
]


def _is_recommend_intent(message: str) -> bool:
    ml = (message or "").lower()
    return any(k in ml for k in _RECOMMEND_KW)


_ABOUT_VERBS = [
    "תסביר", "תסבירי", "ספר לי", "ספרי לי", "הסבר", "הסברי", "רוצה לשמוע", "פרטי לי", "פרט לי",
    "מה זה", "מה הם", "מה כולל", "רשימת",
    "tell me about", "explain", "about your", "more about", "list of", "what are your",
    "احكي", "خبريني", "احكيلي", "اشرحي", "ما هي",
]


def _is_about_treatments(message: str) -> bool:
    """'explain/tell me about the treatments/services' — general or per-category."""
    ml = (message or "").lower()
    has_word = ("טיפול" in message or "שירות" in message or "treatment" in ml
                or "service" in ml or "علاج" in message or "خدم" in message)
    return has_word and any(v in ml for v in _ABOUT_VERBS)


# Logistics FAQs answered straight from the DB — must never depend on the LLM.
_LOGISTICS = [
    ("FAQ-13", ["שעות", "מתי אתם פתוחים", "מתי פתוח", "פתוחים", "שעות פתיחה", "שעות פעילות",
                "hours", "open", "opening", "ساعات", "متى تفتح", "الدوام", "دوام"]),
    ("FAQ-14", ["כתובת", "מיקום", "איפה אתם", "איפה ממוקם", "היכן", "מיקום המכון",
                "address", "location", "where are you", "where is", "العنوان", "الموقع", "وين", "اين"]),
    ("FAQ-15", ["לתאם תור", "לקבוע תור", "ליצור קשר", "איך מתאמים", "איך קובעים", "מספר טלפון",
                "book", "appointment", "contact", "phone", "احجز", "حجز", "موعد", "تواصل", "رقم"]),
]


def _match_logistics_faq(message: str):
    ml = (message or "").lower()
    answers = []
    for fid, kws in _LOGISTICS:
        if any(k.lower() in ml for k in kws):
            f = get_faq_by_id(fid)
            if f and f["answer"] not in answers:
                answers.append(f["answer"])
    return "\n".join(answers) if answers else None


def _match_faq(message: str):
    """Best-effort FAQ match by phrase substring (fallback use). Conservative."""
    ml = (message or "").lower()
    best, best_score = None, 0
    for f in get_faq_entries():
        phrases = []
        if f.get("canonical_question"):
            phrases.append(f["canonical_question"])
        if f.get("example_phrasings"):
            phrases += f["example_phrasings"].split(",")
        score = sum(1 for p in phrases if len(p.strip()) >= 5 and p.strip().lower() in ml)
        if score > best_score:
            best_score, best = score, f
    return best["answer"] if best and best_score >= 1 else None


def _match_treatment(message: str):
    """Return the treatment whose name/alias appears in the message (longest wins).
    Min length 5 avoids short body-part names (e.g. "פנים", "גבות") colliding with
    category phrases like "טיפולי פנים". Also skips a name right after "טיפול/טיפולי",
    which signals a category ("facial treatments"), not that specific treatment."""
    ml = (message or "").lower()
    best, best_len = None, 0
    for t in get_all_treatments_summary():
        cands = [t.get("treatment_name") or ""]
        if t.get("aliases"):
            cands += t["aliases"].split(",")
        for c in cands:
            c = c.strip()
            if len(c) < 5 or c.lower() not in ml or len(c) <= best_len:
                continue
            if f"טיפולי {c}" in message or f"טיפול {c}" in message:
                continue  # category phrase, not a specific treatment
            best, best_len = t, len(c)
    return get_treatment_by_id(best["treatment_id"]) if best else None


def _treatment_card(t: dict, lang: str) -> Optional[dict]:
    """A concise, data-only description of one treatment."""
    if not (t.get("short_description") or t.get("good_for") or t.get("what_to_expect")):
        return None
    lines = [f"**{t['treatment_name']}**"]
    desc = t.get("short_description") or t.get("what_to_expect")
    if desc:
        lines.append(desc)
    if t.get("good_for"):
        lines.append(_L({"he": f"מתאים ל: {t['good_for']}", "ar": f"مناسب لـ: {t['good_for']}",
                         "en": f"Good for: {t['good_for']}"}, lang))
    # Duration intentionally omitted — treatment time is forwarded, never shown.
    return {
        "reply": "\n".join(lines),
        "buttons": None,
        "mode": "general",
        "suggestions": _treatment_followups(t, lang),
        "last_treatment_id": t["treatment_id"],
        "no_suggest": True,  # only treatment field chips here — no general nav chips
    }


# Per-field follow-up questions. Chips are offered ONLY for fields a treatment
# actually has, and clicking one is answered straight from that field — so a
# guidance option can never lead to an empty cell / hallucination.
_FIELD_Q = {
    "pain_level":        {"he": "האם זה כואב?", "ar": "هل هو مؤلم؟", "en": "Does it hurt?"},
    "preparation":       {"he": "איך מתכוננים לטיפול?", "ar": "كيف أستعد؟", "en": "How do I prepare?"},
    "aftercare":         {"he": "מה עושים אחרי הטיפול?", "ar": "ماذا بعد العلاج؟", "en": "Aftercare?"},
    "downtime":          {"he": "יש זמן החלמה?", "ar": "هل هناك فترة نقاهة؟", "en": "Any downtime?"},
    "results_longevity": {"he": "כמה זמן מחזיקה התוצאה?", "ar": "كم تدوم النتيجة؟", "en": "How long do results last?"},
}

_FIELD_KW = {
    # Note: Hebrew final letters (ן/נ ם/מ) differ, so use stems without a final
    # letter (e.g. "מתכונ") to match both singular and plural forms.
    "pain_level":        ["כואב", "כאב", "מכאיב", "hurt", "pain", "مؤلم", "يوجع"],
    "preparation":       ["מתכונ", "הכנה", "לפני הטיפול", "להתכונן", "prepare", "before the treatment", "تحضير", "قبل العلاج", "استعد"],
    "aftercare":         ["אחרי הטיפול", "טיפוח אחרי", "מה עושים אחרי", "מה לעשות אחרי", "aftercare", "after the treatment", "بعد العلاج"],
    "downtime":          ["זמן החלמה", "החלמה", "downtime", "recovery", "نقاهة", "تعافي"],
    "results_longevity": ["כמה זמן מחזיק", "כמה זמן נשמר", "כמה מחזיק", "התוצאה נשמר", "results last", "how long do results", "تدوم", "كم تدوم"],
}

# Guarantee each chip's own text maps back to its field (belt-and-suspenders,
# independent of the free-text keyword heuristics above).
for _f, _q in _FIELD_Q.items():
    for _lg in ("he", "ar", "en"):
        _FIELD_KW[_f].append(_q[_lg].lower().rstrip("?").strip())


def _detect_field(message: str) -> Optional[str]:
    ml = (message or "").lower()
    for field, kws in _FIELD_KW.items():
        if any(k in ml for k in kws):
            return field
    return None


def _treatment_followups(t: dict, lang: str, exclude=None) -> Optional[list]:
    """Chips only for fields this treatment has and that haven't been answered yet.
    `exclude` is a set/list of already-answered field names (stops the chip loop)."""
    done = set(exclude or ())
    order = ["pain_level", "preparation", "aftercare", "downtime", "results_longevity"]
    chips = [_L(_FIELD_Q[f], lang) for f in order if f not in done and t.get(f)]
    return chips[:3] or None


def _format_field_answer(t: dict, field: str, lang: str) -> str:
    return f"**{t['treatment_name']}** — {t.get(field)}"


def _begin_flow(session: dict, session_id: str, category_id: str, lang: str) -> Optional[dict]:
    """Start the recommendation flow for a category (shared by LLM + deterministic paths)."""
    cat = get_category_by_id(category_id)
    if not (cat and cat.get("has_recommendation")):
        return None
    session["mode"] = "in_flow"
    session["flow_category_id"] = category_id
    session["flow_question_index"] = 0
    session["flow_scores"] = {}
    session["flow_answers"] = []
    first_q = build_question_response(category_id, 0)
    if not first_q:
        return None
    flow_reply = format_intro(cat, lang) + "\n\n" + first_q["question_text"]
    append_context(session, "assistant", flow_reply, MAX_CONTEXT_MESSAGES)
    save_session(session_id, session)
    return {
        "reply": flow_reply,
        "buttons": first_q["buttons"],
        "offer_continue": None,
        "mode": "in_flow",
        "question_progress": {"current": 1, "total": first_q["total_questions"]},
    }


def _deterministic_fallback(message: str, lang: str) -> Optional[dict]:
    """Best real answer we can give from data when the LLM is unavailable/empty.
    Only forwards as a last resort — never as the default."""
    log = _match_logistics_faq(message)
    if log:
        return {"reply": log, "buttons": None, "mode": "general"}
    ans = _match_faq(message)
    if ans:
        return {"reply": ans, "buttons": None, "mode": "general"}
    # A specific treatment named in the message beats its whole-category list.
    t = _match_treatment(message)
    if t:
        card = _treatment_card(t, lang)
        if card:
            return card
    sub = _build_subgroup_reply(message, lang)
    if sub:
        return sub
    cat_id = _detect_category_in_message(message)
    if cat_id:
        r = _build_category_db_reply(cat_id, lang)
        if r:
            return r
    ml = (message or "").lower()
    if _is_about_treatments(message) or "טיפול" in message or "treatment" in ml or "علاج" in message:
        return _build_catalog_overview(lang)
    # Clinic matter that needs a human (medical/complaint/availability) → forward.
    if _match_forward_topic(message):
        return {"reply": _forward_msg(lang), "buttons": None, "mode": "general"}
    return None  # nothing matched → caller treats it as out of scope


def _attach_suggestions(result: dict, message: str):
    """Add soft suggestion chips to a general reply, unless flow buttons or an
    explicit set already guide the user (avoid clutter / mixed signals)."""
    if result.get("no_suggest") or result.get("buttons") or result.get("suggestions"):
        return
    if result.get("mode") == "in_flow":
        return
    if _is_handoff_reply(result.get("reply", "")):
        return  # don't guide people back into a dead-end handoff
    result["suggestions"] = _general_suggestions(message, _detect_language(message or ""))


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
    detail_treatments = []  # treatments carrying attributes → detail block below
    for c in categories:
        suffix = ""
        if c.get("has_recommendation"):
            suffix = f"  ← ניתן להפעיל שאלון המלצה (action=start_flow:{c['category_id']})"
            rec_ids.append(c["category_id"])
        treatments = get_treatments_in_category(c["category_id"])
        t_names = [t["treatment_name"] for t in treatments if t.get("treatment_name")]
        # Mark which treatments have real detail (that the LLM actually receives)
        # vs. name-only. Based on rich fields, not the generic short_description.
        detailed = {t["treatment_id"] for t in treatments if _has_detail(t)}
        t_parts = []
        for t in treatments:
            if t.get("treatment_name"):
                marker = "" if t["treatment_id"] in detailed else " [שם בלבד]"
                t_parts.append(t["treatment_name"] + marker)
            if t["treatment_id"] in detailed:
                detail_treatments.append(t)
        t_block = ", ".join(t_parts) if t_parts else "—"
        cat_lines.append(f"• [{c['category_id']}] {c['category_name']}{suffix}\n  שירותים: {t_block}")
    cat_block = "\n".join(cat_lines)

    # Detailed attributes — lets the bot answer comparisons, duration, prep,
    # aftercare, pain, downtime etc. strictly from data (no hallucination).
    detail_block = _build_detail_block(detail_treatments)

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
7. להשוואות ("מה ההבדל בין X ל-Y", "מה עדיף"), להכנה, לטיפוח לאחר הטיפול, לתחושה/כאב ולהחלמה — השתמשי אך ורק בפרטי הטיפולים למטה. אם שדה מסוים חסר לטיפול, אמרי שהצוות ישמח להשלים ב-{CLINIC_PHONE}.
   לעולם אל תציני מחיר ואל תציני את משך/זמן הטיפול — לשאלות מחיר או משך זמן הפני ל-{CLINIC_PHONE}.
8. אם השאלה קשורה למכון אך אין לך נתונים (שמות/פרטי עובדים, מידע אישי, נהלים, זמינות תורים, התאמה רפואית) — אל תשלפי את רשימת הקטגוריות כמילוי מקום. הפני בחום ל-{CLINIC_PHONE} וקבעי forward=true.
   אם השאלה כלל אינה קשורה למכון או ליופי (למשל ספורט, חדשות, מזג אוויר, מתמטיקה, שאלות כלליות) — אל תעני עליה ואל תפני לטלפון. השיבי בחום שאת עוזרת רק בנושאי MeDay (טיפולים, שירותים ותורים) ושאלי במה תוכלי לעזור. אל תמציאי תשובה.
9. אם את מציעה עזרה בבחירת טיפול — חובה לצרף action תואם: offer_recommendation:CATEGORY_ID אם התחום ידוע, אחרת offer_pick_category. לעולם אל תסיימי בהצעת בחירה בטקסט חופשי בלי action — אחרת המשתמש עונה "כן" ואין לאן להמשיך.

קטגוריות ושירותים שלנו:
{cat_block}

פרטי טיפולים (למענה על השוואות, משך, הכנה, טיפוח, תחושה והחלמה — מהמידע הזה בלבד):
{detail_block}

שאלות נפוצות ותשובותיהן:
{faq_block}
{ctx_str}

הודעת המשתמש: "{message}"

החזר JSON בלבד:
- "reply": התשובה — חמה, תמציתית, ישירה לנושא. אם שואלים מה אנחנו מציעים — פרט את כל הקטגוריות. סיימי בעדינות בהצעת צעד הבא רלוונטי אחד (למשל להסביר על טיפול, להשוות, או לעזור לבחור) — כהזמנה ולא כלחץ, והלקוח חופשי להתעלם ולשאול כל דבר.
- "action": אחת מהאפשרויות הבאות —
  • null — ברירת מחדל, לא נדרש פעולה
  • "offer_recommendation:CATEGORY_ID" — כאשר המשתמש שואל מה יש בקטגוריה מסוימת שיש לה שאלון (רק: {', '.join(rec_ids) or 'אין'}). פרטי את השירותים בתשובה, וסיימי בשאלה כמו "האם תרצי שאעזור לך לבחור את הטיפול המתאים ביותר?" — אז המערכת תציג כפתורי כן/לא.
  • "offer_pick_category" — כאשר המשתמש רוצה המלצה/עזרה בבחירה אך לא ציין תחום (פנים מול גוף/עיסוי). אל תשאלי בטקסט חופשי איזה תחום — החזירי offer_pick_category והמערכת תציג כפתורי בחירת תחום.
  • "start_flow:CATEGORY_ID" — רק כאשר המשתמש מבקש בפירוש המלצה או עזרה בבחירה והתחום ברור (פנים או גוף/עיסוי). אם הבקשה כללית ("תמליצי לי על טיפול", "עזרי לי לבחור") בלי תחום — השתמשי ב-offer_pick_category, לא ב-start_flow.
- "forward": true רק אם נדרשת התערבות אנושית (שאלה רפואית ספציפית, תלונה, תיאום תור)"""

    try:
        resp = _groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=500,
        )
        data = json.loads(resp.choices[0].message.content)
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
    # Remember the recommended treatment so "does it hurt? / how long?" resolves.
    if top:
        session["last_treatment_id"] = top[0]["treatment_id"]
        session["answered_fields"] = []
    save_session(session_id, session)

    # Follow-up chips reflect only the fields the recommended treatment has, so
    # every chip leads to a real answer. No recommendation → handoff → no chips.
    suggestions = _treatment_followups(top[0], "he") if top else None
    return {"reply": reply, "buttons": None, "offer_continue": None, "mode": "general",
            "suggestions": suggestions}


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
        if t:
            session["last_treatment_id"] = t["treatment_id"]
            session["answered_fields"] = []
        save_session(session_id, session)
        reply = format_terminal_text(t, "he") if t else _forward_msg("he")
        return {"reply": reply, "buttons": None, "offer_continue": None, "mode": "general",
                "suggestions": _treatment_followups(t, "he") if t else None}

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
    desc = cat.get("short_description")
    if desc:
        reply = f"{desc}\n\n{reply}"
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
    # Rec category → yes/no recommend offer above. Non-rec category → no guidance.
    return {"reply": reply, "buttons": buttons, "mode": "general",
            "no_suggest": buttons is None}


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

    # Hard duration guard — treatment time is forwarded, never stated.
    if _is_duration_question(message):
        reply = _duration_msg(lang)
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

    # ── Deterministic intent layer — answers the common intents from data, so
    #    they never depend on the LLM being up. The LLM handles only the rest. ──

    # 1. Explicit recommendation intent → start the right flow, or pick a category.
    if _is_recommend_intent(message):
        cat_id = _detect_category_in_message(message)
        if cat_id in _rec_category_ids():
            flow = _begin_flow(session, session_id, cat_id, lang)
            if flow:
                return flow
        picker = _category_picker_reply(lang)
        append_context(session, "assistant", picker["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return picker

    # 2. Logistics (hours / location / contact) — pure data, common, unambiguous.
    log = _match_logistics_faq(message)
    if log:
        append_context(session, "assistant", log, MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {"reply": log, "buttons": None, "mode": "general"}

    # 2b. Follow-up about a specific attribute ("does it hurt?", "how long?")
    #     of a named or just-discussed treatment → answer from that field only.
    #     Never invents: if the field is empty we fall through to safe handling.
    field = _detect_field(message)
    if field:
        t = _match_treatment(message)
        if not t and session.get("last_treatment_id"):
            t = get_treatment_by_id(session["last_treatment_id"])
        if t and t.get(field):
            ans = _format_field_answer(t, field, lang)
            # Track answered fields per treatment so chips deplete (no loop).
            if session.get("last_treatment_id") != t["treatment_id"]:
                session["answered_fields"] = []
            session["last_treatment_id"] = t["treatment_id"]
            answered = set(session.get("answered_fields") or [])
            answered.add(field)
            session["answered_fields"] = list(answered)
            append_context(session, "assistant", ans, MAX_CONTEXT_MESSAGES)
            save_session(session_id, session)
            return {"reply": ans, "buttons": None, "mode": "general",
                    "suggestions": _treatment_followups(t, lang, exclude=answered),
                    "no_suggest": True}  # field chips only, no general nav chips

    # 2b-cmp. "What's the difference between them?" → compare the treatments in
    #         the category/subgroup just discussed, from their own descriptions.
    if _is_comparison(message):
        comp = _build_comparison(message, session, lang)
        if comp:
            append_context(session, "assistant", comp["reply"], MAX_CONTEXT_MESSAGES)
            save_session(session_id, session)
            return comp

    # 2c. A category chip was clicked (message == category name exactly) → show
    #     its description (+ recommend offer for rec categories). Exact match, so
    #     it must take precedence over subgroup detection below.
    named_cat = _match_category_by_name(message)
    if named_cat:
        resp = _build_category_db_reply(named_cat["category_id"], lang)
        if resp:
            append_context(session, "assistant", resp["reply"], MAX_CONTEXT_MESSAGES)
            save_session(session_id, session)
            return resp

    # 2d. A specific subgroup was named → list just that subgroup, no chips.
    sub = _build_subgroup_reply(message, lang)
    if sub:
        append_context(session, "assistant", sub["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return sub

    # 3. "What do you offer" / "explain the treatments" — category-aware.
    if _is_whats_offered(message) or _is_about_treatments(message):
        cat_id = _detect_category_in_message(message)
        resp = _build_category_db_reply(cat_id, lang) if cat_id else None
        if not resp:
            resp = _build_catalog_overview(lang)
        append_context(session, "assistant", resp["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return resp

    # 4. Bare "yes" right after we offered to help choose → category picker.
    if _is_affirmation(message) and _last_assistant_offered(session):
        picker = _category_picker_reply(lang)
        append_context(session, "assistant", picker["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return picker

    # Single LLM call (only reached for open-ended questions)
    if not _groq_ok():
        resp = _deterministic_fallback(message, lang) or _out_of_scope_reply(lang)
        if resp.get("last_treatment_id"):
            session["last_treatment_id"] = resp["last_treatment_id"]
            session["answered_fields"] = []  # fresh treatment → fresh chips
        append_context(session, "assistant", resp["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {**resp, "offer_continue": None}

    result = _llm_respond(message, session.get("recent_context", []), lang)
    reply = (result.get("reply") or "").strip()
    action = result.get("action") or ""

    if not reply:
        # LLM failed (rate limit / error) — answer from data instead of forwarding.
        resp = _deterministic_fallback(message, lang) or _out_of_scope_reply(lang)
        if resp.get("last_treatment_id"):
            session["last_treatment_id"] = resp["last_treatment_id"]
        append_context(session, "assistant", resp["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return {**resp, "offer_continue": None}

    # No-data guard: don't lead a "we don't have that" answer with the whole
    # service catalog — it reads like padding/hallucination. Replace with a
    # clean warm forward. (Genuine "what do you offer?" answers are untouched.)
    if _catalog_deflection(reply):
        reply = _forward_msg(lang)

    # General "help me choose" with no specific area → show category picker
    if action == "offer_pick_category":
        picker = _category_picker_reply(lang, reply_text=reply)
        append_context(session, "assistant", picker["reply"], MAX_CONTEXT_MESSAGES)
        save_session(session_id, session)
        return picker

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
        flow = _begin_flow(session, session_id, category_id, lang)
        if flow:
            return flow

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
        _attach_suggestions(result, message)
        return result

    # General mode
    if message:
        result = _route_general(session, session_id, message)
        result["offer_continue"] = _make_continue_offer(session)
        _attach_suggestions(result, message)
        return result

    return {"reply": _forward_msg("he"), "buttons": None, "offer_continue": None, "mode": "general"}
