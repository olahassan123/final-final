# -*- coding: utf-8 -*-
"""Recommendation flow (mode 2) — MUST NOT REGRESS.

The questionnaire is the part of the system that already works well, so it gets
the strictest lock: every reachable answer path is walked and its outcome
pinned. Any change to the questions, the scoring weights or the flow engine that
alters a recommendation will fail here.
"""
import itertools

import pytest


def option_widths(DB, cat):
    return [
        len({r["option_value"] for r in DB.get_questions_for_category(cat)
             if r["question_id"] == q})
        for q in DB.get_unique_question_ids(cat)
    ]


def walk(bot, cat, picks):
    """Start the flow and answer each question with the option at index picks[i].
    Returns the final response. Stops early on a terminal gate."""
    resp = bot.click(f"__start_flow__:{cat}")
    for pick in picks:
        buttons = resp.get("buttons") or []
        qid = buttons[0].get("question_id") if buttons else None
        if not qid:
            break                      # terminal gate or flow finished
        b = buttons[min(pick, len(buttons) - 1)]
        resp = bot.click(b["value"], question_id=qid)
    return resp


# ── Structure ────────────────────────────────────────────────────────────────

def test_exactly_two_categories_have_a_questionnaire(DB):
    """Pinned so that ADDING a questionnaire is a deliberate, visible change."""
    with_q = [c["category_id"] for c in DB.get_categories()
              if DB.get_unique_question_ids(c["category_id"])]
    assert with_q == ["CAT-03", "CAT-04"]


@pytest.mark.parametrize("cat,n_questions", [("CAT-03", 4), ("CAT-04", 3)])
def test_question_count(DB, cat, n_questions):
    assert len(DB.get_unique_question_ids(cat)) == n_questions


@pytest.mark.parametrize("cat", ["CAT-03", "CAT-04"])
def test_every_question_has_at_least_two_options(DB, cat):
    for q in DB.get_unique_question_ids(cat):
        rows = [r for r in DB.get_questions_for_category(cat) if r["question_id"] == q]
        assert len(rows) >= 2, f"{cat}/{q} has {len(rows)} option(s)"
        assert rows[0]["question_text"], f"{cat}/{q} has no question text"


@pytest.mark.parametrize("cat", ["CAT-03", "CAT-04"])
def test_every_scoring_row_points_at_a_real_treatment(DB, cat):
    for row in DB.get_scoring_for_category(cat):
        t = DB.get_treatment_by_id(row["treatment_id"])
        assert t, f"{cat}: scoring references unknown treatment {row['treatment_id']}"
        assert t["category_id"] == cat, \
            f"{cat}/{row['question_id']} scores {row['treatment_id']} from {t['category_id']}"


@pytest.mark.parametrize("cat", ["CAT-03", "CAT-04"])
def test_no_new_dead_options_are_introduced(DB, cat):
    """An option that scores nothing and gates nothing is dead weight — the
    customer answers a question that cannot change the recommendation.
    CAT-03 Q2/'any' is already dead; see test_known_defects. This test pins the
    set so no NEW dead option appears."""
    known_dead = {"CAT-03": {"Q2/any"}, "CAT-04": set()}[cat]
    scored = {(r["question_id"], r["option_value"]) for r in DB.get_scoring_for_category(cat)}
    dead = set()
    for r in DB.get_questions_for_category(cat):
        if r.get("terminal_treatment_id"):
            continue
        if (r["question_id"], r["option_value"]) not in scored:
            dead.add(f"{r['question_id']}/{r['option_value']}")
    assert dead <= known_dead, f"{cat}: new dead options: {sorted(dead - known_dead)}"


# ── Exhaustive walk ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("cat", ["CAT-03", "CAT-04"])
def test_every_path_produces_a_real_recommendation(bot_factory, DB, R, cat):
    """72 paths per category. Every one must end with a non-empty reply naming
    at least one treatment that actually belongs to this category."""
    valid_names = {t["treatment_name"] for t in DB.get_treatments_in_category(cat)
                   if t.get("treatment_name")}
    widths = option_widths(DB, cat)
    failures = []
    for picks in itertools.product(*[range(w) for w in widths]):
        b = bot_factory()
        resp = walk(b, cat, picks)
        reply = (resp.get("reply") or "").strip()
        if not reply:
            failures.append((picks, "empty reply"))
        elif not any(n in reply for n in valid_names):
            failures.append((picks, reply[:80]))
    assert not failures, f"{cat}: {len(failures)} bad paths, e.g. {failures[:3]}"


@pytest.mark.parametrize("cat,expected", [("CAT-03", 12), ("CAT-04", 15)])
def test_distinct_outcome_count_is_stable(bot_factory, DB, cat, expected):
    """Pinned so a scoring-weight edit that collapses or splits outcomes is
    visible rather than silent."""
    widths = option_widths(DB, cat)
    outcomes = set()
    for picks in itertools.product(*[range(w) for w in widths]):
        b = bot_factory()
        outcomes.add((walk(b, cat, picks).get("reply") or "")[:150])
    assert len(outcomes) == expected


@pytest.mark.parametrize("cat,picks,expected", [
    ("CAT-03", (0, 0, 0, 0), "מידיי קלאסי"),
    ("CAT-03", (0, 0, 0, 1), "מידיי קלאסי לגבר"),
    ("CAT-03", (1, 1, 0, 0), "STOP ACNE"),
    ("CAT-03", (3, 1, 0, 0), "LIFTING PRO"),
    ("CAT-03", (4, 0, 0, 0), "PARTY"),
    ("CAT-04", (0, 0, 0), "עיסוי שוודי"),
    ("CAT-04", (1, 0, 0), "עיסוי רקמות עמוק"),
    ("CAT-04", (2, 0, 0), "עיסוי ספורטאים"),
    ("CAT-04", (3, 0, 0), "שיאצו"),
])
def test_specific_paths_reach_specific_treatments(bot, cat, picks, expected):
    resp = walk(bot, cat, picks)
    assert expected in (resp.get("reply") or ""), resp.get("reply")


# ── Safety gate ──────────────────────────────────────────────────────────────

def test_pregnancy_gate_short_circuits_the_body_flow(bot, DB):
    """CAT-04 Q1 has a pregnancy option with a terminal_treatment_id. Selecting
    it must jump straight to the pregnancy massage, skipping the rest."""
    resp = bot.click("__start_flow__:CAT-04")
    buttons = resp.get("buttons") or []
    terminal = [b for b in buttons if b.get("terminal_treatment_id")]
    assert terminal, "CAT-04 Q1 no longer has a terminal gate"
    resp = bot.click(terminal[0]["value"], question_id=terminal[0]["question_id"])
    assert "הריון" in (resp.get("reply") or "")


# ── Flow control buttons ─────────────────────────────────────────────────────

def test_restart_resets_the_questionnaire(bot, DB):
    resp = bot.click("__start_flow__:CAT-03")
    first = resp["buttons"][0]
    bot.click(first["value"], question_id=first["question_id"])
    assert bot.session()["flow_question_index"] == 1
    bot.click("__restart__")
    s = bot.session()
    assert s["flow_question_index"] == 0
    assert s["flow_scores"] == {}
    assert s["flow_answers"] == []


def test_not_now_exits_the_flow_cleanly(bot):
    bot.click("__start_flow__:CAT-03")
    bot.click("__not_now__")
    s = bot.session()
    assert s["mode"] == "general"
    assert s["flow_category_id"] is None


def test_no_thanks_after_the_offer_does_not_start_a_flow(bot):
    resp = bot.click("__no_recommendation__")
    assert resp["mode"] == "general"
    assert not resp.get("buttons")


def test_starting_a_flow_for_a_non_recommendation_category_is_refused(bot, R):
    """CAT-05 has has_recommendation=0 — the button must not open an empty flow."""
    resp = bot.click("__start_flow__:CAT-05")
    assert bot.session().get("mode") != "in_flow"


# ── Interruption behaviour (partially defective — see test_known_defects) ────

def test_price_question_mid_flow_is_still_deflected(bot, R):
    from conftest import is_price_deflection
    bot.click("__start_flow__:CAT-03")
    bot.say("כמה זה עולה?")
    assert is_price_deflection(R, bot.reply)


def test_continue_is_offered_after_answering_then_interrupting(bot):
    """Once at least one question is answered, the Continue offer works."""
    resp = bot.click("__start_flow__:CAT-03")
    first = resp["buttons"][0]
    bot.click(first["value"], question_id=first["question_id"])
    resp = bot.say("איפה אתם ממוקמים?")
    offer = resp.get("offer_continue")
    assert offer and offer["category_id"] == "CAT-03"
    assert offer["questions_answered"] == 1


def test_continue_resumes_where_the_customer_left_off(bot):
    resp = bot.click("__start_flow__:CAT-03")
    first = resp["buttons"][0]
    bot.click(first["value"], question_id=first["question_id"])
    bot.say("איפה אתם ממוקמים?")
    resp = bot.click("__continue__")
    assert bot.session()["mode"] == "in_flow"
    assert bot.session()["flow_question_index"] == 1
