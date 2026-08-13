# MeDay Chatbot — Failure Analysis & Recommended Strategy

Written after reading `chatbot_router.py`, `chatbot_flow.py`, `chatbot_db.py` and the
`MeDay_Treatments_Data_finalalmost.xlsx` workbook, and after driving `handle_message()`
directly with ~70 simulated customer messages.

Every defect below was **reproduced**, not guessed. The reproduction command is at the
bottom.

---

## 0. Two things are broken right now, before any logic discussion

**0.1 — The live `chatbot.db` is missing a column the code writes.**

```
cb_sessions columns: session_id, mode, flow_category_id, flow_question_index,
                     flow_scores, flow_answers, recent_context, last_treatment_id,
                     updated_at, answered_fields
```

`save_session()` writes `conversation_state`, which is not there. **Every single chat
message raises `OperationalError: table cb_sessions has no column named
conversation_state`.** The migration in `chatbot_db.py:152` is correct — it just has
never run against this database, i.e. the backend has not been restarted since
`conversation_state` was introduced. Restarting the backend fixes it. Until then the
chatbot is 100% down.

**0.2 — The Gemini API key in the database is not a Gemini key.**

`cb_settings.llm_api_key` starts with `AQ.Ab8RN6JS…`. Gemini keys start with `AIza`.
`llm_last_status` is already `invalid_key`. So the entire LLM layer is dark and the bot
is running only on its deterministic keyword layer. Most of what follows describes that
layer, because that is what customers are actually talking to today.

---

## 1. The core diagnosis

The router is a hand-ordered `if/elif` chain of ~20 detectors. Each detector is a
substring test against a hand-written multilingual keyword list, and the **first one that
matches wins and returns immediately**. That design has three structural failure modes,
and all three are firing in production.

| Failure mode | What it looks like | Why it is inherent |
|---|---|---|
| **False positive** | A keyword appears inside an unrelated sentence and hijacks the reply | Substring matching has no notion of sentence meaning |
| **False negative** | The user's phrasing isn't in the list, so a *safety guard* is skipped | The list is finite; natural language is not |
| **Order coupling** | An early cheap detector swallows a message meant for a later, more important one | Priority is encoded as line number |

On top of that sits `_match_faq()`, a fuzzy matcher that fires on **≥2 overlapping
tokens** with substring-based token hits. It is positioned as a late catch-all, which
means it converts "I don't know" into **a confident, fluent, wrong answer**. That is the
single worst outcome for a clinic bot — worse than silence, because the customer cannot
tell it is wrong.

---

## 2. Reproduced defects

### 2A. Scope detection — your requirement #1

**The scope decline almost never fires.** There are only two ways to get the proper "I
only answer MeDay questions" reply, and both are narrow:
- the message contains one of 14 hardcoded words in `_UNRELATED_KW`
  (`משחק, ניצח, פוליטי, שיעורי בית, מזג אוויר, sports, game, won, politics, homework, programming, weather, trivia`), **or**
- it has no clinic vocabulary *and* no session history — and even then line 2559 returns
  `_unclear_reply()`, **not** `_out_of_scope_reply()`.

Result — everything else off-topic gets *"sorry, I didn't understand the question"*,
which tells the customer to rephrase and try again. They will.

| Customer message | Actual reply | Should be |
|---|---|---|
| `תכתבי לי קוד פייתון שממיין רשימה` | "Sorry, I didn't understand — try rephrasing" | Scope decline |
| `מה דעתך על ביבי?` | "Sorry, I didn't understand" | Scope decline |
| `המליצי לי על מסעדה טובה` | "Sorry, I didn't understand" | Scope decline |
| `כמה קלוריות יש בסלט?` | "Sorry, I didn't understand" | Scope decline |
| `איזה מתכון יש לך לשקשוקה?` | "Sorry, I didn't understand" | Scope decline |
| `מה השם שלך ומי בנה אותך?` | "Sorry, I didn't understand" | Short identity answer |
| `מי ניצח במונדיאל?` | ✅ correct scope decline | (only because `ניצח` is hardcoded) |

**Worse — off-topic messages that hit a keyword and get a confidently wrong answer:**

| Customer message | Actual reply | Root cause |
|---|---|---|
| `מה מזג האוויר בחיפה מחר?` | Booking flow: *"to check availability, contact us on WhatsApp"* + 3 booking buttons | `"מחר"` is in `_AVAILABILITY_KW` (line 428) |
| `כמה זה 17 כפול 23?` | Price deflection: *"pricing is best answered by our team, call *3691"* | `"כמה זה"` is in `_PRICE_KW` (line 195) |
| `איפה אפשר לקנות איפור זול בחיפה?` | Price deflection | `"זול"` is in `_PRICE_KW` |

`מחר` (tomorrow) as an availability keyword is especially costly — **any** sentence
mentioning tomorrow becomes a booking hand-off.

### 2B. Fuzzy FAQ matching — the biggest hallucination source

`_match_faq()` (line 1185) requires only 2 shared tokens, and `_tok_hit()` (line 1177)
counts a hit when either token is a ≥4-char substring of the other. With 27 FAQs and
Hebrew's short function words, this fires constantly on questions it has no answer for.

| Customer message | FAQ served | Why it's wrong |
|---|---|---|
| `האם הסרת שיער בלייזר כואבת?` | **FAQ-01** — post-laser 24h instructions: *"expect redness, mild heat or slight burning… do not touch, rub or scratch the treated area"* | Asked **does it hurt**, told **aftercare side effects**. Reads like an answer. Is not one. |
| `אני לוקחת רואקוטן, אפשר לעשות לייזר?` | **FAQ-01** — same post-laser text | ⚠️ **Safety.** Isotretinoin + laser is a genuine contraindication. The bot effectively answers "here's what to expect after your laser." No medical forward, no caution. |
| `איך מתכוננים לאיפור כלה?` | **FAQ-24** — permanent-makeup *healing* process | Asked about **bridal makeup prep**, got **permanent-makeup recovery** |
| `טיפולי פניםםם` (just a typo'd noun, no question) | **FAQ-18** — post-facial aftercare | User asked nothing; got aftercare instructions |
| `כמה שקלים לטיפול?` | **FAQ-26** — how long before an event to book a facial | A **price** question that slipped past the price guard entirely |

That last row is two bugs at once, which is why it matters most.

### 2C. Hard guards leak in both directions

**Price guard — false negatives (bypassed):**

| Phrase | `_is_price()` |
|---|---|
| `כמה שקלים לטיפול` | ❌ **False** |
| `כמה כסף` | ❌ **False** |
| `₪` | ❌ **False** |
| `מה המחיר` / `מה העלות` / `מחירון` | ✅ True |

**Guards pre-empted by an earlier detector — the ordering bug:**

`_should_clarify_before_treatment()` runs at line 2341, **before every guard**.
`_norm_tokens()` drops words shorter than 3 characters, so a short message can be
left with one token, judged "unclear", and returned on before any guard sees it.

| Message | Guard that should fire | Fires? | Actual reply |
|---|---|---|---|
| `יש מבצעים?` | `_is_price` → **True** | ✗ pre-empted | "I didn't understand" |
| `יש לי דימום` (*I'm bleeding*) | `_is_urgent_medical_question` → **True** | ✗ pre-empted | "I didn't understand" |

`דימום` **is** in `_URGENT_MEDICAL_KW`. The guard is written correctly and simply never
runs. **A guard that runs after a catch-all is not a guard** — and here that swallows a
customer reporting bleeding.

**Duration guard — English recall gap:** `how long does it take?` ✅ works;
`how long does the treatment take?` ❌ falls through to a full catalog dump.

**Medical guard — misses drug names and injuries:**

| Message | Guard result | Actual reply |
|---|---|---|
| `אני לוקחת רואקוטן, אפשר לעשות לייזר?` | `_is_medical_safety_question` → **False** | Wrong laser FAQ |
| `יש לי כוויה מהטיפול אתמול` (a burn from yesterday's treatment) | `_is_urgent_medical_question` → **False** | **Dumps the full service catalog** with "pick an area to hear more 💛" |

The medical list has the *word* `תרופה`, but no drug names; the urgent list has
`כאב חזק` and `דימום` but not `כוויה`. A customer reporting an injury gets a menu.

### 2D. Treatment matching is literal-substring only

`_match_treatment()` (line 1205) requires the treatment name to appear **verbatim**,
≥5 chars. There is no fuzzy tolerance at all:

| Message | Matched treatment |
|---|---|
| `עיסוי שוודי` | ✅ עיסוי שוודי |
| `עיסוי שוודדי` (one doubled letter) | ❌ nothing → generic category menu |
| `eesui shvedi` (transliteration) | ❌ nothing → "I didn't understand" |

Hebrew typists produce these constantly.

### 2E. The `[שם בלבד]` protection is defeated by the character cap

This is the most important LLM-side finding.

In `_llm_respond()`, treatments the DB has no attributes for are labelled `[שם בלבד]`
(name only) so the model won't invent details — good design. But the **detail block is
capped at 2000 chars** (`_DETAIL_BLOCK_CAP`, line 759) while the `[שם בלבד]` labels are
computed from `_has_detail()` against the *full* database.

Measured:

| Category | Treatments | Have detail | Full block | After 2000-char cap | Detail actually sent |
|---|---|---|---|---|---|
| CAT-03 קוסמטיקה | 13 | 13 | 9,508 ch | 1,582 ch | **2 of 13** |
| CAT-04 גוף | 17 | 17 | 9,402 ch | 1,753 ch | **3 of 17** |
| CAT-07 איפור קבוע | 21 | 10 | 6,236 ch | 1,914 ch | **3 of 10** |
| CAT-01 מניקור | 20 | 6 | 3,025 ch | 1,485 ch | **3 of 6** |

So for a facial question the model is shown 13 treatment names **with no `[שם בלבד]`
marker** — i.e. told "you have data on all of these" — while receiving actual data for
only 2. Prompt rule #4 says *"don't invent information not present here."* Rule #6's
escape hatch is unavailable, because these treatments aren't marked. **The model is
structurally set up to fill in 11 gaps from general beauty knowledge.** That is your
hallucination engine.

Two smaller prompt issues: `temperature: 0.4` is too high for a strictly grounded bot
(use `0`), and when a treatment is locked the FAQ block is filtered to `GENERAL` only
(line 1980) — so treatment-specific FAQs disappear exactly when they're most relevant.

### 2F. Recommendation flow (mode 2)

Exhaustively walked every path: **CAT-03 = 72 paths → 12 distinct outcomes; CAT-04 = 72
paths → 15 outcomes.** The scoring engine itself works, and the CAT-04 pregnancy
terminal gate correctly short-circuits to *עיסוי לנשים בהריון*. Problems:

0. **CAT-03 Q2 has a dead option.** `Q2/any` ("אין לי העדפה") has **no rows** in
   `Recommendation_Scoring`. Choosing it makes the entire question a no-op — the
   customer is asked something that cannot change their recommendation. Either give it
   scoring weights or remove the option.

1. **Interrupting at Q1 destroys the flow.** `_make_continue_offer()` returns `None`
   unless `flow_answers` is non-empty. A customer who starts the questionnaire and asks
   "wait, where are you located?" before answering Q1 gets the address and **no way
   back** — `offer_continue=None`. Verified for all four interruption messages tested.
2. **Free text mid-flow is not understood.** Typing `לא יודעת` ("I don't know") instead
   of clicking a button → *"sorry, I didn't understand the question."* Customers type.
3. **CAT-03 has no pregnancy / contraindication gate**, while CAT-04 does. A pregnant
   customer going through the facial questionnaire is never asked.
4. **Q1 dominates the score.** In CAT-03, Q3 (upcoming event) and Q4 (who for) change
   the outcome in only a minority of paths — the questionnaire feels longer than it is
   informative.
5. **7 of 9 categories have no questionnaire at all** (only CAT-03 and CAT-04 do), so
   "help me choose" is unavailable for laser, nails, hair, aesthetics, brows, makeup and
   styling.

### 2G. Data coverage — the ceiling on everything above

```
135 treatments total
  short_description       135   ✅
  subgroup                130
  preparation              45   (33%)
  aftercare                45
  downtime                 45
  pain_level               45
  sessions_recommended     45
  results_longevity        45
  what_to_expect           45
  good_for                 30   (22%)
  technique_or_equipment   14
  aliases                  18   (13%)
```

Per category:

| Category | Treatments | With detail | With `good_for` | Questionnaire |
|---|---|---|---|---|
| CAT-01 מניקור ופדיקור | 20 | 6 | 0 | ✗ |
| CAT-02 עיצוב שיער | 20 | **0** | 0 | ✗ |
| CAT-03 טיפולי קוסמטיקה | 13 | 13 | 13 | ✓ (4 q) |
| CAT-04 טיפולי גוף | 17 | 16 | 17 | ✓ (3 q) |
| CAT-05 הסרת שיער | 22 | **0** | 0 | ✗ |
| CAT-06 איפור מקצועי | 3 | **0** | 0 | ✗ |
| CAT-07 איפור קבוע וגבות | 21 | 10 | 0 | ✗ |
| CAT-08 סטיילינג אישי | 2 | **0** | 0 | ✗ |
| CAT-09 טיפולי אסתטיקה | 17 | **0** | 0 | ✗ |

**90 of 135 treatments (67%) have nothing but a name and a one-line description.** Five
whole categories have zero attributes — including הסרת שיער (22 treatments) and טיפולי
אסתטיקה (17, i.e. botox and fillers), which are exactly the ones customers ask detailed
and medically-sensitive questions about.

`good_for` existing only in CAT-03/04 also breaks `_build_comparison()` elsewhere: it
prints bullet points with no differentiating text. And that function ignores the
treatments the user actually named — asking *"what's the difference between Swedish
massage and deep tissue?"* lists **all 17** body treatments instead of the two.

---

## 3. Recommended strategy

The goal: **make it structurally impossible for the bot to state a fact that isn't in the
Excel.** Not "discourage it via prompt rules" — impossible.

### The architectural change: invert the pipeline

Today: `keywords answer first → LLM writes prose as a fallback`.
The LLM is the component with the widest latitude and the least supervision.

Proposed: **the LLM understands, your code answers.**

```
customer message
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ STAGE 1 — UNDERSTAND (one LLM call, closed vocabulary)  │
│ Input : message + last 6 turns + category/treatment IDs │
│ Output: STRICT JSON, no prose:                          │
│   { in_scope, intent, category_id, treatment_id,        │
│     fields[], language, safety_flag, confidence }       │
│ IDs must come from the enum — model cannot invent them  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ STAGE 2 — DECIDE (pure Python, deterministic)           │
│  in_scope=false        → scope decline                  │
│  safety_flag           → medical forward (overrides all)│
│  intent=price|duration → forward template               │
│  confidence < 0.6      → ONE clarifying question+buttons│
│  field empty in DB     → "team will tell you" forward   │
│  otherwise             → compose from DB columns        │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ STAGE 3 — PHRASE (optional 2nd LLM call, tone only)     │
│ Input : the DB text your code already produced          │
│ Task  : rewrite warmly in the user's language           │
│ Rule  : add no facts, no numbers, no new treatment names│
│ Then  : verify — any digit or treatment name that isn't │
│         in the input → discard, send the plain version  │
└─────────────────────────────────────────────────────────┘
```

Why this fixes hallucination *by construction*: the customer-visible fact surface is
always text your code read out of the database. Stage 1 can misunderstand — that produces
a wrong-but-real answer or a clarifying question, both recoverable. It cannot invent a
treatment, a price, or a medical claim, because it never writes the reply.

It also fixes typos, transliteration, paraphrase and multi-intent for free — that's what
the model is genuinely good at, and it is the only part of the job you're currently
*not* using it for.

### Scope detection — make it two questions, not one

You are conflating two different situations. Separate them:

| | Meaning | Reply |
|---|---|---|
| **Out of domain** | Not about beauty/clinic at all — weather, politics, math, code | Scope decline. Never forward to `*3691`. |
| **In domain, no data** | Real clinic question we can't answer — availability, staff, medical suitability, a `[name only]` treatment | Warm forward to `*3691`. Never decline. |
| **In domain, have data** | Answerable from the Excel | Answer from the DB |

Today both of the first two collapse into *"sorry, I didn't understand"*, which is the
worst wording for either. Add `in_scope` **and** `answerable` to the Stage-1 JSON and
route on the pair.

### Rebuild the guards as vetoes, not as early returns

The ordering bug (`יש מבצעים?`) exists because guards are `if` branches racing each other
down the function. Instead:

1. Run **all** detectors, collect flags — don't return from any of them.
2. Apply a fixed precedence table: `urgent_medical > medical_safety > price > duration > booking > …`
3. Compose the answer.
4. **Post-check the finished reply**: if it contains a currency symbol, a `₪`, or a
   digit-sequence that looks like a price, replace it with the price template.

That last step is the belt-and-braces you actually want — it holds no matter which path
produced the text, including the LLM's. Add regex coverage for the misses found:
`שקל|₪|כמה כסף|כמה יוצא|תמחור|כמה תעלה`.

Similarly, `_is_unclear_message()` must run **last**, not first. "Unclear" is a
conclusion, not a precondition.

### Fix the FAQ matcher — precision over recall

`_match_faq` at threshold 2 is the top source of confident wrong answers. Three changes:

1. Raise the bar: require ≥3 significant shared tokens **and** ≥50% of the FAQ's own
   significant tokens covered — not just 2 hits anywhere.
2. Drop the substring `_tok_hit` fallback, or restrict it to a real Hebrew prefix strip
   (`ב/ל/ו/ש/כ/מ/ה`) rather than any ≥4-char containment.
3. **Gate by category.** If Stage 1 resolved the topic to CAT-05, only CAT-05 and GENERAL
   FAQs are eligible. `איך מתכוננים לאיפור כלה?` could never have returned FAQ-24 under
   this rule.

Cheapest immediate mitigation if you change nothing else: raise the threshold to 3 and
add the category gate. That alone kills four of the five rows in §2B.

### Fix the LLM prompt

- Remove or raise `_DETAIL_BLOCK_CAP`, **and** — critically — compute the `[שם בלבד]`
  marker from *what actually got into the prompt*, not from `_has_detail()`. One line,
  removes the largest hallucination vector. If you must cap, mark the dropped ones.
- `temperature: 0` for anything grounded.
- Don't filter FAQs to `GENERAL` when a treatment is locked — include that treatment's
  category FAQs.
- Add an explicit `"grounded": true|false` output field and drop any reply where the
  model itself reports false.

### Grounding gate (the rule to enforce everywhere)

> Never emit a claim about a treatment unless the specific DB column is non-empty.

`_has_detail()` already implements this idea; it just isn't applied consistently — the
`_general_background_reply` path and the LLM path both bypass it. Make it a single
chokepoint every answer passes through.

### Flow fixes

- Persist `flow_category_id` + `flow_question_index` on interrupt, and offer Continue
  whenever a flow is *open*, not only when ≥1 question is answered.
- Route free text typed during the flow through Stage 1: if it's an answer to the current
  question, score it; if it's a side question, answer it and re-ask the current question
  in the same reply.
- Add a pregnancy/contraindication gate to CAT-03 mirroring CAT-04's.
- Add a "not sure / skip" option to every question.
- Consider dropping CAT-03 Q4 or merging Q3 into Q1 — they carry little scoring signal.

### Data work (this is the real ceiling)

No architecture recovers information that isn't in the workbook. Priority order by
customer impact:

1. **CAT-05 הסרת שיער** (22 treatments, 0 attributes) — highest question volume,
   medically sensitive.
2. **CAT-09 טיפולי אסתטיקה** (17, 0 attributes) — botox/fillers, highest medical risk.
3. **CAT-02 עיצוב שיער** (20, 0) and **CAT-01 מניקור** (14 of 20 missing).
4. `good_for` for all 135 — it drives both the comparison feature and the recommendation
   cards, and exists for only 30.
5. `aliases` for the top ~30 treatments — this is what makes name matching survive
   real-world phrasing.

Add a CI check that fails when a treatment has a `treatment_id` but no `short_description`
+ `good_for`, so coverage can't silently regress.

---

## 4. Suggested order of work

| # | Change | Effort | Impact |
|---|---|---|---|
| 0 | ✅ **Regression suite** (`backend/tests/`) — done | — | Makes everything below verifiable |
| 1 | Restart backend (applies the `conversation_state` migration) | minutes | **Bot is down without it** |
| 2 | Install a valid `AIza…` Gemini key | minutes | LLM layer is dark |
| 3 | Fix the `[שם בלבד]` / detail-cap mismatch; `temperature: 0` | ~1h | Kills the top LLM hallucination vector |
| 4 | FAQ threshold 3 + category gate | ~1h | Kills the top deterministic wrong-answer vector |
| 5 | Remove `מחר` from availability; add missing price patterns; move `_is_unclear_message` last | ~2h | Fixes the reproduced misroutes |
| 6 | Split scope into out-of-domain vs no-data; correct wording for each | ~3h | **Your requirement #1** |
| 7 | Add drug names + injury words to the medical/urgent guards | ~2h | Safety |
| 8 | Stage 1 intent-classifier LLM call, closed vocabulary | ~2 days | The structural fix |
| 9 | Stage 2 deterministic composition + post-check veto | ~2 days | Makes hallucination impossible |
| 10 | Flow: continue-on-interrupt, free-text answers, CAT-03 safety gate | ~2 days | Completes mode 2 |
| 11 | Fill the Excel gaps (CAT-05, CAT-09, CAT-02, `good_for`, `aliases`) | ongoing | Raises the ceiling |

Items 1–7 are surgical and can ship this week against the current architecture. Items 8–10
are the redesign. Item 11 gates how good any of it can get.

---

## 5. The regression suite (`backend/tests/`)

Built before any behaviour change, so a large refactor can be verified rather than
hoped at.

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/ -q
```

Current: **100 passed, 54 xfailed.**

Every test runs against a **copy** of `chatbot.db` in pytest's tmp dir — the real
database is never touched, and the copy is migrated on creation, so the suite is immune
to the §0.1 problem. The LLM is stubbed; tests are deterministic and offline.

| File | Contains |
|---|---|
| `conftest.py` | DB copy fixture, a `Bot` conversation helper, and behaviour classifiers |
| `test_regression.py` | **Must not regress.** Price/duration/medical guards, booking, logistics, small talk, catalog, treatment cards, field answers, language matching, and a global "no reply may ever contain a price" invariant |
| `test_flow.py` | **All 144 questionnaire paths walked**, outcome counts pinned, scoring integrity, the pregnancy gate, and every flow control button |
| `test_known_defects.py` | Every defect in §2, written as the behaviour we *want* |

The classifiers compare against the router's **own template functions**, not hardcoded
strings — so re-wording a reply never breaks a test, while a change in *which* template
gets chosen (a routing change) always does.

Defects are `xfail(strict=True)`: while the bug exists the suite is green; the moment it
is fixed the test reports **XPASS as a failure**, forcing you to delete the marker and
promote it into the permanent suite. Bugs cannot be fixed and then quietly re-broken.

Writing the suite immediately surfaced three defects the manual probing had missed:
the `יש לי דימום` ordering bug, the English duration gap, and the dead `Q2/any` option.
