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
        header = "حسب إجاباتك، هذه خيارات قد تناسبك:"
    elif language == "en":
        header = "Based on what you shared, these options may fit:"
    else:
        header = "לפי מה שסיפרת, אלה האפשרויות שיכולות להתאים:"

    lines = [header]
    for t in treatments:
        name = t["treatment_name"]
        desc = t.get("short_description") or t.get("good_for") or ""
        lines.append(f"\n**{name}**")
        if desc:
            lines.append(desc)

    if language == "ar":
        lines.append("\nيمكنك فتح تفاصيل العلاج أو التواصل معنا على *3691.")
    elif language == "en":
        lines.append("\nYou can open the treatment details or contact us at *3691.")
    else:
        lines.append("\nאפשר לפתוח את פרטי הטיפול או ליצור קשר עם הצוות ב-*3691.")

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
