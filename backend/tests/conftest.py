# -*- coding: utf-8 -*-
"""Test harness for the MeDay chatbot.

Every test runs against a COPY of chatbot.db in pytest's tmp dir, so the real
database is never touched. The copy is migrated on creation, which also means
these tests are immune to the "live DB is missing conversation_state" problem.

The LLM is stubbed by default: tests must be deterministic and offline. Tests
that care whether a message reached the LLM read `bot.llm_calls`.
"""
import json
import shutil
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

REAL_DB = BACKEND / "chatbot.db"


@pytest.fixture(scope="session")
def chatbot_db_path(tmp_path_factory):
    """A migrated, disposable copy of the production chatbot database."""
    if not REAL_DB.exists():
        pytest.skip(f"{REAL_DB} not found — run import_meday_data.py first")
    dst = tmp_path_factory.mktemp("chatbotdb") / "chatbot.db"
    shutil.copy(REAL_DB, dst)

    import chatbot_config
    chatbot_config.CHATBOT_DB_PATH = dst
    import chatbot_db
    chatbot_db.CHATBOT_DB_PATH = dst
    chatbot_db.init_chatbot_db()          # applies pending column migrations
    return dst


@pytest.fixture(scope="session")
def R(chatbot_db_path):
    """The router module, bound to the disposable database."""
    import chatbot_router
    return chatbot_router


@pytest.fixture(scope="session")
def DB(chatbot_db_path):
    import chatbot_db
    return chatbot_db


class Bot:
    """One conversation. `say()` / `click()` mirror what the frontend sends."""

    _counter = 0

    def __init__(self, R, llm_reply=None):
        Bot._counter += 1
        self.R = R
        self.session_id = f"test-{Bot._counter}"
        self.llm_calls = []
        self.last = {}
        self._llm_reply = llm_reply

        # Stub the LLM. Default: behave as if no key is configured, which is the
        # bot's real current state and forces the deterministic path.
        self._orig_ok = R._llm_ok
        self._orig_respond = R._llm_respond
        R._llm_ok = lambda: self._llm_reply is not None

        def _respond(message, context, lang, locked_treatment=None):
            self.llm_calls.append(message)
            if callable(self._llm_reply):
                return self._llm_reply(message, context, lang, locked_treatment)
            return self._llm_reply or {"reply": "", "action": None, "forward": False}

        R._llm_respond = _respond

    def restore(self):
        self.R._llm_ok = self._orig_ok
        self.R._llm_respond = self._orig_respond

    def say(self, message):
        self.llm_calls = []
        self.last = self.R.handle_message(self.session_id, message=message)
        return self.last

    def click(self, value, question_id=None):
        self.llm_calls = []
        self.last = self.R.handle_message(
            self.session_id, button_value=value, question_id=question_id
        )
        return self.last

    # -- convenience accessors -------------------------------------------------
    @property
    def reply(self):
        return (self.last.get("reply") or "").strip()

    @property
    def buttons(self):
        return [b["label"] for b in (self.last.get("buttons") or [])]

    @property
    def button_values(self):
        return [b["value"] for b in (self.last.get("buttons") or [])]

    @property
    def suggestions(self):
        return self.last.get("suggestions") or []

    @property
    def treatments(self):
        return [t["name"] for t in (self.last.get("treatments") or [])]

    def session(self):
        import chatbot_db
        return chatbot_db.get_session(self.session_id)


@pytest.fixture
def bot(R):
    b = Bot(R)
    yield b
    b.restore()


@pytest.fixture
def bot_factory(R):
    made = []

    def _make(llm_reply=None):
        b = Bot(R, llm_reply=llm_reply)
        made.append(b)
        return b

    yield _make
    for b in made:
        b.restore()


# ── Behaviour classifiers ────────────────────────────────────────────────────
# These compare against the router's OWN template functions rather than against
# hardcoded strings, so re-wording a template never breaks a test — only a
# change in which template gets chosen (i.e. a routing change) does.

_LANGS = ("he", "ar", "en")


def _same(reply, *candidates):
    r = (reply or "").strip()
    return any(r == (c or "").strip() for c in candidates if c)


def is_price_deflection(R, reply):
    return _same(reply, *(R._price_msg(lg) for lg in _LANGS))


def is_duration_deflection(R, reply):
    return _same(reply, *(R._duration_msg(lg) for lg in _LANGS))


def is_scope_decline(R, reply):
    """The firm 'I only handle MeDay topics' reply."""
    return _same(reply, *(R._out_of_scope_reply(lg)["reply"] for lg in _LANGS))


def is_unclear(R, reply):
    """The 'I didn't understand, rephrase' reply."""
    return _same(reply, *(R._unclear_reply(lg)["reply"] for lg in _LANGS))


def is_cant_parse(R, reply):
    return _same(reply, *(R._cant_parse_reply(lg)["reply"] for lg in _LANGS))


def is_generic_forward(R, reply):
    return _same(reply, *(R._forward_msg(lg) for lg in _LANGS))


def is_medical_forward(R, reply):
    """Medical-suitability deflection, with or without a treatment name prefix."""
    r = (reply or "").strip()
    for lg in _LANGS:
        body = R._treatment_medical_safety_reply(None, lg).strip()
        if r == body or r.endswith(body):
            return True
    return False


def is_urgent_medical(R, reply):
    return _same(reply, *(R._urgent_medical_msg(lg) for lg in _LANGS))


def is_booking(R, resp):
    vals = {b.get("value") for b in (resp.get("buttons") or [])}
    return "__open_booking_whatsapp__" in vals


def is_catalog_overview(R, reply):
    """Reply that lists every category — the 'what do you offer' answer."""
    from chatbot_db import get_categories
    names = [c["category_name"] for c in get_categories() if c.get("category_name")]
    return sum(1 for n in names if n in (reply or "")) >= max(4, len(names) - 1)


def faq_id_of(DB, reply):
    """If the reply is verbatim a FAQ answer, return its id."""
    r = (reply or "").strip()
    for f in DB.get_faq_entries():
        if r == (f["answer"] or "").strip():
            return f["faq_id"]
    return None


def mentions_no_price(reply):
    """No shekel sign and no bare 2-4 digit number that could read as a price.
    Times (08:30) and phone (*3691) are allowed."""
    import re
    r = reply or ""
    if "₪" in r or "שקל" in r or "NIS" in r.upper():
        return False
    stripped = re.sub(r"\*?3691|\d{1,2}:\d{2}|CAT-\d+|FAQ-\d+", "", r)
    return not re.search(r"\b\d{2,5}\b", stripped)
