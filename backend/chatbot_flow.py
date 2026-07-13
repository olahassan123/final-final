"""
Recommendation flow engine.

Handles the in_flow state: presenting questions, scoring answers, and
producing the final recommendation.
"""
from typing import Dict, List, Optional, Tuple
from chatbot_db import (
    get_questions_for_category,
    get_unique_question_ids,
    get_scoring_for_category,
    get_treatment_by_id,
    get_treatments_in_category,
    get_category_by_id,
)


def build_question_response(category_id: str, question_index: int) -> Optional[dict]:
    """
    Return the question at `question_index` (0-based) for the category,
    formatted as {question_text, buttons: [{label, value, question_id, terminal_treatment_id}]}.
    Returns None if no more questions.
    """
    q_ids = get_unique_question_ids(category_id)
    if question_index >= len(q_ids):
        return None

    question_id = q_ids[question_index]
    all_rows = get_questions_for_category(category_id)
    this_q_rows = [r for r in all_rows if r["question_id"] == question_id]
    if not this_q_rows:
        return None

    question_text = this_q_rows[0]["question_text"]
    buttons = [
        {
            "label": r["option_label"],
            "value": r["option_value"],
            "question_id": question_id,
            "terminal_treatment_id": r.get("terminal_treatment_id"),
        }
        for r in sorted(this_q_rows, key=lambda x: x["option_order"])
    ]
    total = len(q_ids)
    return {
        "question_text": question_text,
        "question_id": question_id,
        "question_index": question_index,
        "total_questions": total,
        "buttons": buttons,
    }


def apply_score(scores: Dict[str, int], category_id: str, question_id: str, option_value: str) -> Dict[str, int]:
    """Add scoring weights for the chosen option to the running totals."""
    scoring_rows = get_scoring_for_category(category_id)
    for row in scoring_rows:
        if row["question_id"] == question_id and row["option_value"] == option_value:
            tid = row["treatment_id"]
            scores[tid] = scores.get(tid, 0) + row["score_weight"]
    return scores


def get_top_treatments(category_id: str, scores: Dict[str, int]) -> List[dict]:
    """Return top 1-2 treatments by score. Handles tie/zero edge cases."""
    if not scores or max(scores.values(), default=0) == 0:
        return []

    sorted_ids = sorted(scores.keys(), key=lambda tid: scores[tid], reverse=True)
    top_score = scores[sorted_ids[0]]

    # Include all treatments with the top score (tie), capped at 2
    top = [tid for tid in sorted_ids if scores[tid] == top_score][:2]

    # If only 1 at top score, also include #2 if its score is > 0
    if len(top) == 1 and len(sorted_ids) > 1 and scores[sorted_ids[1]] > 0:
        top.append(sorted_ids[1])

    result = []
    for tid in top[:2]:
        t = get_treatment_by_id(tid)
        if t:
            result.append(t)
    return result


def get_base_treatment(category_id: str) -> Optional[dict]:
    """Fallback: return the first treatment in the category (lowest ID)."""
    treatments = get_treatments_in_category(category_id)
    return treatments[0] if treatments else None


def format_recommendation_text(treatments: List[dict], language: str, category_name: str) -> str:
    """Format the final recommendation in the user's language."""
    if not treatments:
        msgs = {
            "he": f"לא הצלחתי לצמצם לטיפול אחד — הצוות שלנו ב-*3691 ישמח לייעץ לך אישית 😊",
            "ar": f"لم أتمكن من تحديد علاج واحد — فريقنا على *3691 سيسعد بمساعدتك شخصياً 😊",
            "en": f"I couldn't narrow it down to one — our team at *3691 would love to advise you personally 😊",
        }
        return msgs.get(language, msgs["he"])

    if language == "ar":
        header = f"بناءً على إجاباتك، أنصحك بـ:" if len(treatments) > 1 else "بناءً على إجاباتك، الأنسب لك هو:"
    elif language == "en":
        header = "Based on your answers, I recommend:" if len(treatments) > 1 else "Based on your answers, the best fit for you is:"
    else:
        header = "לפי התשובות שלך, הטיפול המתאים ביותר הוא:" if len(treatments) == 1 else "לפי התשובות שלך, ממליצה על:"

    lines = [header]
    for t in treatments:
        name = t["treatment_name"]
        desc = t.get("short_description") or t.get("good_for") or ""
        if desc:
            lines.append(f"✨ **{name}** — {desc}")
        else:
            lines.append(f"✨ **{name}**")

    if language == "ar":
        lines.append("\nللحجز أو الاستفسار، تواصل معنا على *3691 😊")
    elif language == "en":
        lines.append("\nTo book or learn more, contact us at *3691 😊")
    else:
        lines.append("\nלתיאום תור ופרטים נוספים, צרי קשר ב-*3691 😊")

    return "\n".join(lines)


def format_terminal_text(treatment: dict, language: str) -> str:
    """Format the response for a terminal gate (e.g. pregnancy → BD-11)."""
    name = treatment["treatment_name"]
    desc = treatment.get("short_description") or treatment.get("good_for") or ""

    if language == "ar":
        note = "ملاحظة: سيتأكد فريقنا من الملاءمة الكاملة في موعدك."
        return f"يبدو أن الأنسب لك هو **{name}**{'— ' + desc if desc else ''}.\n\n{note}"
    if language == "en":
        note = "Note: our team will confirm full suitability at your appointment."
        return f"The best fit for you appears to be **{name}**{'— ' + desc if desc else ''}.\n\n{note}"

    note = "הערה: הצוות שלנו יוודא התאמה מלאה בפגישה."
    return f"הטיפול המתאים לך הוא **{name}**{'— ' + desc if desc else ''}.\n\n{note}"


def format_intro(category: dict, language: str) -> str:
    """Return the recommendation_intro text, translated if needed."""
    intro = category.get("recommendation_intro") or ""
    if intro:
        return intro  # Data holds Hebrew; LLM will translate if needed via wrapping
    name = category.get("category_name", "")
    if language == "ar":
        return f"سأساعدك في العثور على العلاج الأنسب في {name}. سأطرح عليك بعض الأسئلة السريعة."
    if language == "en":
        return f"Let me help you find the best treatment in {name}. I'll ask you a few quick questions."
    return f"בואו נמצא יחד את הטיפול הכי מתאים לך ב{name} 💆 אשאל כמה שאלות קצרות."


def format_recommendation_reason(category_id: str, flow_answers: List[dict], treatment: Optional[dict]) -> str:
    """
    Build a short "why this fits" explanation from the client's own answers,
    using only the stored question/option labels and the treatment's own data —
    nothing invented.
    """
    if not treatment or not flow_answers:
        return ""

    rows = get_questions_for_category(category_id)
    label_map = {(r["question_id"], r["option_value"]): r["option_label"] for r in rows}

    chosen_labels = [
        label_map[(a["question_id"], a["option_value"])]
        for a in flow_answers
        if (a["question_id"], a["option_value"]) in label_map
    ]
    if not chosen_labels:
        return ""

    answers_text = ", ".join(chosen_labels)
    fit_detail = treatment.get("good_for") or treatment.get("short_description") or ""
    name = treatment.get("treatment_name", "")

    reason = f"בהתבסס על מה שסיפרת לי ({answers_text}), **{name}** התאים הכי טוב"
    if fit_detail:
        reason += f" — הטיפול מיועד ל{fit_detail}" if not fit_detail.startswith("ל") else f" — הטיפול מיועד {fit_detail}"
    reason += "."
    return reason


# ── Follow-up question detection (coreference to last discussed treatment) ──

FOLLOWUP_KEYWORDS = {
    "suitability": ["למי זה מתאים", "למי מתאים", "מתאים לכל", "who is it for", "suitable for"],
    "duration": [
        "כמה זמן נמשך", "משך הטיפול", "כמה זמן לוקח", "כמה זמן זה אורך", "כמה זמן זה נמשך",
        "נמשך", "כמה זמן זה", "כמה זמן הטיפול", "how long does it take", "how long is", "duration",
    ],
    "pain": ["כואב", "כאב", "זה כואב", "כואבת", "is it painful", "does it hurt"],
    "recovery": ["החלמה", "התאוששות", "recovery time", "downtime"],
    "sessions": ["כמה טיפולים", "כמה פעמים צריך", "מספר טיפולים מומלץ", "how many sessions", "how many treatments"],
    "results": ["תוצאות", "מתי רואים תוצאות", "when will i see results", "results"],
    "aftercare": ["מה לעשות אחרי", "הנחיות אחרי הטיפול", "aftercare", "after the treatment"],
    "technique": ["איך זה עובד", "באיזה מכשור", "how does it work", "what equipment"],
}

_ALL_FOLLOWUP_KW = [kw for group in FOLLOWUP_KEYWORDS.values() for kw in group]

_COMPARE_KEYWORDS = [
    "מה ההבדל", "ההבדל בין", "מה עדיף", "השוואה", "מה יותר טוב",
    "difference between", "compare", " vs ", "الفرق بين", "قارن",
]


def is_followup_question(message: str) -> bool:
    """True when the message asks about an attribute (pain/duration/etc.) without naming a treatment."""
    low = (message or "").strip().lower()
    if not low:
        return False
    return any(kw in low for kw in _ALL_FOLLOWUP_KW)


def is_comparison_request(message: str) -> bool:
    low = (message or "").strip().lower()
    if not low:
        return False
    return any(kw in low for kw in _COMPARE_KEYWORDS)


def find_treatments_by_mention(message: str, all_treatments: List[dict]) -> List[dict]:
    """
    Return treatments whose name or a comma-separated alias appears in the message.
    Longer names are checked first so a specific match isn't shadowed by a shorter
    substring of another treatment's name.
    """
    low = (message or "").strip().lower()
    if not low:
        return []

    candidates = sorted(all_treatments, key=lambda t: len(t.get("treatment_name") or ""), reverse=True)
    matched, seen = [], set()
    for t in candidates:
        tid = t.get("treatment_id")
        if tid in seen:
            continue
        name = (t.get("treatment_name") or "").strip()
        hit = bool(name) and name.lower() in low
        if not hit:
            for alias in (t.get("aliases") or "").split(","):
                alias = alias.strip()
                if alias and alias.lower() in low:
                    hit = True
                    break
        if hit:
            matched.append(t)
            seen.add(tid)
    return matched
