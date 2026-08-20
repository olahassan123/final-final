// "ניהול תוכן" — the admin screen that owns what each category page shows.
//
// Every category can render with one of two templates (see categoryContent.js):
// groups-and-treatments, or a single block of text. The admin picks one, edits
// the copy, and the public page at /categories/<slug> reads it on the next load.
//
// The editor seeds itself from serviceCatalog.js whenever a category has no
// saved override, so the starting point is always the page as it looks today —
// never a blank form.
//
// Layout note: a category can hold dozens of treatments, so groups and
// treatments are collapsed to one line each and open one at a time. The screen
// stays an overview of the page's structure instead of a wall of form fields.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { serviceCatalog } from "../data/serviceCatalog";
import {
  TEMPLATE_OPTIONS,
  TEMPLATE_PROMO,
  TEMPLATE_SECTIONS,
  applyCategoryContent,
  defaultContentFor,
  newSection,
  newTreatment,
} from "../data/categoryContent";
import {
  getCategoryContent,
  getContentOverview,
  resetCategoryContent,
  saveCategoryContent,
} from "../api/siteContentApi";

const FIELD =
  "w-full rounded-xl border border-[#E8D7C8] bg-white px-3 py-2.5 text-right text-sm text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-[#C4795A] focus:ring-4 focus:ring-[#C4795A]/10";

const LABEL = "mb-1.5 block text-[11px] font-black tracking-wide text-gray-400";

const TEMPLATE_ICONS = { [TEMPLATE_SECTIONS]: LayoutList, [TEMPLATE_PROMO]: FileText };

/** The server stores UTC ISO strings; show them in local time. */
function formatStamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/* ── little helpers for editing nested arrays ─────────────────── */
function replaceAt(list, index, value) {
  return list.map((item, i) => (i === index ? value : item));
}

function removeAt(list, index) {
  return list.filter((_, i) => i !== index);
}

function moveAt(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/* ── shared bits ──────────────────────────────────────────────── */
function IconButton({ title, onClick, disabled, tone = "quiet", children }) {
  const tones = {
    quiet: "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
    onTeal: "text-white/70 hover:bg-white/20 hover:text-white",
    danger: "text-gray-400 hover:bg-red-50 hover:text-red-600",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition disabled:pointer-events-none disabled:opacity-25 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick, children, subtle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        subtle
          ? "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-black text-[#C4795A] transition hover:bg-[#C4795A]/10"
          : "inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E8D7C8] py-3 text-sm font-black text-[#8B5E3C] transition hover:border-[#C4795A] hover:bg-[#C4795A]/5 hover:text-[#C4795A]"
      }
    >
      <Plus size={subtle ? 13 : 15} />
      {children}
    </button>
  );
}

/** Miniature of what each template looks like on the site, so the choice is
 *  made by looking rather than by reading. */
function TemplateThumb({ template }) {
  if (template === TEMPLATE_SECTIONS) {
    return (
      <div className="space-y-1 rounded-md bg-[#FBE9DC] p-1.5">
        <div className="h-2 rounded-sm bg-[#4A9BA8]" />
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-1 w-3/4 rounded-full bg-[#1A0E06]/45" />
              <div className="h-[3px] w-full rounded-full bg-[#5C4033]/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-md bg-[#FBF0E8] p-1.5">
      <div className="mx-auto h-2 w-4/5 rounded-sm bg-[#C4795A]" />
      <div className="mx-auto h-2 w-3/5 rounded-sm bg-[#C4795A]/60" />
      <div className="space-y-1 pt-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="mx-auto h-[3px] rounded-full bg-[#5C3A22]/20" style={{ width: `${86 - i * 14}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ── template 1: groups and treatments ────────────────────────── */

/** One treatment: a single line until it is opened for editing. */
function TreatmentRow({ treatment, index, count, open, onToggle, onChange, onMove, onRemove }) {
  const details = treatment.details || [];

  return (
    <div
      className={`overflow-hidden rounded-xl border transition ${
        open ? "border-[#C4795A]/50 bg-[#FDF9F5] shadow-sm" : "border-[#EFE4D8] bg-white hover:border-[#E8C4A0]"
      }`}
    >
      <div className="flex items-center gap-1 px-2 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-right">
          <ChevronDown
            size={15}
            className={`shrink-0 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm font-bold ${treatment.name ? "text-gray-800" : "text-gray-300"}`}>
              {treatment.name || "טיפול ללא שם"}
            </span>
            {!open && treatment.summary ? (
              <span className="block truncate text-xs text-gray-400">{treatment.summary}</span>
            ) : null}
          </span>
        </button>

        <IconButton title="העלה" onClick={onMove ? () => onMove(-1) : undefined} disabled={index === 0}>
          <ChevronUp size={14} />
        </IconButton>
        <IconButton title="הורד" onClick={onMove ? () => onMove(1) : undefined} disabled={index === count - 1}>
          <ChevronDown size={14} />
        </IconButton>
        <IconButton title="מחק טיפול" onClick={onRemove} tone="danger">
          <Trash2 size={14} />
        </IconButton>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-[#EFE4D8] px-4 py-4">
          <div>
            <label className={LABEL}>שם הטיפול</label>
            <input
              type="text"
              dir="rtl"
              autoFocus
              value={treatment.name || ""}
              onChange={(event) => onChange({ ...treatment, name: event.target.value })}
              className={FIELD}
              placeholder="למשל: עיסוי שוודי"
            />
          </div>

          <div>
            <label className={LABEL}>תיאור קצר</label>
            <textarea
              dir="rtl"
              rows={2}
              value={treatment.summary || ""}
              onChange={(event) => onChange({ ...treatment, summary: event.target.value })}
              className={FIELD}
              placeholder="המשפט שמופיע מתחת לשם הטיפול"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-black tracking-wide text-gray-400">
                שורות נוספות
                <span className="mr-1 font-medium text-gray-300">נפתחות בלחיצה על "לקרוא עוד"</span>
              </label>
              <AddButton subtle onClick={() => onChange({ ...treatment, details: [...details, ""] })}>
                שורה
              </AddButton>
            </div>

            {details.length ? (
              <div className="space-y-2">
                {details.map((line, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      type="text"
                      dir="rtl"
                      value={line}
                      onChange={(event) => onChange({ ...treatment, details: replaceAt(details, i, event.target.value) })}
                      className={FIELD}
                    />
                    <IconButton
                      title="מחק שורה"
                      onClick={() => onChange({ ...treatment, details: removeAt(details, i) })}
                      tone="danger"
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-white/60 py-2 text-center text-xs text-gray-300">אין שורות נוספות</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One group: collapsed to its title and treatment count until opened. */
function GroupCard({
  section,
  index,
  count,
  open,
  openTreatment,
  onToggle,
  onToggleTreatment,
  onChange,
  onMove,
  onRemove,
}) {
  const treatments = section.treatments || [];
  const setTreatments = (next) => onChange({ ...section, treatments: next });

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition ${open ? "border-[#4A9BA8]/40 shadow-md" : "border-[#E8D7C8] shadow-sm"}`}>
      <div className={`flex items-center gap-1 px-3 py-2.5 transition ${open ? "bg-[#4A9BA8]" : "bg-[#4A9BA8]/90"}`}>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-0.5 text-right">
          <ChevronDown size={16} className={`shrink-0 text-white/70 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-black ${section.title ? "text-white" : "text-white/50"}`}>
              {section.title || "קבוצה ללא כותרת"}
            </span>
            <span className="block truncate text-[11px] text-white/70">
              {section.subtitle || `${treatments.length} טיפולים`}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-black text-white">
            {treatments.length}
          </span>
        </button>

        <IconButton title="העלה" onClick={() => onMove(-1)} disabled={index === 0} tone="onTeal">
          <ChevronUp size={15} />
        </IconButton>
        <IconButton title="הורד" onClick={() => onMove(1)} disabled={index === count - 1} tone="onTeal">
          <ChevronDown size={15} />
        </IconButton>
        <IconButton title="מחק קבוצה" onClick={onRemove} tone="onTeal">
          <Trash2 size={15} />
        </IconButton>
      </div>

      {open ? (
        <div className="space-y-4 bg-[#FCFAF7] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>כותרת הקבוצה</label>
              <input
                type="text"
                dir="rtl"
                value={section.title || ""}
                onChange={(event) => onChange({ ...section, title: event.target.value })}
                className={FIELD}
                placeholder="למשל: עיסוי גוף"
              />
            </div>
            <div>
              <label className={LABEL}>כותרת משנה — אפשר להשאיר ריק</label>
              <input
                type="text"
                dir="rtl"
                value={section.subtitle || ""}
                onChange={(event) => onChange({ ...section, subtitle: event.target.value })}
                className={FIELD}
                placeholder="שורה קטנה מתחת לכותרת"
              />
            </div>
          </div>

          <div className="space-y-2">
            {treatments.map((treatment, i) => (
              <TreatmentRow
                key={treatment.slug || i}
                treatment={treatment}
                index={i}
                count={treatments.length}
                open={openTreatment === treatment.slug}
                onToggle={() => onToggleTreatment(treatment.slug)}
                onChange={(next) => setTreatments(replaceAt(treatments, i, next))}
                onMove={(delta) => setTreatments(moveAt(treatments, i, delta))}
                onRemove={() => setTreatments(removeAt(treatments, i))}
              />
            ))}
          </div>

          <AddButton
            onClick={() => {
              const treatment = newTreatment();
              setTreatments([...treatments, treatment]);
              onToggleTreatment(treatment.slug, true);
            }}
          >
            הוסיפי טיפול
          </AddButton>
        </div>
      ) : null}
    </div>
  );
}

/* ── template 2: one block of text ────────────────────────────── */
function PromoEditor({ promo, onChange }) {
  const paragraphs = promo.paragraphs || [];
  const setParagraphs = (next) => onChange({ ...promo, paragraphs: next });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E8D7C8] bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>כותרת ראשית</label>
            <textarea
              dir="rtl"
              rows={3}
              value={promo.heading || ""}
              onChange={(event) => onChange({ ...promo, heading: event.target.value })}
              className={FIELD}
              placeholder="הכותרת הגדולה בצבע קורל"
            />
          </div>
          <div>
            <label className={LABEL}>כותרת משנה — אפשר להשאיר ריק</label>
            <textarea
              dir="rtl"
              rows={3}
              value={promo.subheading || ""}
              onChange={(event) => onChange({ ...promo, subheading: event.target.value })}
              className={FIELD}
              placeholder="שורה נוספת מתחת לכותרת"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-gray-700">
            פסקאות
            <span className="mr-2 text-xs font-bold text-gray-400">{paragraphs.length}</span>
          </h3>
          <span className="text-[11px] text-gray-400">כל פסקה מופיעה עם מפריד ביניהן</span>
        </div>

        <div className="space-y-2.5">
          {paragraphs.map((paragraph, i) => (
            <div key={i} className="rounded-2xl border border-[#E8D7C8] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C4795A]/10 text-[11px] font-black text-[#8B5030]">
                  {i + 1}
                </span>
                <div className="flex-1" />
                <IconButton title="העלה" onClick={() => setParagraphs(moveAt(paragraphs, i, -1))} disabled={i === 0}>
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton
                  title="הורד"
                  onClick={() => setParagraphs(moveAt(paragraphs, i, 1))}
                  disabled={i === paragraphs.length - 1}
                >
                  <ChevronDown size={14} />
                </IconButton>
                <IconButton title="מחק פסקה" onClick={() => setParagraphs(removeAt(paragraphs, i))} tone="danger">
                  <Trash2 size={14} />
                </IconButton>
              </div>
              <textarea
                dir="rtl"
                rows={4}
                value={paragraph}
                onChange={(event) => setParagraphs(replaceAt(paragraphs, i, event.target.value))}
                className={FIELD}
              />
            </div>
          ))}
        </div>

        <div className="mt-3">
          <AddButton onClick={() => setParagraphs([...paragraphs, ""])}>הוסיפי פסקה</AddButton>
        </div>
      </div>
    </div>
  );
}

/* ── preview tab — the page's content in the site's own colours ── */
function PreviewPane({ template, preview }) {
  if (template === TEMPLATE_PROMO) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#E8D7C8] shadow-sm">
        <div className="bg-[#FBF0E8] px-6 py-10 text-center">
          <p className="text-[11px] font-black tracking-[0.3em] text-[#C4795A]">✦ MEDAY BEAUTY ✦</p>
          <h3 className="mx-auto mt-5 max-w-2xl text-2xl font-black leading-snug text-[#C4795A]">
            {preview.promoHeading || "— ללא כותרת —"}
            {preview.promoSubheading ? (
              <>
                <br />
                {preview.promoSubheading}
              </>
            ) : null}
          </h3>
          <div className="mx-auto mt-8 max-w-2xl space-y-5">
            {(preview.promoParagraphs || []).map((paragraph, i) => (
              <p key={i} className="text-sm leading-8 text-[#5C3A22]">
                {paragraph}
              </p>
            ))}
          </div>
          <span className="mt-8 inline-block rounded-full bg-[#4A9BA8] px-7 py-2.5 text-sm font-bold text-white">
            לתיאום תור
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(preview.sections || []).map((section, i) => (
        <div key={section.slug || i} className="overflow-hidden rounded-2xl border border-[#E8D7C8] shadow-sm">
          <div className="bg-[#4A9BA8] px-5 py-3 text-white">
            <p className="font-black">{section.title || "— ללא כותרת —"}</p>
            {section.subtitle ? <p className="text-xs text-white/75">{section.subtitle}</p> : null}
          </div>
          <div className="grid gap-x-10 gap-y-6 bg-[#FBE9DC] px-6 py-6 md:grid-cols-2">
            {(section.treatments || []).map((treatment, j) => (
              <div key={treatment.slug || j}>
                <p className="font-black text-[#1A0E06]">{treatment.name || "— ללא שם —"}</p>
                <p className="mt-1.5 text-xs leading-6 text-[#5C4033]">{treatment.summary}</p>
                <span className="mt-3 inline-block rounded-full border-2 border-[#4A9BA8] px-4 py-1 text-[11px] font-bold text-[#4A9BA8]">
                  לתיאום תור
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────── */
export default function AdminContentManagement() {
  const [selectedSlug, setSelectedSlug] = useState(serviceCatalog[0]?.slug || "");
  const [customized, setCustomized] = useState({});
  const [content, setContent] = useState(null);
  const [savedContent, setSavedContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("edit");
  const [openSection, setOpenSection] = useState(null);
  const [openTreatment, setOpenTreatment] = useState(null);

  const category = useMemo(
    () => serviceCatalog.find((item) => item.slug === selectedSlug) || null,
    [selectedSlug]
  );

  // `savedContent` is what the server holds (null when the category still uses
  // its built-in content), so "unsaved changes" is a plain comparison.
  const dirty = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(savedContent ?? defaultContentFor(category)),
    [content, savedContent, category]
  );

  const loadCategory = useCallback(async (slug) => {
    setLoading(true);
    setError("");
    setNotice("");
    const fallback = defaultContentFor(serviceCatalog.find((item) => item.slug === slug));
    try {
      const stored = await getCategoryContent(slug);
      setSavedContent(stored);
      // Seed from the live site content when nothing was ever saved, and merge
      // the fallback in otherwise so a template she has not touched yet still
      // opens with the real copy instead of empty fields.
      setContent(
        stored
          ? {
              ...fallback,
              ...stored,
              sections: stored.sections?.length ? stored.sections : fallback.sections,
              promo: stored.promo?.heading || stored.promo?.paragraphs?.length ? stored.promo : fallback.promo,
            }
          : fallback
      );
    } catch (err) {
      setError(err.message);
      setSavedContent(null);
      setContent(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getContentOverview()
      .then((data) => setCustomized(data.customized || {}))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectedSlug) loadCategory(selectedSlug);
  }, [selectedSlug, loadCategory]);

  function selectCategory(slug) {
    if (slug === selectedSlug) return;
    if (dirty && !window.confirm("יש שינויים שלא נשמרו. לעבור לקטגוריה אחרת ולוותר עליהם?")) return;
    setSelectedSlug(slug);
    setOpenSection(null);
    setOpenTreatment(null);
    setTab("edit");
  }

  function toggleTreatment(slug, forceOpen) {
    setOpenTreatment((prev) => (!forceOpen && prev === slug ? null : slug));
  }

  async function handleSave() {
    if (!content) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await saveCategoryContent(selectedSlug, content);
      setSavedContent(data.content);
      setContent(data.content);
      setCustomized((prev) => ({ ...prev, [selectedSlug]: data.summary }));
      setNotice("נשמר. העמוד באתר כבר מעודכן.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("להחזיר את הקטגוריה לתוכן המקורי של האתר?")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await resetCategoryContent(selectedSlug);
      setCustomized((prev) => {
        const next = { ...prev };
        delete next[selectedSlug];
        return next;
      });
      setSavedContent(null);
      setContent(defaultContentFor(category));
      setNotice("הקטגוריה חזרה לתוכן המקורי.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const template = content?.template || TEMPLATE_SECTIONS;
  const preview = applyCategoryContent(category, content);
  const sections = content?.sections || [];
  const treatmentCount = sections.reduce((total, section) => total + (section.treatments?.length || 0), 0);

  return (
    <div className="min-h-screen bg-[#F7F1EA]" dir="rtl">

      {/* ══ sticky top bar — title, tabs and saving all in one place ══ */}
      <header className="sticky top-0 z-30 border-b border-[#E8D7C8] bg-[#FBF7F2]/95 backdrop-blur">
        {/* The app floats the account/logout pills at fixed top-left on every
            internal page (App.jsx FloatingAuthButton). Keep the bar's controls
            out from under them: clear the corner on wide screens, and drop the
            whole bar below them once it starts wrapping. */}
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-5 pb-3 pt-16 lg:pl-[330px] lg:pt-3">
          <Link
            to="/admin"
            title="חזרה לדשבורד"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8D7C8] bg-white text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5"
          >
            <ArrowRight size={16} />
          </Link>

          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-wide text-[#C4795A]">ניהול תוכן</p>
            <h1 className="truncate text-lg font-black leading-tight text-gray-900">
              {category?.name || "עמודי הקטגוריות"}
            </h1>
          </div>

          {/* edit / preview */}
          <div className="flex rounded-xl border border-[#E8D7C8] bg-white p-0.5">
            {[
              { key: "edit", label: "עריכה", Icon: Pencil },
              { key: "preview", label: "תצוגה מקדימה", Icon: Eye },
            ].map((item) => {
              const TabIcon = item.Icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    tab === item.key ? "bg-[#8B5E3C] text-white shadow-sm" : "text-gray-500 hover:text-[#8B5E3C]"
                  }`}
                >
                  <TabIcon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          <span className="hidden text-[11px] font-bold text-gray-400 sm:block">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-[#C4795A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C4795A]" />
                שינויים שלא נשמרו
              </span>
            ) : savedContent ? (
              `עודכן ${formatStamp(savedContent.updatedAt)}`
            ) : (
              "התוכן המקורי של האתר"
            )}
          </span>

          <a
            href={`/categories/${selectedSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="פתיחת העמוד באתר"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E8D7C8] bg-white px-3 text-xs font-black text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5"
          >
            <Eye size={14} />
            העמוד באתר
          </a>

          {savedContent ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              title="החזרת התוכן המקורי"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8D7C8] bg-white text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5 disabled:opacity-40"
            >
              <RotateCcw size={15} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#8B5E3C] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#764C2F] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            שמירה
          </button>
        </div>

        {error || notice ? (
          <div className="mx-auto max-w-[1400px] px-5 pb-3">
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
                error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {error ? <AlertCircle size={15} /> : <Check size={15} />}
              {error || notice}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-6 lg:grid-cols-[240px_1fr]">

        {/* ══ category list ══ */}
        <aside className="h-fit lg:sticky lg:top-24">
          <p className="mb-2 px-2 text-[11px] font-black tracking-wide text-gray-400">קטגוריות</p>
          <div className="space-y-0.5">
            {serviceCatalog.map((item) => {
              const summary = customized[item.slug];
              const active = item.slug === selectedSlug;
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => selectCategory(item.slug)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-right transition ${
                    active
                      ? "bg-white font-black text-[#8B5E3C] shadow-sm ring-1 ring-[#E8D7C8]"
                      : "text-gray-600 hover:bg-white/70"
                  }`}
                >
                  <span
                    className={`h-6 w-1 shrink-0 rounded-full transition ${active ? "bg-[#C4795A]" : "bg-transparent"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                  {summary ? (
                    <span
                      title={`${summary.templateLabel} · נערך`}
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4A9BA8]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 px-3 text-[11px] text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4A9BA8]" />
            קטגוריה שנערכה
          </p>
        </aside>

        {/* ══ editor / preview ══ */}
        <main className="min-w-0">
          {loading || !content ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E8D7C8] bg-white py-20 text-sm font-bold text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              טוען…
            </div>
          ) : tab === "preview" ? (
            <PreviewPane template={template} preview={preview} />
          ) : (
            <div className="space-y-6">

              {/* template + page title, side by side */}
              <section className="rounded-2xl border border-[#E8D7C8] bg-white p-5 shadow-sm">
                <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
                  <div>
                    <h2 className="text-sm font-black text-gray-700">תבנית העמוד</h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                      שתי התבניות נשמרות בנפרד — אפשר להחליף בלי לאבד את הטקסט של השנייה.
                    </p>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {TEMPLATE_OPTIONS.map((option) => {
                        const active = template === option.value;
                        const Icon = TEMPLATE_ICONS[option.value];
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setContent({
                                ...content,
                                template: option.value,
                                // A category that only ever had text has no
                                // groups to show — open one empty group so the
                                // switch lands on a form rather than on nothing.
                                sections:
                                  option.value === TEMPLATE_SECTIONS && !content.sections?.length
                                    ? [newSection()]
                                    : content.sections,
                              })
                            }
                            className={`rounded-xl border-2 p-3 text-right transition ${
                              active
                                ? "border-[#C4795A] bg-[#C4795A]/5"
                                : "border-[#EFE4D8] hover:border-[#E8C4A0] hover:bg-[#FBF7F2]"
                            }`}
                          >
                            <div className="mb-2 flex items-center gap-1.5">
                              <Icon size={14} className={active ? "text-[#C4795A]" : "text-gray-400"} />
                              <span className="text-xs font-black text-gray-800">{option.label}</span>
                              <div className="flex-1" />
                              {active ? (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C4795A] text-white">
                                  <Check size={10} />
                                </span>
                              ) : null}
                            </div>
                            <TemplateThumb template={option.value} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:border-r lg:border-[#EFE4D8] lg:pr-6">
                    <label className={LABEL}>שם הקטגוריה</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={content.name || ""}
                      onChange={(event) => setContent({ ...content, name: event.target.value })}
                      className={FIELD}
                    />
                    <p className="mt-1.5 text-[11px] leading-5 text-gray-400">
                      הכותרת הגדולה בראש עמוד הקטגוריה.
                    </p>
                  </div>
                </div>
              </section>

              {/* the chosen template's editor */}
              {template === TEMPLATE_SECTIONS ? (
                <section>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-sm font-black text-gray-700">
                      קבוצות וטיפולים
                      <span className="mr-2 text-xs font-bold text-gray-400">
                        {sections.length} קבוצות · {treatmentCount} טיפולים
                      </span>
                    </h2>
                    <span className="text-[11px] text-gray-400">לחיצה על שורה פותחת אותה לעריכה</span>
                  </div>

                  <div className="space-y-2.5">
                    {sections.map((section, i) => (
                      <GroupCard
                        key={section.slug || i}
                        section={section}
                        index={i}
                        count={sections.length}
                        open={openSection === section.slug}
                        openTreatment={openTreatment}
                        onToggle={() => setOpenSection(openSection === section.slug ? null : section.slug)}
                        onToggleTreatment={toggleTreatment}
                        onChange={(next) => setContent({ ...content, sections: replaceAt(sections, i, next) })}
                        onMove={(delta) => setContent({ ...content, sections: moveAt(sections, i, delta) })}
                        onRemove={() => {
                          if (!window.confirm("למחוק את הקבוצה הזאת ואת הטיפולים שבה?")) return;
                          setContent({ ...content, sections: removeAt(sections, i) });
                        }}
                      />
                    ))}
                  </div>

                  <div className="mt-3">
                    <AddButton
                      onClick={() => {
                        const section = newSection();
                        setContent({ ...content, sections: [...sections, section] });
                        setOpenSection(section.slug);
                      }}
                    >
                      הוסיפי קבוצה
                    </AddButton>
                  </div>
                </section>
              ) : (
                <section>
                  <h2 className="mb-2 px-1 text-sm font-black text-gray-700">טקסט העמוד</h2>
                  <PromoEditor
                    promo={content.promo || { heading: "", subheading: "", paragraphs: [] }}
                    onChange={(next) => setContent({ ...content, promo: next })}
                  />
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
