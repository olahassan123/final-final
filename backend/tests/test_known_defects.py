# -*- coding: utf-8 -*-
"""KNOWN DEFECTS — reproduced bugs, asserted as the behaviour we WANT.

Each test is marked xfail(strict=True), so:
  • while the bug exists  → xfail (suite stays green)
  • once the bug is fixed → XPASS, which strict mode reports as a FAILURE

That is deliberate: fixing a bug forces you to delete its xfail marker and move
the test into the permanent suite, so nothing silently regresses later.

Grouped by the section numbers in CHATBOT_STRATEGY.md.
"""
import pytest

from conftest import (
    is_price_deflection, is_duration_deflection, is_scope_decline,
    is_medical_forward, is_urgent_medical, is_booking, is_catalog_overview,
    is_unclear, faq_id_of,
)

defect = pytest.mark.xfail(strict=True, reason="known defect — see CHATBOT_STRATEGY.md")


# ── §2A  Scope detection ─────────────────────────────────────────────────────

@defect
@pytest.mark.parametrize("msg", [
    "תכתבי לי קוד פייתון שממיין רשימה",
    "מה דעתך על ביבי?",
    "המליצי לי על מסעדה טובה",
    "כמה קלוריות יש בסלט?",
    "איזה מתכון יש לך לשקשוקה?",
    "tell me a joke",
])
def test_off_topic_gets_a_scope_decline_not_a_shrug(bot, R, msg):
    """Today these return 'sorry, I didn't understand — rephrase', which invites
    the customer to try again. They should get the firm scope decline."""
    bot.say(msg)
    assert is_scope_decline(R, bot.reply), f"{msg!r} → {bot.reply!r}"


@defect
def test_weather_question_does_not_trigger_booking(bot, R):
    """'מחר' (tomorrow) is in _AVAILABILITY_KW, so ANY sentence mentioning
    tomorrow becomes a booking hand-off."""
    resp = bot.say("מה מזג האוויר בחיפה מחר?")
    assert not is_booking(R, resp), f"buttons={bot.buttons}"
    assert is_scope_decline(R, bot.reply), bot.reply


# FIXED — "כמה זה 17 כפול 23?" no longer trips the price guard.
# Promoted to test_regression.py::test_arithmetic_is_not_a_price_question.


@defect
def test_buying_makeup_elsewhere_is_off_topic_not_a_price_question(bot, R):
    bot.say("איפה אפשר לקנות איפור זול בחיפה?")
    assert not is_price_deflection(R, bot.reply), bot.reply


@defect
def test_bot_can_say_who_it_is(bot, R):
    bot.say("מה השם שלך ומי בנה אותך?")
    assert not is_unclear(R, bot.reply), bot.reply


# ── §2B  Fuzzy FAQ matching serves confidently wrong answers ─────────────────

@defect
def test_does_laser_hurt_is_not_answered_with_aftercare(bot, DB):
    """Asked 'does laser hair removal hurt' → served FAQ-01, the post-laser 24h
    instructions. Fluent, plausible, and not an answer to the question."""
    bot.say("האם הסרת שיער בלייזר כואבת?")
    assert faq_id_of(DB, bot.reply) not in ("FAQ-01", "FAQ-02", "FAQ-03", "FAQ-04"), \
        bot.reply


# ── §2C  Guards leak in both directions ──────────────────────────────────────

# FIXED — short price questions ("מה המחיר?", "יש מבצעים?", "כמה ₪ זה?",
# "מה התמחור?") are no longer swallowed by the clarification catch-all.
# Promoted to test_regression.py::test_short_price_questions_reach_the_price_guard.
# NOTE: the same ordering bug still bites the urgent-medical case below.


@defect
def test_short_urgent_message_is_not_swallowed_as_unclear(bot, R):
    """Same ordering bug, but here it swallows a customer reporting bleeding.
    'דימום' IS in _URGENT_MEDICAL_KW — the unclear check simply runs first."""
    bot.say("יש לי דימום")
    assert is_urgent_medical(R, bot.reply), bot.reply


@defect
def test_drug_interaction_question_is_forwarded(bot, R):
    """Isotretinoin + laser is a real contraindication. The medical guard has the
    word 'תרופה' but no drug names, so this is not recognised as a medical
    question. (It no longer serves a wrong FAQ — see test_regression — but it
    still does not reach the medical forward it should.)"""
    bot.say("אני לוקחת רואקוטן, אפשר לעשות לייזר?")
    assert is_medical_forward(R, bot.reply), bot.reply


@defect
def test_reported_injury_is_treated_as_urgent(bot, R):
    """'I have a burn from yesterday's treatment' currently dumps the full
    service catalog with 'pick an area to hear more 💛'."""
    bot.say("יש לי כוויה מהטיפול אתמול")
    assert not is_catalog_overview(R, bot.reply), bot.reply
    assert is_urgent_medical(R, bot.reply) or is_medical_forward(R, bot.reply), bot.reply


@defect
@pytest.mark.parametrize("msg", [
    "how long does the treatment take?",
    "how long will the treatment be?",
])
def test_duration_guard_covers_more_english_phrasings(bot, R, msg):
    bot.say(msg)
    assert is_duration_deflection(R, bot.reply), f"{msg!r} → {bot.reply!r}"


# ── §2D  Treatment matching is literal-substring only ────────────────────────

@defect
@pytest.mark.parametrize("msg", [
    "עיסוי שוודדי",        # doubled letter
    "עסוי שוודי",          # missing yod
    "eesui shvedi",        # transliteration
])
def test_typos_still_resolve_to_the_treatment(bot, msg):
    bot.say(msg)
    assert "עיסוי שוודי" in bot.reply, f"{msg!r} → {bot.reply!r}"


# ── §2E  The [שם בלבד] marker is defeated by the detail cap ──────────────────

@defect
@pytest.mark.parametrize("cat", ["CAT-03", "CAT-04", "CAT-07", "CAT-01"])
def test_every_treatment_claimed_as_detailed_actually_has_detail_in_the_prompt(R, DB, cat):
    """_llm_respond marks a treatment [שם בלבד] based on _has_detail() against
    the whole DB, but the detail block is capped at 2000 chars. Treatments whose
    detail was dropped by the cap are still presented to the model as documented
    — so the model is told it has data it was never given."""
    treatments = DB.get_treatments_in_category(cat)
    claimed = [t for t in treatments if R._has_detail(t)]
    block = R._build_scoped_detail_block(cat, None)
    missing = [t["treatment_name"] for t in claimed if t["treatment_name"] not in block]
    assert not missing, (
        f"{cat}: {len(missing)}/{len(claimed)} treatments are presented to the LLM as "
        f"documented but their detail was dropped by the {R._DETAIL_BLOCK_CAP}-char cap: "
        f"{missing}"
    )


@defect
def test_llm_temperature_is_zero_for_grounded_answers(R, monkeypatch):
    """0.4 invites the model to paraphrase facts. A retrieval-grounded bot
    should be at 0."""
    captured = {}

    class _Resp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}

    def _post(url, params=None, json=None, timeout=None):
        captured.update(json or {})
        return _Resp()

    monkeypatch.setattr(R.requests, "post", _post)
    R._call_gemini("sys", "user", key="k")
    assert captured["generationConfig"]["temperature"] == 0


# ── §2F  Recommendation flow ─────────────────────────────────────────────────

@defect
def test_interrupting_at_question_one_does_not_lose_the_flow(bot):
    """_make_continue_offer() requires flow_answers to be non-empty, so a
    customer who asks a side question before answering Q1 has no way back."""
    bot.click("__start_flow__:CAT-03")
    resp = bot.say("רגע, איפה אתם ממוקמים?")
    assert resp.get("offer_continue") is not None, \
        "flow was silently abandoned after one side question"


@defect
@pytest.mark.parametrize("msg", ["לא יודעת", "לא בטוחה", "אין לי העדפה"])
def test_free_text_during_the_flow_is_understood(bot, R, msg):
    """Customers type instead of clicking. Today this returns 'I didn't
    understand' and drops them out of the questionnaire."""
    bot.click("__start_flow__:CAT-03")
    bot.say(msg)
    assert not is_unclear(R, bot.reply), f"{msg!r} → {bot.reply!r}"


@defect
def test_facial_flow_has_a_contraindication_gate(DB):
    """CAT-04 asks about pregnancy and has a terminal gate for it. CAT-03 never
    asks, so a pregnant customer completes the facial questionnaire unscreened."""
    rows = DB.get_questions_for_category("CAT-03")
    text = " ".join((r["question_text"] or "") + " " + (r["option_label"] or "") for r in rows)
    assert any(k in text for k in ("הריון", "היריון", "רפואי", "תרופ")), \
        "CAT-03 questionnaire has no pregnancy/medical screening question"


@defect
def test_no_preference_option_affects_the_outcome(DB):
    """CAT-03 Q2 offers 'אין לי העדפה' but that option has no rows in
    Recommendation_Scoring, so choosing it makes the entire question a no-op —
    the customer answers a question that cannot change their recommendation."""
    scored = {(r["question_id"], r["option_value"])
              for r in DB.get_scoring_for_category("CAT-03")}
    assert ("Q2", "any") in scored


@defect
@pytest.mark.parametrize("cat", ["CAT-01", "CAT-02", "CAT-05", "CAT-06",
                                 "CAT-07", "CAT-08", "CAT-09"])
def test_every_category_offers_a_questionnaire(DB, cat):
    """Only CAT-03 and CAT-04 have one, so 'help me choose' is unavailable for
    laser, nails, hair, aesthetics, brows, makeup and styling."""
    assert DB.get_unique_question_ids(cat), f"{cat} has no recommendation questions"


# ── §2G  Data coverage and comparison scope ──────────────────────────────────

# FIXED — a comparison now covers only the treatments that were named.
# Promoted to test_regression.py::test_comparison_covers_only_the_named_treatments.


@defect
@pytest.mark.parametrize("cat", ["CAT-01", "CAT-02", "CAT-05", "CAT-06",
                                 "CAT-07", "CAT-08", "CAT-09"])
def test_every_category_has_treatment_detail(DB, R, cat):
    """67% of treatments (90/135) have nothing but a name and one line.
    Five categories have zero attributes — including הסרת שיער (22 treatments)
    and טיפולי אסתטיקה (17, botox/fillers), the most safety-sensitive ones."""
    treatments = DB.get_treatments_in_category(cat)
    detailed = [t for t in treatments if R._has_detail(t)]
    assert len(detailed) == len(treatments), \
        f"{cat}: only {len(detailed)}/{len(treatments)} treatments have any attributes"


@defect
def test_good_for_is_populated_for_every_treatment(DB):
    """good_for drives both the comparison feature and recommendation cards,
    but exists for only 30 of 135 treatments."""
    missing = [t["treatment_id"] for t in DB.get_all_treatments_summary()
               if not (t.get("good_for") or "").strip()]
    assert not missing, f"{len(missing)}/135 treatments have no good_for"
