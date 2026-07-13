import sqlite3
import json
from typing import Optional, List, Dict
from chatbot_config import CHATBOT_DB_PATH


def get_chatbot_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(CHATBOT_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_chatbot_db():
    conn = get_chatbot_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_categories (
            category_id TEXT PRIMARY KEY,
            category_name TEXT NOT NULL,
            has_recommendation INTEGER DEFAULT 0,
            recommendation_intro TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_treatments (
            treatment_id TEXT PRIMARY KEY,
            category_id TEXT,
            subgroup TEXT,
            treatment_name TEXT NOT NULL,
            short_description TEXT,
            good_for TEXT,
            technique_or_equipment TEXT,
            duration_min INTEGER,
            duration_notes TEXT,
            aliases TEXT,
            canonical_id TEXT,
            source TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            question_order INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            option_value TEXT NOT NULL,
            option_label TEXT NOT NULL,
            option_order INTEGER NOT NULL,
            terminal_treatment_id TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_scoring (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            option_value TEXT NOT NULL,
            treatment_id TEXT NOT NULL,
            score_weight INTEGER NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_faq (
            faq_id TEXT PRIMARY KEY,
            category_id TEXT,
            canonical_question TEXT NOT NULL,
            answer TEXT NOT NULL,
            example_phrasings TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_forward_topics (
            topic_id TEXT PRIMARY KEY,
            topic_name TEXT NOT NULL,
            reason TEXT,
            example_phrasings TEXT,
            phone_number TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cb_sessions (
            session_id TEXT PRIMARY KEY,
            mode TEXT NOT NULL DEFAULT 'general',
            flow_category_id TEXT,
            flow_question_index INTEGER DEFAULT 0,
            flow_scores TEXT DEFAULT '{}',
            flow_answers TEXT DEFAULT '[]',
            recent_context TEXT DEFAULT '[]',
            last_treatment_id TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


# ── Session management ────────────────────────────────────────────────────

def get_session(session_id: str) -> dict:
    conn = get_chatbot_db()
    row = conn.execute(
        "SELECT * FROM cb_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    conn.close()
    if not row:
        return _default_session(session_id)
    d = dict(row)
    d["flow_scores"] = json.loads(d.get("flow_scores") or "{}")
    d["flow_answers"] = json.loads(d.get("flow_answers") or "[]")
    d["recent_context"] = json.loads(d.get("recent_context") or "[]")
    return d


def save_session(session_id: str, state: dict):
    conn = get_chatbot_db()
    conn.execute("""
        INSERT OR REPLACE INTO cb_sessions
        (session_id, mode, flow_category_id, flow_question_index,
         flow_scores, flow_answers, recent_context, last_treatment_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        session_id,
        state.get("mode", "general"),
        state.get("flow_category_id"),
        state.get("flow_question_index", 0),
        json.dumps(state.get("flow_scores", {}), ensure_ascii=False),
        json.dumps(state.get("flow_answers", []), ensure_ascii=False),
        json.dumps(state.get("recent_context", []), ensure_ascii=False),
        state.get("last_treatment_id"),
    ))
    conn.commit()
    conn.close()


def _default_session(session_id: str) -> dict:
    return {
        "session_id": session_id,
        "mode": "general",
        "flow_category_id": None,
        "flow_question_index": 0,
        "flow_scores": {},
        "flow_answers": [],
        "recent_context": [],
        "last_treatment_id": None,
    }


def append_context(session: dict, role: str, content: str, max_msgs: int = 6):
    ctx = session.get("recent_context", [])
    ctx.append({"role": role, "content": content})
    session["recent_context"] = ctx[-max_msgs:]


# ── Data access ───────────────────────────────────────────────────────────

def get_categories() -> List[Dict]:
    conn = get_chatbot_db()
    rows = conn.execute("SELECT * FROM cb_categories ORDER BY category_id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_category_by_id(category_id: str) -> Optional[Dict]:
    conn = get_chatbot_db()
    row = conn.execute(
        "SELECT * FROM cb_categories WHERE category_id = ?", (category_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_faq_entries() -> List[Dict]:
    conn = get_chatbot_db()
    rows = conn.execute("SELECT * FROM cb_faq").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_faq_by_id(faq_id: str) -> Optional[Dict]:
    conn = get_chatbot_db()
    row = conn.execute("SELECT * FROM cb_faq WHERE faq_id = ?", (faq_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_forward_topics() -> List[Dict]:
    conn = get_chatbot_db()
    rows = conn.execute("SELECT * FROM cb_forward_topics").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_treatments_summary() -> List[Dict]:
    conn = get_chatbot_db()
    rows = conn.execute("""
        SELECT treatment_id, category_id, treatment_name, aliases,
               good_for, technique_or_equipment, duration_min, duration_notes
        FROM cb_treatments ORDER BY category_id, treatment_id
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_treatment_by_id(treatment_id: str) -> Optional[Dict]:
    conn = get_chatbot_db()
    row = conn.execute(
        "SELECT * FROM cb_treatments WHERE treatment_id = ?", (treatment_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_treatments_in_category(category_id: str) -> List[Dict]:
    conn = get_chatbot_db()
    rows = conn.execute(
        "SELECT * FROM cb_treatments WHERE category_id = ? ORDER BY treatment_id",
        (category_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_questions_for_category(category_id: str) -> List[Dict]:
    """Return rows ordered by question_order, option_order.
    Each unique question_id appears multiple times (one per option)."""
    conn = get_chatbot_db()
    rows = conn.execute("""
        SELECT * FROM cb_questions
        WHERE category_id = ?
        ORDER BY question_order, option_order
    """, (category_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_unique_question_ids(category_id: str) -> List[str]:
    """Ordered list of distinct question_ids for a category."""
    conn = get_chatbot_db()
    rows = conn.execute("""
        SELECT DISTINCT question_id, question_order FROM cb_questions
        WHERE category_id = ?
        ORDER BY question_order
    """, (category_id,)).fetchall()
    conn.close()
    return [r["question_id"] for r in rows]


def get_scoring_for_category(category_id: str) -> List[Dict]:
    conn = get_chatbot_db()
    rows = conn.execute(
        "SELECT * FROM cb_scoring WHERE category_id = ?", (category_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
