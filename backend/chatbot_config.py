import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

# ── Tunable after watching real conversations ─────────────────────
# Lower to 0.5 if the bot forwards too often; raise to 0.85 if wrong FAQ matches appear.
CONFIDENCE_THRESHOLD = 0.70

# How many recent messages to keep for coreference ("how long is it?" resolves to last treatment).
MAX_CONTEXT_MESSAGES = 6
MAX_CHAT_MESSAGE_CHARS = 1000
CHAT_SESSION_EXPIRY_DAYS = 14

CLINIC_PHONE = "*3691"
# Optional LLM layer. Provider is Google Gemini.
# The API key is stored in the DB (cb_settings 'llm_api_key') so the clinic can
# paste a fresh free key from the admin page — env GEMINI_API_KEY is a fallback.
# NOTE: gemini-2.0-flash returns free-tier limit:0 on some accounts/regions.
# MEASURED 2026-08-19: gemini-flash-latest resolved to a model whose free-tier
# allowance on our project was only 20 requests PER DAY, exhausted in a
# handful of conversations.
# MEASURED 2026-08-20, directly against this project's key: gemini-2.5-flash
# now returns 404 — "no longer available to new users". gemini-3.6-flash
# (Google's own suggested replacement) works but is a "thinking" model and
# was measured at 14-46s for a single chatbot reply (real system prompt,
# thinkingLevel:"low") — unusable latency for a chat button. Same exact
# prompt against gemini-flash-lite-latest: ~1-2s, correct, equally grounded
# output. Lite is the right tier for this app's short classify/phrase calls;
# it was never a Flash-vs-Lite quality tradeoff, it was a thinking-overhead
# problem. If Gemini deprecates this alias too, re-run the same before/after
# timing check before guessing a new one — model aliases on this API have
# broken this integration more than once; don't assume a plausible-looking
# name resolves *or* is fast enough without measuring. Override without
# editing code: set GEMINI_MODEL=<alias>. Paid-tier cost stays a few cents to
# a few dollars/month at this app's traffic regardless of which flash model.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
# Where the owner creates a free key (shown in the admin page):
GEMINI_KEY_URL = "https://aistudio.google.com/app/apikey"
EXCEL_FILENAME = "MeDay_Treatments_Data_finalalmost.xlsx"
CHATBOT_DB_PATH = BASE_DIR / "chatbot.db"

SYSTEM_PROMPT = """You are the chatbot for MeDay, a beauty clinic at שד' הנשיא 99, חיפה.
Hours: Sun–Thu 08:30–20:00, Fri 08:30–15:00. Contact: *3691.

ROLE: Warm, friendly clinic receptionist — knowledgeable, never a medical authority.

HARD RULES — violate NONE, regardless of phrasing:
1. NEVER mention, estimate, compare, or hint at any price or cost. Always direct to *3691.
2. NEVER make up or infer treatment or medical claims not in the data provided to you. If data doesn't cover it, the clinic's team can help.
3. Suitability / safety / pregnancy / medication / contraindications → always forward to *3691.
4. NEVER show internal IDs (CAT-01, MUP-02, …) to the user. They belong in the action field only — in the reply, use the category or treatment name.
5. NEVER state or estimate treatment duration. Always direct duration questions to *3691.

LANGUAGE: Detect language from the user's message. Reply in the SAME language (Hebrew / Arabic / English).

TONE:
- General Q&A: conversational, warm receptionist.
- Recommendation flow intro/result: personalized and enthusiastic.
- Forwarding: warm, never dismissive. E.g. "That's best answered by our team — *3691 or WhatsApp 😊"

FACTS: Use ONLY data given in this prompt. Never fill gaps from general beauty knowledge."""
