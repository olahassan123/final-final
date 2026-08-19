# -*- coding: utf-8 -*-
"""Guards for the Gemini understand → retrieve → phrase pipeline.

Everything here runs with the LLM stubbed off (conftest's default), so these
tests pin the DETERMINISTIC half: intent resolution, field retrieval, honest
no-data replies, and the fact that the bot keeps working when Gemini is gone.
The Gemini-only behaviour (phrasing, translation) is covered by the grounding
gate tests, which need no network.

Written after a total Gemini outage went unnoticed for weeks because a
malformed request body was reported to the admin page as "invalid API key".
"""
import sqlite3

import pytest
import requests


# ── Intent understanding ─────────────────────────────────────────────────────

@pytest.mark.parametrize("message,expected", [
    # Hebrew
    ("מה כדאי לדעת לפני?", {"preparation"}),
    ("צריך להתכונן?", {"preparation"}),
    ("יש משהו לעשות מראש?", {"preparation"}),
    ("ומה אחרי?", {"aftercare"}),
    ("מה עושים אחרי הטיפול?", {"aftercare"}),
    # English
    ("What should I know before?", {"preparation"}),
    ("Do I need to prepare?", {"preparation"}),
    ("And what about after?", {"aftercare"}),
    # Arabic
    ("شو لازم اعرف قبل؟", {"preparation"}),
    ("وشو بعد العلاج؟", {"aftercare"}),
])
def test_single_intent_is_recognised_without_the_llm(R, message, expected):
    fields, _topic = R._keyword_followup_fields(message)
    assert expected <= set(fields), f"{message!r} resolved to {fields}"


@pytest.mark.parametrize("message", [
    "מה כדאי לדעת לפני ואחרי הטיפול?",
    "יש משהו חשוב לפני או אחרי?",
    "What should I know before and after?",
    "شو لازم اعرف قبل وبعد؟",
])
def test_combined_intent_returns_both_fields(R, message):
    """'Before and after' is two questions. The old _detect_field returned a
    single field and silently dropped half of it."""
    fields, topic = R._keyword_followup_fields(message)
    assert {"preparation", "aftercare"} <= set(fields), f"{message!r} -> {fields}"
    assert topic == "multi"


def test_combined_intent_reads_preparation_before_aftercare(R):
    fields, _ = R._keyword_followup_fields("מה כדאי לדעת לפני ואחרי הטיפול?")
    assert fields.index("preparation") < fields.index("aftercare")


def test_a_message_that_is_not_about_the_treatment_claims_nothing(R):
    """The follow-up handler must return no fields for a change of subject,
    otherwise a locked treatment swallows category switches and logistics."""
    for message in ["סטיילינג", "מה אתם מציעים?", "איפה אתם?", "מה המחיר?"]:
        fields, _ = R._keyword_followup_fields(message)
        assert not fields, f"{message!r} was claimed as a treatment follow-up: {fields}"


def test_chip_label_and_typed_text_resolve_to_the_same_field(R):
    """A suggestion chip sends its label as free text, so clicking it and
    typing it must be indistinguishable."""
    for field, q in R._FIELD_Q.items():
        for lang in ("he", "ar", "en"):
            label = q[lang]
            assert R._chip_field(label) == field, f"chip {label!r} -> {R._chip_field(label)}"
            kw_fields, _ = R._keyword_followup_fields(label)
            assert field in kw_fields, f"typed {label!r} -> {kw_fields}"


# ── Conversation behaviour ───────────────────────────────────────────────────

def _detailed_treatment(DB):
    """A treatment that has both preparation and aftercare text."""
    for t in DB.get_treatments_in_category("CAT-03"):
        if t.get("preparation") and t.get("aftercare") and t.get("pain_level"):
            return t
    pytest.skip("no CAT-03 treatment with preparation+aftercare+pain_level")


def test_different_questions_get_different_answers(bot, DB):
    """The supervisor's report: different follow-ups, same generic paragraph."""
    t = _detailed_treatment(DB)
    bot.click(f"__ask_treatment__:{t['treatment_id']}")
    bot.say("מה כדאי לדעת לפני?")
    prep = bot.reply
    bot.say("ומה אחרי?")
    after = bot.reply
    bot.say("האם זה כואב?")
    pain = bot.reply

    assert prep != after != pain and prep != pain, "three questions, repeated answer"
    assert t["preparation"] in prep
    assert t["aftercare"] in after
    assert t["pain_level"] in pain


def test_treatment_context_survives_a_bare_followup(bot, DB):
    """"ומה אחרי?" names no treatment — it must still resolve to the one on screen."""
    t = _detailed_treatment(DB)
    bot.click(f"__ask_treatment__:{t['treatment_id']}")
    bot.say("ומה אחרי?")
    assert t["aftercare"] in bot.reply
    assert bot.session().get("last_treatment_id") == t["treatment_id"]


def test_combined_question_answers_both_fields_end_to_end(bot, DB):
    t = _detailed_treatment(DB)
    bot.click(f"__ask_treatment__:{t['treatment_id']}")
    bot.say("מה כדאי לדעת לפני ואחרי הטיפול?")
    assert t["preparation"] in bot.reply
    assert t["aftercare"] in bot.reply


def test_missing_field_is_answered_honestly_not_with_a_generic_paragraph(bot, DB, R):
    """A treatment with no preparation column must say so, not print the
    hand-written 'in treatments of this type...' background paragraph."""
    target = None
    for t in DB.get_treatments_in_category("CAT-02"):
        if not t.get("preparation") and t.get("short_description"):
            target = t
            break
    if not target:
        pytest.skip("no CAT-02 treatment without preparation")
    bot.click(f"__ask_treatment__:{target['treatment_id']}")
    bot.say("איך כדאי להתכונן?")
    assert "באופן כללי" not in bot.reply, "fell back to the generic background paragraph"
    assert R.CLINIC_PHONE in bot.reply


def test_answered_topics_stop_being_suggested(bot, DB):
    t = _detailed_treatment(DB)
    bot.click(f"__ask_treatment__:{t['treatment_id']}")
    bot.say("האם זה כואב?")
    assert all("כואב" not in c for c in bot.suggestions or []), \
        f"already-answered topic still suggested: {bot.suggestions}"


def test_bot_works_with_gemini_completely_unavailable(bot, DB):
    """conftest stubs the LLM off by default — this is the no-key path."""
    t = _detailed_treatment(DB)
    bot.click(f"__ask_treatment__:{t['treatment_id']}")
    bot.say("מה כדאי לדעת לפני ואחרי הטיפול?")
    assert t["preparation"] in bot.reply
    assert bot.last["response_source"] in ("database", "rule_based")


def test_every_reply_reports_a_response_source(bot, DB):
    t = _detailed_treatment(DB)
    for step in [lambda: bot.click(f"__ask_treatment__:{t['treatment_id']}"),
                 lambda: bot.say("ספרי לי עוד על זה"),
                 lambda: bot.say("מה המחיר?"),
                 lambda: bot.say("איפה אתם?")]:
        step()
        assert bot.last.get("response_source"), f"no response_source on {bot.reply[:40]!r}"


# ── Grounding gate: Gemini may phrase, never invent ──────────────────────────

SOURCE = "**הכנה:** מומלץ להגיע ללא איפור ולהימנע מחומצות 3 ימים לפני."


@pytest.mark.parametrize("candidate", [
    "מומלץ להגיע ללא איפור. עלות הטיפול 450 שקל.",          # invented price
    "מומלץ להגיע ללא איפור. הטיפול אורך 45 דקות.",           # invented duration
    "מומלץ להגיע ללא איפור. מומלצים 6 טיפולים.",             # invented session count
    "מומלץ להגיע ללא איפור ולהימנע מחומצות 3 ימים לפני. ₪",  # currency symbol
    "",                                                       # empty
])
def test_ungrounded_rewrites_are_rejected(R, candidate):
    assert not R._phrasing_is_grounded(candidate, SOURCE)


def test_faithful_translation_is_accepted(R):
    assert R._phrasing_is_grounded(
        "Please arrive without makeup and avoid acids for 3 days before.", SOURCE)


def test_padding_with_general_knowledge_is_rejected(R):
    padded = SOURCE + " " + ("בנוסף כדאי לשתות מים ולהקפיד על שינה טובה. " * 8)
    assert not R._phrasing_is_grounded(padded, SOURCE)


# ── Failure classification ───────────────────────────────────────────────────

class _Resp:
    def __init__(self, code, text):
        self.status_code = code
        self.text = text

    def json(self):
        import json as _j
        return _j.loads(self.text)


def _http_error(code, text):
    return requests.HTTPError(response=_Resp(code, text))


def test_a_malformed_request_is_not_blamed_on_the_api_key(R):
    """The regression that hid a total outage: Gemini rejected our
    generationConfig with 400, and it was filed as 'invalid_key'."""
    err = _http_error(400, '{"error":{"message":"Thinking level MINIMAL is not '
                           'supported for this model.","status":"INVALID_ARGUMENT"}}')
    assert R._classify_http_error(err) == "bad_request"


def test_a_genuine_key_problem_is_still_reported_as_such(R):
    err = _http_error(400, '{"error":{"message":"API key not valid. Please pass a '
                           'valid API key.","status":"INVALID_ARGUMENT"}}')
    assert R._classify_http_error(err) == "invalid_key"
    assert R._classify_http_error(_http_error(403, '{"error":{"message":"forbidden"}}')) \
        == "invalid_key"


def test_a_daily_free_tier_cap_is_distinguished_from_a_throttle(R):
    daily = _http_error(429, '{"error":{"message":"quota","details":[{"violations":'
                             '[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}')
    assert R._classify_http_error(daily) == "daily_quota"
    burst = _http_error(429, '{"error":{"message":"quota","details":[{"violations":'
                             '[{"quotaId":"GenerateRequestsPerMinutePerProject"}]}]}}')
    assert R._classify_http_error(burst) == "rate_limited"


def test_a_throttled_key_is_still_accepted_as_valid(R, monkeypatch):
    """Pasting a good key after the day's free allowance is spent must not be
    reported to the clinic as an invalid key."""
    def boom(*a, **k):
        raise _http_error(429, '{"error":{"message":"q","details":[{"violations":'
                               '[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}')
    monkeypatch.setattr(R, "_call_gemini", boom)
    accepted, status = R._test_llm_key("AIzaSomethingThatLooksReal")
    assert accepted is True and status == "daily_quota"


def test_api_key_never_appears_in_logged_text(R, monkeypatch):
    monkeypatch.setattr(R, "_get_llm_key", lambda: "AIzaSUPERSECRETKEYVALUE")
    leaked = ("400 Client Error for url: https://generativelanguage.googleapis.com/"
              "v1beta/models/m:generateContent?key=AIzaSUPERSECRETKEYVALUE&alt=json")
    out = R._redact(leaked)
    assert "AIzaSUPERSECRETKEYVALUE" not in out
    assert "key=***" in out
