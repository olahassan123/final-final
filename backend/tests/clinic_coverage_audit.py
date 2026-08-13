# -*- coding: utf-8 -*-
"""Offline clinic-question coverage audit; uses a disposable chatbot database."""
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import chatbot_config

QUESTIONS = [
    "אילו טיפולים אתם מציעים?", "כמה קטגוריות יש?", "כמה טיפולים יש בכל קטגוריה?",
    "איפה הקליניקה?", "מה הכתובת?", "יש חניה ליד הקליניקה?",
    "האם המקום נגיש לכיסא גלגלים?", "מה שעות הפתיחה?", "אתם פתוחים בשישי?",
    "אתם פתוחים בשבת?", "איך יוצרים קשר?", "איך מזמינים תור?", "אפשר לבטל תור?",
    "אפשר לשנות תור?", "אפשר להגיע בלי תור?", "איזה טיפול מתאים לעור יבש?",
    "מה מתאים לעור רגיש?", "יש טיפול לאקנה?", "יש טיפול לפיגמנטציה?",
    "יש לכם טיפולים לגברים?", "האם אתם מטפלים בילדים?", "מאיזה גיל אפשר לעשות טיפול?",
    "מי מבצע את הטיפולים?", "אפשר לבחור מטפלת?", "איזו הכשרה יש למטפלות?",
    "כמה זמן מראש צריך להזמין?", "כמה זמן לוקח טיפול?", "כמה עולה טיפול?",
    "אפשר לשלם באשראי?", "יש תשלומים?", "יש מבצעים?", "אפשר לקנות שובר מתנה?",
    "באילו שפות נותנים שירות?", "יש וואטסאפ?", "יש ייעוץ לפני טיפול?",
    "מה צריך להביא לטיפול?", "איך להתכונן לטיפול?", "מה מדיניות הביטולים?",
    "אפשר לעשות כמה טיפולים באותו יום?", "יש טיפול לנשים בהריון?", "האם הטיפול כואב?",
    "מה הטיפול הכי פופולרי?", "האם יש תוצאות מיד?", "כמה זמן התוצאות מחזיקות?",
    "هل لديكم مواقف سيارات؟", "هل المكان مناسب لذوي الكراسي المتحركة؟", "كيف أحجز موعداً؟",
    "Do you have parking?", "Is the clinic wheelchair accessible?", "Can I reschedule an appointment?",
]


def main():
    work = Path(tempfile.mkdtemp(prefix="meday-chat-audit-"))
    try:
        db_copy = work / "chatbot.db"
        shutil.copy(BACKEND / "chatbot.db", db_copy)
        chatbot_config.CHATBOT_DB_PATH = db_copy
        import chatbot_db
        chatbot_db.CHATBOT_DB_PATH = db_copy
        chatbot_db.init_chatbot_db()
        import chatbot_router as router
        router._llm_ok = lambda: False

        unclear = {
            fn(lang)["reply"].strip()
            for fn in (router._unclear_reply, router._out_of_scope_reply, router._cant_parse_reply)
            for lang in ("he", "ar", "en")
        }
        misses = []
        for question in QUESTIONS:
            response = router.handle_message(f"audit-{uuid.uuid4().hex}", message=question)
            reply = (response.get("reply") or "").strip()
            status = "MISS" if reply in unclear or not reply else "OK"
            if status == "MISS":
                misses.append(question)
            print(f"{status:4} | {question} | {reply.replace(chr(10), ' ')[:180]}")
        print(f"\nCoverage: {len(QUESTIONS) - len(misses)}/{len(QUESTIONS)}; misses: {len(misses)}")
        return 1 if misses else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
