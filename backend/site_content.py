"""
Admin-editable content for the public category pages.

Each category page on the site renders with one of two templates:

  "sections" - teal group bars, each holding treatment blocks (title, summary,
               a few detail lines and a "book" button). What the Body
               Treatments page looks like.
  "promo"    - one centred text block: heading, optional subheading and a
               series of paragraphs. What the Aesthetics page looks like.

Only categories the admin has actually edited get a row here. Anything without
a row keeps rendering from src/data/serviceCatalog.js, which stays the source
of the defaults - the admin screen seeds its editor from that same catalog, so
there is exactly one copy of the original Hebrew copy and it lives in the
frontend.

Wired into main.py via build_router(), which passes the admin dependency and
the audit logger so this module never imports main (circular).
"""
import json
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

DB_PATH = Path(__file__).parent / "appointments.db"

TEMPLATE_SECTIONS = "sections"
TEMPLATE_PROMO = "promo"
TEMPLATES = (TEMPLATE_SECTIONS, TEMPLATE_PROMO)

TEMPLATE_LABELS = {
    TEMPLATE_SECTIONS: "קבוצות וטיפולים",
    TEMPLATE_PROMO: "עמוד טקסט",
}

MAX_SECTIONS = 30
MAX_TREATMENTS_PER_SECTION = 60
MAX_PARAGRAPHS = 40
MAX_DETAIL_LINES = 20
MAX_TEXT_CHARS = 4000
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_site_content_db() -> None:
    conn = _connect()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS site_category_content (
            category_slug TEXT PRIMARY KEY,
            template      TEXT NOT NULL,
            content       TEXT NOT NULL,
            updated_at    TEXT DEFAULT '',
            updated_by    TEXT DEFAULT ''
        )
        """
    )
    conn.commit()
    conn.close()


# -- normalisation ------------------------------------------------------------
# Everything the admin screen sends is rebuilt field by field here, so a stray
# key in the payload can never reach the public endpoint.

def _text(value, limit: int = MAX_TEXT_CHARS) -> str:
    if value is None:
        return ""
    return str(value).strip()[:limit]


def _lines(value, limit: int) -> List[str]:
    if not isinstance(value, list):
        return []
    out = []
    for item in value[:limit]:
        line = _text(item)
        if line:
            out.append(line)
    return out


def _slug(value, taken: set, prefix: str) -> str:
    """Keep a slug the catalog already uses; mint a stable one otherwise.

    Slugs end up in DOM ids (`#treatment-<slug>`) that the chatbot deep-links
    to, so they have to be ASCII and must not change on a later save - which is
    why a new item keeps the random slug it was given the first time.
    """
    candidate = _text(value, 64).lower()
    if not SLUG_RE.match(candidate or ""):
        candidate = f"{prefix}-{secrets.token_hex(3)}"
    while candidate in taken:
        candidate = f"{prefix}-{secrets.token_hex(3)}"
    taken.add(candidate)
    return candidate


def _normalize_sections(raw) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    sections = []
    section_slugs: set = set()
    treatment_slugs: set = set()
    for entry in raw[:MAX_SECTIONS]:
        if not isinstance(entry, dict):
            continue
        title = _text(entry.get("title"), 200)
        treatments = []
        for item in (entry.get("treatments") or [])[:MAX_TREATMENTS_PER_SECTION]:
            if not isinstance(item, dict):
                continue
            name = _text(item.get("name"), 200)
            if not name:
                continue
            summary = _text(item.get("summary"))
            details = _lines(item.get("details"), MAX_DETAIL_LINES)
            treatments.append(
                {
                    "slug": _slug(item.get("slug"), treatment_slugs, "trt"),
                    "name": name,
                    "summary": summary,
                    # The page reads `details` for the expandable body and falls
                    # back to `summary`; keeping both means the section template
                    # renders identically whether the content came from here or
                    # from the static catalog.
                    "details": details or ([summary] if summary else []),
                }
            )
        if not title and not treatments:
            continue
        sections.append(
            {
                "slug": _slug(entry.get("slug"), section_slugs, "sec"),
                "title": title,
                "subtitle": _text(entry.get("subtitle"), 300),
                "treatments": treatments,
            }
        )
    return sections


def _normalize_promo(raw) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raw = {}
    return {
        "heading": _text(raw.get("heading")),
        "subheading": _text(raw.get("subheading")),
        "paragraphs": _lines(raw.get("paragraphs"), MAX_PARAGRAPHS),
    }


def _normalize(body: Dict[str, Any]) -> Dict[str, Any]:
    template = _text(body.get("template"), 32)
    if template not in TEMPLATES:
        raise HTTPException(status_code=400, detail="תבנית לא מוכרת.")

    content: Dict[str, Any] = {
        "template": template,
        "name": _text(body.get("name"), 200),
        "description": _text(body.get("description")),
        # Both templates are always stored, so switching back and forth in the
        # editor never throws away the copy for the other one.
        "sections": _normalize_sections(body.get("sections")),
        "promo": _normalize_promo(body.get("promo")),
    }

    if template == TEMPLATE_SECTIONS and not content["sections"]:
        raise HTTPException(
            status_code=400,
            detail="צריך לפחות קבוצה אחת עם טיפול אחד כדי לשמור בתבנית הזאת.",
        )
    if template == TEMPLATE_PROMO and not content["promo"]["heading"] and not content["promo"]["paragraphs"]:
        raise HTTPException(
            status_code=400,
            detail="צריך כותרת או פסקה אחת לפחות כדי לשמור בתבנית הזאת.",
        )
    return content


def _row_to_content(row: sqlite3.Row) -> Dict[str, Any]:
    try:
        content = json.loads(row["content"])
    except (TypeError, ValueError):
        return {}
    if not isinstance(content, dict):
        return {}
    content["template"] = row["template"]
    content["categorySlug"] = row["category_slug"]
    content["updatedAt"] = row["updated_at"]
    content["updatedBy"] = row["updated_by"]
    return content


def _load_all() -> Dict[str, Dict[str, Any]]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM site_category_content").fetchall()
    finally:
        conn.close()
    out = {}
    for row in rows:
        content = _row_to_content(row)
        if content:
            out[row["category_slug"]] = content
    return out


def _load_one(category_slug: str) -> Optional[Dict[str, Any]]:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM site_category_content WHERE category_slug = ?",
            (category_slug,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_content(row) if row else None


def _summarize(content: Dict[str, Any]) -> Dict[str, Any]:
    sections = content.get("sections") or []
    return {
        "categorySlug": content.get("categorySlug"),
        "template": content.get("template"),
        "templateLabel": TEMPLATE_LABELS.get(content.get("template"), ""),
        "sectionCount": len(sections),
        "treatmentCount": sum(len(section.get("treatments") or []) for section in sections),
        "paragraphCount": len((content.get("promo") or {}).get("paragraphs") or []),
        "updatedAt": content.get("updatedAt"),
        "updatedBy": content.get("updatedBy"),
    }


def build_router(require_admin, log_audit) -> APIRouter:
    init_site_content_db()

    router = APIRouter(tags=["site-content"])

    def _actor_name(actor: dict) -> str:
        return str((actor or {}).get("username") or (actor or {}).get("email") or "")

    # -- public: what the category pages read ---------------------------------
    @router.get("/site-content/categories")
    def public_all():
        return {"categories": _load_all()}

    @router.get("/site-content/categories/{category_slug}")
    def public_one(category_slug: str):
        # A category with no override is the normal case, not an error — the
        # page asks about every category it renders, and a 404 per visit would
        # fill the browser console with red for pages that are working fine.
        return {"content": _load_one(category_slug)}

    # -- admin ----------------------------------------------------------------
    @router.get("/admin/site-content/categories")
    def admin_list(_: dict = Depends(require_admin)):
        return {
            "templates": [{"value": key, "label": TEMPLATE_LABELS[key]} for key in TEMPLATES],
            "customized": {slug: _summarize(content) for slug, content in _load_all().items()},
        }

    @router.get("/admin/site-content/categories/{category_slug}")
    def admin_get(category_slug: str, _: dict = Depends(require_admin)):
        return {"content": _load_one(category_slug)}

    @router.put("/admin/site-content/categories/{category_slug}")
    def admin_save(category_slug: str, body: Dict[str, Any], actor: dict = Depends(require_admin)):
        slug = _text(category_slug, 64).lower()
        if not SLUG_RE.match(slug or ""):
            raise HTTPException(status_code=400, detail="Invalid category slug")

        content = _normalize(body or {})
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        actor_name = _actor_name(actor)

        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO site_category_content (category_slug, template, content, updated_at, updated_by)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(category_slug) DO UPDATE SET
                    template   = excluded.template,
                    content    = excluded.content,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
                """,
                (slug, content["template"], json.dumps(content, ensure_ascii=False), now, actor_name),
            )
            conn.commit()
        finally:
            conn.close()

        log_audit(
            "site_content_save",
            actor=actor,
            target_type="category_content",
            target_username=slug,
            details=f"template={content['template']} sections={len(content['sections'])}",
        )
        saved = _load_one(slug) or content
        return {"content": saved, "summary": _summarize(saved)}

    @router.delete("/admin/site-content/categories/{category_slug}")
    def admin_reset(category_slug: str, actor: dict = Depends(require_admin)):
        conn = _connect()
        try:
            cursor = conn.execute(
                "DELETE FROM site_category_content WHERE category_slug = ?",
                (category_slug,),
            )
            conn.commit()
            removed = cursor.rowcount
        finally:
            conn.close()
        if not removed:
            raise HTTPException(status_code=404, detail="No custom content for this category")
        log_audit(
            "site_content_reset",
            actor=actor,
            target_type="category_content",
            target_username=category_slug,
        )
        return {"ok": True}

    return router
