// "הגדרות AI" — the admin screen for everything the chatbot knows.
//
// Each section maps to one table the bot reads at answer time, so a save here
// changes the bot's next reply. The field list, labels and help text all come
// from the server (GET /admin/ai/<section>), so adding a field is a backend-only
// change and this screen picks it up.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  applyImport,
  createItem,
  deleteItem,
  getAiOverview,
  getQuizOverview,
  getSection,
  getExportUrl,
  previewImport,
  updateItem,
} from "../api/aiContentApi";

const SECTION_ORDER = ["treatments", "faq", "forward_topics", "categories"];

const INPUT_CLASS =
  "w-full rounded-xl border border-[#E8C4A0]/60 bg-[#FAF6F1] px-3 py-2 text-right text-sm text-gray-800 outline-none transition focus:border-[#C4795A] focus:ring-2 focus:ring-[#C4795A]/15";

/** Comma-separated text stored in one column, shown as chips so she can see
 *  exactly how the bot will read it. */
function ListField({ value, onChange, placeholder }) {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    <div>
      <input
        type="text"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || "הפרידי בפסיקים"}
        className={INPUT_CLASS}
      />
      {parts.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {parts.map((part, index) => (
            <span
              key={`${part}-${index}`}
              className="rounded-lg bg-[#C4795A]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8B5030]"
            >
              {part}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ field, value, onChange, categoryOptions, subgroupOptions }) {
  const common = { className: INPUT_CLASS, dir: "rtl" };

  let control;
  if (field.type === "select") {
    control = (
      <select {...common} value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">— בחרי —</option>
        {categoryOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "textarea") {
    control = (
      <textarea
        {...common}
        rows={3}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT_CLASS} resize-y`}
      />
    );
  } else if (field.type === "bool") {
    control = (
      <label className="flex cursor-pointer items-center justify-end gap-2 py-2">
        <span className="text-sm text-gray-700">{value ? "פעיל" : "כבוי"}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-[#C4795A]"
        />
      </label>
    );
  } else if (field.type === "list") {
    control = <ListField value={value} onChange={onChange} />;
  } else if (field.type === "combo") {
    const listId = `suggest-${field.key}`;
    control = (
      <>
        <input
          {...common}
          type="text"
          list={listId}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
        <datalist id={listId}>
          {(subgroupOptions || []).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </>
    );
  } else {
    control = (
      <input {...common} type="text" value={value || ""} onChange={(event) => onChange(event.target.value)} />
    );
  }

  return (
    <div className={field.type === "textarea" || field.type === "list" ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-bold text-gray-700">
        {field.label}
        {field.required && <span className="mr-1 text-red-500">*</span>}
      </label>
      {control}
      {field.help && <p className="mt-1 text-[11px] leading-4 text-gray-400">{field.help}</p>}
    </div>
  );
}

function ItemForm({ meta, initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(() => {
    const base = {};
    meta.fields.forEach((field) => {
      base[field.key] = initial ? initial[field.key] ?? "" : field.type === "bool" ? false : "";
    });
    return base;
  });

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const missingRequired = meta.fields.some(
    (field) => field.required && !String(form[field.key] ?? "").trim()
  );

  const subgroupOptions = useMemo(() => {
    if (!meta.subgroups) return [];
    return meta.subgroups[form.category_id] || [];
  }, [meta.subgroups, form.category_id]);

  return (
    <div className="rounded-2xl border-2 border-[#C4795A]/30 bg-white p-4 shadow-sm" dir="rtl">
      <div className="grid gap-3 sm:grid-cols-2">
        {meta.fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={(value) => set(field.key, value)}
            categoryOptions={meta.category_options || []}
            subgroupOptions={subgroupOptions}
          />
        ))}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 flex justify-start gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
        >
          ביטול
        </button>
        <button
          type="button"
          disabled={saving || missingRequired}
          onClick={() => onSave(form)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-2 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/20 transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "שומר..." : "שמירה"}
        </button>
      </div>
    </div>
  );
}

function ItemRow({ item, meta, onEdit, onDelete, deleting, confirming, onConfirm, onCancelConfirm }) {
  const subtitleParts = [];
  if (item.category_name && meta.key !== "categories") subtitleParts.push(item.category_name);
  if (item.subgroup) subtitleParts.push(item.subgroup);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/70">
      <div className="flex shrink-0 items-center gap-1.5">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? "מוחק..." : "אישור מחיקה"}
            </button>
            <button
              type="button"
              onClick={onCancelConfirm}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500"
            >
              ביטול
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-[#C4795A]/25 bg-white px-3 py-1 text-xs font-bold text-[#8B5030] transition hover:bg-[#F5EDE3]"
            >
              <Pencil size={12} />
              עריכה
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-3 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50"
            >
              <Trash2 size={12} />
              מחיקה
            </button>
          </>
        )}
      </div>

      <div className="min-w-0 flex-1 text-right">
        <div className="flex items-center justify-end gap-2">
          <p className="truncate text-sm font-bold text-gray-900">{item.display_name || "(ללא שם)"}</p>
          {/* The symbol this row carries in the Excel file, so the two views can
              be matched up by eye. */}
          <span
            className="shrink-0 rounded-md bg-[#F0E4DA] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8B5030]"
            title="המזהה של השורה הזו בקובץ האקסל"
          >
            {item.id}
          </span>
        </div>
        {subtitleParts.length > 0 && (
          <p className="truncate text-xs text-gray-400">{subtitleParts.join(" · ")}</p>
        )}
        {meta.key === "categories" && (
          <p className="text-xs text-gray-400">{item.treatment_count} טיפולים בקטגוריה</p>
        )}
      </div>
    </div>
  );
}

/** Treatments are shown category by category — every category holds many of
 *  them, and a flat list of 135 rows is unreadable. */
function CategoryGroup({ title, count, children, defaultOpen }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8C4A0]/60 bg-[#FAF6F1]">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-[#F5EDE3]"
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#C4795A] transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-gray-400">{count} טיפולים</span>
          <span className="text-sm font-extrabold text-[#8B5030]">{title}</span>
        </span>
      </button>
      {open && <div className="divide-y divide-[#E8C4A0]/25 border-t border-[#E8C4A0]/40">{children}</div>}
    </div>
  );
}

function ImportDialog({ section, meta, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const runPreview = async (selected) => {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(await previewImport(section, selected));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const applied = await applyImport(section, preview.token);
      setResult(applied);
      onDone();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const KIND_STYLE = {
    new: { label: "חדש", cls: "bg-green-50 text-green-700 border-green-200" },
    updated: { label: "עודכן", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    removed: { label: "יימחק", cls: "bg-red-50 text-red-700 border-red-200" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E8C4A0]/50 bg-[#FAF6F1] px-5 py-4">
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-700">
            <X size={18} />
          </button>
          <h3 className="text-base font-black text-gray-900">עדכון {meta.label} מקובץ אקסל</h3>
        </div>

        <div className="max-h-[calc(85vh-8rem)] overflow-y-auto px-5 py-4">
          {result ? (
            <div className="space-y-3 py-6 text-center">
              <CheckCircle2 size={40} className="mx-auto text-green-500" />
              <p className="text-lg font-black text-gray-900">השינויים נשמרו</p>
              <p className="text-sm text-gray-500">
                נוספו {result.created}, עודכנו {result.updated}, נמחקו {result.removed}.
              </p>
              <p className="text-xs text-gray-400">הצ׳אטבוט כבר משתמש במידע המעודכן.</p>
              <p className="text-[11px] text-gray-300">גיבוי נשמר בשם {result.backup}</p>
            </div>
          ) : (
            <>
              {!preview && (
                <div className="space-y-4">
                  <ol className="space-y-1.5 rounded-2xl bg-[#FAF6F1] p-4 text-sm leading-6 text-gray-600">
                    <li>1. הורידי את הקובץ, ערכי אותו ושמרי.</li>
                    <li>2. העלי אותו כאן.</li>
                    <li>3. יוצג לך בדיוק מה ישתנה — ורק אחרי אישור זה יישמר.</li>
                  </ol>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#C4795A]/40 bg-[#FAF6F1] px-4 py-8 text-center transition hover:bg-[#F5EDE3]">
                    {busy ? (
                      <Loader2 size={26} className="animate-spin text-[#C4795A]" />
                    ) : (
                      <Upload size={26} className="text-[#C4795A]" />
                    )}
                    <span className="text-sm font-bold text-[#8B5030]">
                      {busy ? "בודק את הקובץ..." : file ? file.name : "בחרי קובץ אקסל"}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => {
                        const selected = event.target.files?.[0];
                        if (selected) {
                          setFile(selected);
                          runPreview(selected);
                        }
                      }}
                    />
                  </label>
                </div>
              )}

              {preview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      ["חדשים", preview.summary.new, "text-green-600"],
                      ["עודכנו", preview.summary.updated, "text-amber-600"],
                      ["יימחקו", preview.summary.removed, "text-red-500"],
                      ["ללא שינוי", preview.summary.unchanged, "text-gray-400"],
                    ].map(([label, value, tone]) => (
                      <div key={label} className="rounded-2xl border border-[#E8C4A0]/50 bg-[#FAF6F1] py-3">
                        <p className={`text-2xl font-black tabular-nums ${tone}`}>{value}</p>
                        <p className="text-[11px] font-bold text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>

                  {preview.warnings?.map((warning) => (
                    <div
                      key={warning}
                      className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}

                  {preview.errors?.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-red-700">
                        <AlertCircle size={14} />
                        יש לתקן {preview.errors.length} בעיות בקובץ לפני שאפשר לשמור
                      </p>
                      <ul className="space-y-1 text-xs leading-5 text-red-600">
                        {preview.errors.slice(0, 20).map((issue, index) => (
                          <li key={index}>
                            {issue.row ? `שורה ${issue.row}: ` : ""}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {preview.changes?.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-[#E8C4A0]/50">
                      {preview.changes.map((change, index) => {
                        const style = KIND_STYLE[change.kind];
                        return (
                          <div key={index} className="border-b border-[#E8C4A0]/25 px-3 py-2 last:border-b-0">
                            <div className="flex items-center justify-end gap-2">
                              <p className="text-sm font-bold text-gray-800">{change.name}</p>
                              {change.category && (
                                <span className="text-[11px] text-gray-400">{change.category}</span>
                              )}
                              {change.id && (
                                <span className="rounded bg-[#F0E4DA] px-1.5 py-0.5 font-mono text-[10px] text-[#8B5030]">
                                  {change.id}
                                </span>
                              )}
                              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${style.cls}`}>
                                {style.label}
                              </span>
                            </div>
                            {change.fields?.map((entry, entryIndex) => (
                              <p key={entryIndex} className="mt-1 text-[11px] leading-5 text-gray-500">
                                <span className="font-bold text-gray-600">{entry.label}: </span>
                                <span className="text-red-400 line-through">{entry.before || "(ריק)"}</span>
                                {" ← "}
                                <span className="text-green-600">{entry.after || "(ריק)"}</span>
                              </p>
                            ))}
                          </div>
                        );
                      })}
                      {preview.changes_truncated && (
                        <p className="bg-[#FAF6F1] px-3 py-2 text-[11px] text-gray-400">
                          מוצגים 200 השינויים הראשונים בלבד.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-start gap-2 border-t border-[#E8C4A0]/50 bg-[#FAF6F1] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-bold text-gray-600"
          >
            {result ? "סגירה" : "ביטול"}
          </button>
          {preview && !result && (
            <button
              type="button"
              onClick={confirm}
              disabled={busy || preview.blocked || !preview.token}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-2 text-sm font-bold text-white shadow-lg disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              אישור ושמירה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizCard() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getQuizOverview()
      .then((response) => setData(response.categories))
      .catch(() => setData([]));
  }, []);

  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#E8C4A0]/60 bg-white p-4" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-2 text-right"
      >
        <ChevronDown size={16} className={`text-[#C4795A] transition-transform ${open ? "" : "-rotate-90"}`} />
        <div>
          <p className="text-sm font-extrabold text-gray-900">שאלון ההתאמה</p>
          <p className="text-xs text-gray-400">
            פעיל ב-{data.length} קטגוריות · לצפייה בלבד
          </p>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-[#E8C4A0]/40 pt-3">
          <p className="rounded-xl bg-[#FAF6F1] px-3 py-2 text-[11px] leading-5 text-gray-500">
            השאלון בנוי על ניקוד — כל תשובה מוסיפה נקודות לטיפולים מסוימים. עריכה שלו
            נעשית דרך קובץ הנתונים המקורי, כדי לא לשבור את חישוב ההמלצה.
          </p>
          {data.map((category) => (
            <div key={category.category_id}>
              <p className="text-xs font-bold text-[#8B5030]">
                {category.category_name}
                <span className="mr-2 font-normal text-gray-400">
                  {category.questions.length} שאלות · {category.score_rows} שורות ניקוד
                </span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {category.questions.map((question) => (
                  <li key={question.question_id} className="text-[11px] leading-5 text-gray-500">
                    • {question.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AiKnowledgePanel() {
  const [overview, setOverview] = useState(null);
  const [section, setSection] = useState("treatments");
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [importing, setImporting] = useState(false);
  const topRef = useRef(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getAiOverview());
    } catch (caught) {
      setBanner({ ok: false, text: caught.message });
    }
  }, []);

  const loadSection = useCallback(async (key) => {
    setLoading(true);
    try {
      const data = await getSection(key);
      setMeta({ ...data, key });
    } catch (caught) {
      setBanner({ ok: false, text: caught.message });
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setAdding(false);
    setEditingId(null);
    setSearch("");
    setFormError("");
    loadSection(section);
  }, [section, loadSection]);

  const refresh = useCallback(async () => {
    await Promise.all([loadOverview(), loadSection(section)]);
  }, [loadOverview, loadSection, section]);

  const flash = (ok, text) => {
    setBanner({ ok, text });
    window.setTimeout(() => setBanner(null), 6000);
  };

  const handleCreate = async (form) => {
    setSaving(true);
    setFormError("");
    try {
      const response = await createItem(section, form);
      setAdding(false);
      await refresh();
      flash(true, response.warnings?.length ? response.warnings[0] : "נשמר. הצ׳אטבוט כבר יודע את זה.");
    } catch (caught) {
      setFormError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, form) => {
    setSaving(true);
    setFormError("");
    try {
      const response = await updateItem(section, id, form);
      setEditingId(null);
      await refresh();
      flash(true, response.warnings?.length ? response.warnings[0] : "העדכון נשמר.");
    } catch (caught) {
      setFormError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteItem(section, id);
      setConfirmingId(null);
      await refresh();
      flash(true, "נמחק.");
    } catch (caught) {
      flash(false, caught.message);
      setConfirmingId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const items = meta?.items || [];
    const term = search.trim();
    if (!term) return items;
    return items.filter((item) =>
      [item.display_name, item.category_name, item.subgroup, item.id]
        .filter(Boolean)
        .some((value) => String(value).includes(term))
    );
  }, [meta, search]);

  const grouped = useMemo(() => {
    if (section !== "treatments") return null;
    const map = new Map();
    filtered.forEach((item) => {
      const key = item.category_name || "ללא קטגוריה";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map.entries()];
  }, [filtered, section]);

  const renderRow = (item) => (
    <div key={item.id}>
      {editingId === item.id ? (
        <div className="bg-white p-3">
          <ItemForm
            meta={meta}
            initial={item}
            saving={saving}
            error={formError}
            onSave={(form) => handleUpdate(item.id, form)}
            onCancel={() => {
              setEditingId(null);
              setFormError("");
            }}
          />
        </div>
      ) : (
        <ItemRow
          item={item}
          meta={meta}
          deleting={deletingId === item.id}
          confirming={confirmingId === item.id}
          onEdit={() => {
            setEditingId(item.id);
            setAdding(false);
            setFormError("");
          }}
          onDelete={() => setConfirmingId(item.id)}
          onConfirm={() => handleDelete(item.id)}
          onCancelConfirm={() => setConfirmingId(null)}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl" ref={topRef}>
      <div className="rounded-3xl border border-[#E8C4A0]/60 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#C4795A]/10 text-[#C4795A]">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 text-right">
            <h2 className="text-lg font-black text-gray-900">המידע של הצ׳אטבוט</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              כל מה שכתוב כאן — הצ׳אטבוט יודע. מה שלא כתוב כאן, הוא לא ימציא אלא יפנה לטלפון.
              כל שינוי נכנס לתוקף מיד, בלי צורך להפעיל שום דבר מחדש.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SECTION_ORDER.map((key) => {
            const info = overview?.sections?.find((entry) => entry.key === key);
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-gradient-to-l from-[#C4795A] to-[#9B5C38] text-white shadow-lg shadow-[#C4795A]/20"
                    : "border border-[#E8C4A0]/60 bg-[#FAF6F1] text-[#8B5030] hover:bg-[#F5EDE3]"
                }`}
              >
                {info?.label || key}
                {info && (
                  <span className={`mr-2 text-xs ${active ? "text-white/70" : "text-gray-400"}`}>
                    {info.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
            banner.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {banner.ok ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {meta && (
        <>
          <div className="rounded-2xl border border-[#E8C4A0]/60 bg-white p-4">
            <p className="mb-3 text-xs leading-5 text-gray-500">
              <Info size={12} className="ml-1 inline text-[#C4795A]" />
              {meta.description}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[#E8C4A0]/50 bg-[#FAF6F1] px-3 py-2">
                <Search size={15} className="shrink-0 text-[#C4795A]" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="חיפוש לפי שם, קטגוריה או מזהה..."
                  className="w-full bg-transparent text-right text-sm text-gray-700 outline-none placeholder:text-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setEditingId(null);
                  setFormError("");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/20"
              >
                <Plus size={15} />
                הוספה
              </button>
              <a
                href={getExportUrl(section)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
              >
                <Download size={15} />
                הורדה לאקסל
              </a>
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#C4795A]/30 bg-white px-4 py-2 text-sm font-bold text-[#C4795A] transition hover:bg-[#FDF3ED]"
              >
                <FileSpreadsheet size={15} />
                עדכון מאקסל
              </button>
            </div>
          </div>

          {adding && (
            <ItemForm
              meta={meta}
              initial={null}
              saving={saving}
              error={formError}
              onSave={handleCreate}
              onCancel={() => {
                setAdding(false);
                setFormError("");
              }}
            />
          )}

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-14 animate-pulse rounded-2xl bg-white/70" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E8C4A0] bg-white/60 px-4 py-10 text-center">
              <Sparkles size={26} className="mx-auto mb-2 text-[#E8C4A0]" />
              <p className="text-sm font-bold text-gray-500">
                {search ? "לא נמצאו תוצאות לחיפוש" : "אין עדיין רשומות כאן"}
              </p>
            </div>
          ) : grouped ? (
            <div className="space-y-3">
              {grouped.map(([categoryName, categoryItems]) => (
                <CategoryGroup
                  key={categoryName}
                  title={categoryName}
                  count={categoryItems.length}
                  defaultOpen={Boolean(search) || grouped.length === 1}
                >
                  {categoryItems.map(renderRow)}
                </CategoryGroup>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-[#E8C4A0]/25 overflow-hidden rounded-2xl border border-[#E8C4A0]/60 bg-[#FAF6F1]">
              {filtered.map(renderRow)}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition hover:text-[#C4795A]"
            >
              <RefreshCw size={12} />
              רענון
            </button>
          </div>
        </>
      )}

      <QuizCard />

      {importing && meta && (
        <ImportDialog
          section={section}
          meta={meta}
          onClose={() => setImporting(false)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
