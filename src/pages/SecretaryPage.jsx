import { useState, useEffect, useRef } from "react";
import { fetchTreatments, fetchAppointments, createAppointment, deleteAppointment, updateAppointment } from "../api/medayApi";
import {
  ChevronLeft, ChevronRight, Trash2, Plus, Sparkles, User, Phone, CalendarDays, Clock, X, LayoutGrid,
} from "lucide-react";

// ── Calendar helpers ──────────────────────────────────────────
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8..22
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTH_NAMES_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const MINI_DAY_HEADS = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"]; // Sun→Sat
const ROW_HEIGHT = 80; // px per hour row
const FIRST_HOUR = 8;
const BUSINESS_TIME_ZONE = "Asia/Jerusalem";
const MAX_ADVANCE_BOOKING_DAYS = 365;
const SECRETARY_CATEGORY_OPTIONS = [
  "מניקור ופדיקור",
  "עיצוב שיער",
  "טיפולי קוסמטיקה",
  "טיפולי גוף",
  "הסרת שיער",
  "איפור מקצועי",
  "איפור קבוע ועיצוב גבות",
  "סטיילינג אישי",
  "טיפולי אסתטיקה",
];

const SECRETARY_CATEGORY_PRESETS = {
  "מניקור ופדיקור": {
    subcategories: {
      "מניקור": [
        "מניקור",
        "לק ג’ל",
        "עיצוב ופיסול ציפורן",
      ],
      "פדיקור": [
        "פדיקור אסתטי + מריחת לק",
        "פדיקור אסתטי + לק ג'ל",
        "פדיקור טיפולי + לק/לק ג'ל",
      ],
    },
  },
  "טיפולי קוסמטיקה": {
    subcategories: {
      "טיפולי פנים קלאסיים": [
        "מידיי קלאסי",
        "מידיי קלאסי לגבר Man T",
      ],
      "טיפולי פנים מפנקים": [
        "מידיי FACE SCULPT עיסוי מעצב",
        "מידיי PARTY",
      ],
      "טיפולי פנים טכנולוגיים מיוחדים": [
        "מידיי MESO PRO",
        "מידיי LIFTING PRO",
        "מידיי COLLAGEN + קולגן פלוס",
        "אקנה סטופ STOP ACNE",
        "מידיי CLEAR SKIN + ניקוי העור פלוס",
        "פילינג סדרתי NEW SKIN",
        "הצערת העור SKIN BOOSTER",
      ],
    },
  },
  "טיפולי גוף": {
    subcategories: {
      "עיסוי גוף": [
        "עיסוי שוודי",
        "עיסוי באבנים חמות",
        "שיאצו",
        "עיסוי תאילנדי",
        "עיסוי רקמות עמוק",
        "עיסוי קצוות",
      ],
      "עיסוי ממוקד": [
        "עיסוי כתפיים, גב וצוואר",
        "עיסוי פנים וקרקפת",
        "עיסוי כפות רגליים",
      ],
      "עיסויים מיוחדים": [
        "עיסוי ספורטאים",
        "עיסוי לנשים בהריון",
        "עיסוי משולב",
        "רפלקסולוגיה",
      ],
    },
  },
  "איפור קבוע ועיצוב גבות": {
    subcategories: {
      "גבות": [
        "גבות שיטת השערה",
        "גבות שיטת הפודרה",
        "גבות שיטה משולבת",
      ],
      "תיחום עיניים": [
        "הדגשת קו ריסים תחתון",
        "הדגשת קו ריסים עליון",
        "אייליינר עליון",
      ],
      "שפתיים": [
        "תיחום שפתיים בקו טבעי",
        "מילוי שפתיים + תיחום",
      ],
      "ראש": [
        "מילוי קרקפת אישה",
        "מילוי קרקפת גבר",
        "נקודת חן",
      ],
    },
  },
};

const SECRETARY_LOCAL_TREATMENTS = [
  { id: "body_1", name: "עיסוי שוודי", class_name: "טיפולי גוף", category: "עיסוי גוף" },
  { id: "body_2", name: "עיסוי באבנים חמות", class_name: "טיפולי גוף", category: "עיסוי גוף" },
  { id: "body_3", name: "שיאצו", class_name: "טיפולי גוף", category: "עיסוי גוף" },
  { id: "body_4", name: "עיסוי תאילנדי", class_name: "טיפולי גוף", category: "עיסוי גוף" },
  { id: "body_5", name: "עיסוי רקמות עמוק", class_name: "טיפולי גוף", category: "עיסוי גוף" },
  { id: "body_6", name: "עיסוי קצוות", class_name: "טיפולי גוף", category: "עיסוי גוף" },
  { id: "body_7", name: "עיסוי כתפיים, גב וצוואר", class_name: "טיפולי גוף", category: "עיסוי ממוקד" },
  { id: "body_8", name: "עיסוי פנים וקרקפת", class_name: "טיפולי גוף", category: "עיסוי ממוקד" },
  { id: "body_9", name: "עיסוי כפות רגליים", class_name: "טיפולי גוף", category: "עיסוי ממוקד" },
  { id: "body_10", name: "עיסוי ספורטאים", class_name: "טיפולי גוף", category: "עיסויים מיוחדים" },
  { id: "body_11", name: "עיסוי לנשים בהריון", class_name: "טיפולי גוף", category: "עיסויים מיוחדים" },
  { id: "body_12", name: "עיסוי משולב", class_name: "טיפולי גוף", category: "עיסויים מיוחדים" },
  { id: "body_13", name: "רפלקסולוגיה", class_name: "טיפולי גוף", category: "עיסויים מיוחדים" },
  { id: "pmu_1", name: "גבות שיטת השערה", class_name: "איפור קבוע ועיצוב גבות", category: "גבות" },
  { id: "pmu_2", name: "גבות שיטת הפודרה", class_name: "איפור קבוע ועיצוב גבות", category: "גבות" },
  { id: "pmu_3", name: "גבות שיטה משולבת", class_name: "איפור קבוע ועיצוב גבות", category: "גבות" },
  { id: "pmu_4", name: "הדגשת קו ריסים תחתון", class_name: "איפור קבוע ועיצוב גבות", category: "תיחום עיניים" },
  { id: "pmu_5", name: "הדגשת קו ריסים עליון", class_name: "איפור קבוע ועיצוב גבות", category: "תיחום עיניים" },
  { id: "pmu_6", name: "אייליינר עליון", class_name: "איפור קבוע ועיצוב גבות", category: "תיחום עיניים" },
  { id: "pmu_7", name: "תיחום שפתיים בקו טבעי", class_name: "איפור קבוע ועיצוב גבות", category: "שפתיים" },
  { id: "pmu_8", name: "מילוי שפתיים + תיחום", class_name: "איפור קבוע ועיצוב גבות", category: "שפתיים" },
  { id: "pmu_9", name: "מילוי קרקפת אישה", class_name: "איפור קבוע ועיצוב גבות", category: "ראש" },
  { id: "pmu_10", name: "מילוי קרקפת גבר", class_name: "איפור קבוע ועיצוב גבות", category: "ראש" },
  { id: "pmu_11", name: "נקודת חן", class_name: "איפור קבוע ועיצוב גבות", category: "ראש" },
  { id: "styling_1", name: "מפגש תדמית 2.5 שעות", class_name: "סטיילינג אישי", category: "" },
  { id: "styling_2", name: "מפגש תדמית 4 שעות", class_name: "סטיילינג אישי", category: "" },
];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function timeToMinutes(time) {
  const [h, m] = (time || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function getBusinessNowParts() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function getPastSelectionError(date, time) {
  if (!date || !time) return null;
  const now = getBusinessNowParts();
  if (date < now.date) return "past_date";
  if (date === now.date && time <= now.time) return "past_time";
  return null;
}

function hasFourDigitYear(dateValue = "") {
  if (!dateValue) return false;
  const [year = ""] = dateValue.split("-");
  return /^\d{4}$/.test(year);
}

function normalizeDateInput(value = "") {
  if (!value) return "";
  const [year = "", month = "", day = ""] = value.split("-");
  if (!year) return value;
  const normalizedYear = year.slice(0, 4);
  if (!month || !day) return value;
  return `${normalizedYear}-${month}-${day}`;
}

function addDaysToISO(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function hasLogicalBookingYear(dateValue, minDate, maxDate) {
  if (!dateValue || !hasFourDigitYear(dateValue)) return false;
  return dateValue >= minDate && dateValue <= maxDate;
}

function normalizeTreatmentLabel(value = "") {
  return value
    .trim()
    .replace(/[׳’‘`´]/g, "'")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getTreatmentByName(treatments, treatmentName) {
  const treatmentKey = normalizeTreatmentLabel(treatmentName);
  return treatments.find((t) => normalizeTreatmentLabel(t.name) === treatmentKey) || null;
}

function createImplicitTreatmentId(categoryName, subcategoryName = "") {
  const categoryPart = encodeURIComponent(categoryName || "");
  const subcategoryPart = encodeURIComponent(subcategoryName || "");
  return subcategoryPart
    ? `secretary::${categoryPart}::${subcategoryPart}`
    : `secretary::${categoryPart}`;
}

function parseImplicitTreatmentId(treatmentId) {
  if (!treatmentId || !treatmentId.startsWith("secretary::")) return null;
  const [, rawCategory = "", rawSubcategory = ""] = treatmentId.split("::");
  try {
    return {
      category: decodeURIComponent(rawCategory),
      subcategory: rawSubcategory ? decodeURIComponent(rawSubcategory) : "",
    };
  } catch {
    return null;
  }
}

function getAppointmentCategory(appt, treatments) {
  if (appt.treatment_category) return appt.treatment_category;
  const treatment = treatments.find((item) => item.id === appt.treatment_id);
  if (treatment?.class_name) return treatment.class_name;
  return parseImplicitTreatmentId(appt.treatment_id)?.category || "";
}

function getCategoryStructure(treatments, className) {
  if (!className) {
    return { subcategories: [], treatments: [] };
  }

  const preset = SECRETARY_CATEGORY_PRESETS[className];
  if (preset) {
    return {
      subcategories: Object.entries(preset.subcategories).map(([name, treatmentNames]) => ({
        name,
        treatments: treatmentNames
          .map((treatmentName) => getTreatmentByName(treatments, treatmentName))
          .filter(Boolean),
      })),
      treatments: [],
    };
  }

  const categoryMap = new Map();
  const directTreatments = [];

  treatments
    .filter((t) => t.class_name === className)
    .forEach((treatment) => {
      const subcategory = (treatment.category || "").trim();
      if (!subcategory) {
        directTreatments.push(treatment);
        return;
      }
      if (!categoryMap.has(subcategory)) categoryMap.set(subcategory, []);
      categoryMap.get(subcategory).push(treatment);
    });

  return {
    subcategories: Array.from(categoryMap, ([name, items]) => ({ name, treatments: items })),
    treatments: directTreatments,
  };
}

function mergeSecretaryTreatments(apiTreatments) {
  const byId = new Map((apiTreatments || []).map((treatment) => [treatment.id, treatment]));
  SECRETARY_LOCAL_TREATMENTS.forEach((treatment) => {
    if (!byId.has(treatment.id)) {
      byId.set(treatment.id, treatment);
    }
  });
  return Array.from(byId.values());
}

// Returns layout info for each appt: { top, height, left, width }
// Appointments that overlap share the horizontal space side-by-side.
function computeOverlapLayout(appts) {
  // Sort by start time
  const sorted = [...appts].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // Group into overlap clusters
  const clusters = [];
  for (const appt of sorted) {
    const start = timeToMinutes(appt.time);
    let placed = false;
    for (const cluster of clusters) {
      const clusterEnd = Math.max(...cluster.map((c) => timeToMinutes(c.end_time || c.time) || timeToMinutes(c.time) + 60));
      if (start < clusterEnd) {
        cluster.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([appt]);
  }

  const layout = new Map();
  for (const cluster of clusters) {
    const n = cluster.length;
    cluster.forEach((appt, idx) => {
      const startMin = timeToMinutes(appt.time);
      const endMin = timeToMinutes(appt.end_time || appt.time) || startMin + 60;
      const top = ((startMin - FIRST_HOUR * 60) / 60) * ROW_HEIGHT;
      const height = Math.max(((endMin - startMin) / 60) * ROW_HEIGHT, 18);
      layout.set(appt.id, {
        top,
        height,
        left: idx / n,
        width: 1 / n,
      });
    });
  }
  return layout;
}

// ── Detail Modal ──────────────────────────────────────────────
function AppointmentModal({ appt, onClose, onDelete }) {
  if (!appt) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl w-80 p-6 relative border"
        style={{ background: "#FFFFFF", borderColor: "#EADFD5", boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <button onClick={onClose} className="absolute left-4 top-4 text-gray-300 hover:text-gray-500 transition-colors">
          <X size={18} />
        </button>

        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "#F4EFEA" }}>
          <CalendarDays size={20} style={{ color: "#C9A27E" }} />
        </div>

        <h3 className="font-bold text-gray-900 text-base mb-4">{appt.client_name}</h3>

        <div className="space-y-2.5 text-sm text-gray-600">
          {appt.client_phone && (
            <div className="flex items-center gap-2.5">
              <Phone size={14} className="shrink-0" style={{ color: "#C9A27E" }} />
              <span>{appt.client_phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Sparkles size={14} className="shrink-0" style={{ color: "#C9A27E" }} />
            <span>{appt.treatment_name}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CalendarDays size={14} className="shrink-0" style={{ color: "#C9A27E" }} />
            <span>{appt.date}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock size={14} className="shrink-0" style={{ color: "#C9A27E" }} />
            <span>{appt.time}{appt.end_time ? ` – ${appt.end_time}` : ""}</span>
          </div>
          {appt.notes && (
            <div className="rounded-xl px-3 py-2 text-xs text-gray-500 mt-2" style={{ background: "#F4EFEA", border: "1px solid #EADFD5" }}>
              {appt.notes}
            </div>
          )}
        </div>

        <button
          onClick={() => { onDelete(appt.id); onClose(); }}
          className="mt-5 w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 hover:border-red-200 py-2.5 rounded-xl text-sm transition-all"
        >
          <Trash2 size={14} />
          מחק תור
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function SecretaryPage() {
  const [treatments, setTreatments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [flashFields, setFlashFields] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [hoveredApptId, setHoveredApptId] = useState(null);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [pastLabelVisible, setPastLabelVisible] = useState(true);

  const [drag, setDrag] = useState(null);
  const isDragging = drag !== null;

  const [viewMode, setViewMode] = useState("week"); // "week" | "year"
  const [yearViewYear, setYearViewYear] = useState(new Date().getFullYear());
  const [highlightedDateCol, setHighlightedDateCol] = useState(null);
  const highlightedDateTimer = useRef(null);

  // ── Reschedule drag state ──────────────────────────────────
  // reschedule = { appt, durationMin, targetDate, targetHour }
  const rescheduleRef = useRef(null);
  const [reschedule, _setReschedule] = useState(null);
  function setReschedule(val) {
    const next = typeof val === "function" ? val(rescheduleRef.current) : val;
    rescheduleRef.current = next;
    _setReschedule(next);
  }
  const [justRescheduledId, setJustRescheduledId] = useState(null);
  const justRescheduledTimer = useRef(null);

  // ── Post-booking scroll + highlight ───────────────────────
  const calendarScrollRef = useRef(null);
  const [newlyBookedId, setNewlyBookedId] = useState(null);
  const newlyBookedTimer = useRef(null);
  // ─────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────

  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldFlash, setFieldFlash] = useState({});
  const flashTimers = useRef({});
  const fieldRefs = useRef({});

  function isValidPhone(val) {
    return /^05\d-?\d{7}$/.test(val.trim());
  }

  function triggerFlash(fields) {
    const flashOn = {};
    fields.forEach((f) => { flashOn[f] = true; });
    setFieldFlash((prev) => ({ ...prev, ...flashOn }));
    fields.forEach((field) => {
      if (flashTimers.current[field]) clearTimeout(flashTimers.current[field]);
      flashTimers.current[field] = setTimeout(() => {
        setFieldFlash((prev) => ({ ...prev, [field]: false }));
      }, 1500);
    });
  }

  // Field order determines which is "first" when scrolling to errors
  const FIELD_ORDER = ["client_name", "client_phone", "treatment_category", "treatment_subcategory", "treatment_id", "date", "time", "end_time"];

  function scrollToFirstError(invalidFields) {
    const first = FIELD_ORDER.find((f) => invalidFields.includes(f));
    if (first && fieldRefs.current[first]) {
      fieldRefs.current[first].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function clearFieldError(field) {
    setFieldErrors((prev) => ({ ...prev, [field]: false }));
    setFieldFlash((prev) => ({ ...prev, [field]: false }));
  }

  function clearPastTimingErrors() {
    setFieldErrors((prev) => ({ ...prev, past_date: false, past_time: false }));
  }

  function showPastSelectionFeedback(date, hour) {
    const errorKey = date < today || (typeof hour === "number" && !isFutureSlot(date, hour))
      ? (date < today ? "past_date" : "past_time")
      : null;

    if (!errorKey) return;

    setFormOpen(true);
    setFieldErrors((prev) => ({ ...prev, [errorKey]: true }));
    triggerFlash(["date", "time"]);
    setTimeout(() => scrollToFirstError(["date", "time"]), 120);
  }

  function handlePhoneChange(e) {
    const val = e.target.value;
    setForm((f) => ({ ...f, client_phone: val }));
    if (val === "") {
      setFieldErrors((prev) => ({ ...prev, client_phone: true }));
    } else if (!isValidPhone(val)) {
      setFieldErrors((prev) => ({ ...prev, client_phone: true }));
      triggerFlash(["client_phone"]);
    } else {
      clearFieldError("client_phone");
    }
  }

  const [flipDir, setFlipDir] = useState(null);
  const [animating, setAnimating] = useState(false);

  function navigateWeek(dir) {
    if (animating) return;
    setFlipDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setWeekStart((w) => addDays(w, dir === "next" ? 7 : -7));
      setAnimating(false);
      setFlipDir(null);
    }, 350);
  }

  const [form, setForm] = useState({
    client_name: "", client_phone: "",
    treatment_id: "", treatment_name: "",
    date: "", time: "", end_time: "", notes: "",
  });
  const [selectedTreatmentCategory, setSelectedTreatmentCategory] = useState("");
  const [selectedTreatmentSubcategory, setSelectedTreatmentSubcategory] = useState("");

  useEffect(() => {
    fetchTreatments()
      .then((data) => setTreatments(mergeSecretaryTreatments(data)))
      .catch(console.error);
    load();
  }, []);

  useEffect(() => { setPastLabelVisible(true); }, [weekStart]);

  useEffect(() => {
    if (form.time && form.end_time && form.time < form.end_time) {
      setFieldErrors((prev) => ({ ...prev, time: false, end_time: false, time_order: false }));
      setFieldFlash((prev) => ({ ...prev, time: false, end_time: false }));
    }
  }, [form.time, form.end_time]);

  function load() {
    fetchAppointments().then(setAppointments).catch(console.error);
  }

  const selectedCategoryStructure = getCategoryStructure(treatments, selectedTreatmentCategory);
  const selectedSubcategoryGroup = selectedCategoryStructure.subcategories.find(
    (group) => group.name === selectedTreatmentSubcategory
  ) || null;
  const showTreatmentSubcategory = !!selectedTreatmentCategory && selectedCategoryStructure.subcategories.length > 0;
  const treatmentOptions = selectedSubcategoryGroup
    ? selectedSubcategoryGroup.treatments
    : showTreatmentSubcategory
    ? []
    : selectedCategoryStructure.treatments;
  const requiresSubcategory = showTreatmentSubcategory;
  const requiresTreatment = !!selectedTreatmentCategory && (!requiresSubcategory || !!selectedTreatmentSubcategory) && treatmentOptions.length > 0;
  const showTreatmentSelect = requiresTreatment;

  function handleTreatmentChange(e) {
    const t = treatments.find((x) => x.id === e.target.value);
    setForm((f) => ({ ...f, treatment_id: t?.id || "", treatment_name: t?.name || "" }));
  }

  function resetSelectedTreatment() {
    setForm((f) => ({ ...f, treatment_id: "", treatment_name: "" }));
  }

  function handleTreatmentCategoryChange(e) {
    setSelectedTreatmentCategory(e.target.value);
    setSelectedTreatmentSubcategory("");
    resetSelectedTreatment();
    clearFieldError("treatment_category");
    clearFieldError("treatment_subcategory");
    clearFieldError("treatment_id");
  }

  function handleTreatmentSubcategoryChange(e) {
    setSelectedTreatmentSubcategory(e.target.value);
    resetSelectedTreatment();
    clearFieldError("treatment_subcategory");
    clearFieldError("treatment_id");
  }

  function buildAppointmentTreatmentPayload() {
    const categoryName = selectedTreatmentCategory.trim();
    const subcategoryName = selectedTreatmentSubcategory.trim();
    const selectedTreatment = treatments.find((x) => x.id === form.treatment_id);

    if (selectedTreatment) {
      return {
        treatment_id: selectedTreatment.id,
        treatment_name: selectedTreatment.name,
        treatment_category: categoryName,
        treatment_subcategory: subcategoryName || null,
      };
    }

    const implicitName = subcategoryName
      ? `${categoryName} - ${subcategoryName}`
      : categoryName;

    return {
      treatment_id: createImplicitTreatmentId(categoryName, subcategoryName),
      treatment_name: implicitName,
      treatment_category: categoryName,
      treatment_subcategory: subcategoryName || null,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const required = {
      client_name: !!form.client_name.trim(),
      client_phone: !!form.client_phone.trim() && isValidPhone(form.client_phone),
      treatment_category: !!selectedTreatmentCategory.trim(),
      treatment_subcategory: !requiresSubcategory || !!selectedTreatmentSubcategory.trim(),
      treatment_id: !requiresTreatment || !!form.treatment_id,
      date: !!form.date,
      time: !!form.time,
      end_time: !!form.end_time,
    };
    const invalid = Object.keys(required).filter((k) => !required[k]);
    if (invalid.length > 0) {
      const errors = {};
      invalid.forEach((k) => { errors[k] = true; });
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      triggerFlash(invalid);
      scrollToFirstError(invalid);
      return;
    }
    if (!hasLogicalBookingYear(form.date, today, maxBookableDate)) {
      setFieldErrors((prev) => ({ ...prev, date_year: true }));
      triggerFlash(["date"]);
      scrollToFirstError(["date"]);
      return;
    }
    if (form.end_time <= form.time) {
      setFieldErrors((prev) => ({ ...prev, time_order: true }));
      triggerFlash(["time", "end_time"]);
      scrollToFirstError(["time"]);
      return;
    }
    const pastSelectionError = getPastSelectionError(form.date, form.time);
    if (pastSelectionError) {
      setFieldErrors((prev) => ({ ...prev, [pastSelectionError]: true }));
      triggerFlash(["date", "time"]);
      scrollToFirstError(["date", "time"]);
      return;
    }
    setSaving(true);
    try {
      const appointmentTreatment = buildAppointmentTreatmentPayload();
      const payload = {
        ...form,
        ...appointmentTreatment,
      };
      const result = await createAppointment(payload);
      const bookedDate = form.date;
      const bookedTime = form.time;
      const bookedTreatmentId = payload.treatment_id;
      setForm({ client_name: "", client_phone: "", treatment_id: "", treatment_name: "", date: "", time: "", end_time: "", notes: "" });
      setSelectedTreatmentCategory("");
      setSelectedTreatmentSubcategory("");
      setFieldErrors({});
      setFieldFlash({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Switch filter to the booked treatment's category (uses existing fade transition)
      const bookedCat = appointmentTreatment.treatment_category || treatments.find((t) => t.id === bookedTreatmentId)?.class_name || null;
      switchCategory(bookedCat);
      // Navigate to the booked week
      setWeekStart(getWeekStart(new Date(bookedDate)));
      setNewlyBookedId(result.id);
      load();
      // Scroll after filter transition + state settle (220ms fade + buffer)
      setTimeout(() => {
        if (calendarScrollRef.current) {
          const hour = Math.floor(timeToMinutes(bookedTime) / 60);
          const scrollTop = Math.max(0, (hour - FIRST_HOUR) * ROW_HEIGHT - 60);
          calendarScrollRef.current.scrollTo({ top: scrollTop, behavior: "smooth" });
        }
        if (newlyBookedTimer.current) clearTimeout(newlyBookedTimer.current);
        newlyBookedTimer.current = setTimeout(() => setNewlyBookedId(null), 2500);
      }, 340);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteAppointment(id);
    load();
  }

  // ── Reschedule helpers ────────────────────────────────────
  function isFutureSlot(date, hour) {
    const now = getBusinessNowParts();
    const slotTime = `${String(hour).padStart(2, "0")}:00`;
    if (date > now.date) return true;
    if (date < now.date) return false;
    return slotTime > now.time;
  }

  function handleRescheduleStart(appt, e) {
    if (isDragging) return;
    const now = new Date();
    if (new Date(`${appt.date}T${appt.time}`) <= now) return; // past appt
    e.preventDefault();
    e.stopPropagation();
    const startMin = timeToMinutes(appt.time);
    const endMin = timeToMinutes(appt.end_time || appt.time);
    const durationMin = Math.max(endMin - startMin, 60);
    setReschedule({ appt, durationMin, targetDate: appt.date, targetHour: Math.floor(startMin / 60) });
  }

  function handleRescheduleEnter(date, hour) {
    if (!rescheduleRef.current) return;
    if (!isFutureSlot(date, hour)) return;
    setReschedule((r) => ({ ...r, targetDate: date, targetHour: hour }));
  }

  // Register global mouseup once; reads latest state via ref
  useEffect(() => {
    async function onGlobalMouseUp() {
      const r = rescheduleRef.current;
      if (!r) return;
      setReschedule(null);

      const { appt, durationMin, targetDate, targetHour } = r;

      if (!isFutureSlot(targetDate, targetHour)) return;
      // No-op if dropped on same hour/day
      if (targetDate === appt.date && targetHour === Math.floor(timeToMinutes(appt.time) / 60)) return;

      const newTime = `${String(targetHour).padStart(2, "0")}:00`;
      const endTotalMin = Math.min(targetHour * 60 + durationMin, 22 * 60);
      const newEndTime = `${String(Math.floor(endTotalMin / 60)).padStart(2, "0")}:${String(endTotalMin % 60).padStart(2, "0")}`;

      // Optimistic update
      setAppointments((prev) =>
        prev.map((a) => a.id === appt.id ? { ...a, date: targetDate, time: newTime, end_time: newEndTime } : a)
      );
      if (justRescheduledTimer.current) clearTimeout(justRescheduledTimer.current);
      setJustRescheduledId(appt.id);
      justRescheduledTimer.current = setTimeout(() => setJustRescheduledId(null), 2000);

      try {
        await updateAppointment(appt.id, { date: targetDate, time: newTime, end_time: newEndTime });
      } catch (err) {
        console.error(err);
        load(); // rollback on error
      }
    }
    window.addEventListener("mouseup", onGlobalMouseUp);
    return () => window.removeEventListener("mouseup", onGlobalMouseUp);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply grabbing cursor to whole page while rescheduling
  useEffect(() => {
    const active = reschedule !== null;
    if (!active) return;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [reschedule !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─────────────────────────────────────────────────────────

  function handleCellClick(date, hour) {
    if (isDragging) return;
    if (rescheduleRef.current) return;
    if (!isFutureSlot(date, hour)) {
      showPastSelectionFeedback(date, hour);
      return;
    }
    const h = String(hour).padStart(2, "0");
    const endH = String(hour + 1).padStart(2, "0");
    setForm((f) => ({ ...f, date, time: `${h}:00`, end_time: `${endH}:00` }));
    clearFieldError("date_year");
    clearPastTimingErrors();
  }

  function handleDragStart(date, hour) {
    if (rescheduleRef.current) return;
    if (!isFutureSlot(date, hour)) {
      showPastSelectionFeedback(date, hour);
      return;
    }
    setDrag({ date, startHour: hour, endHour: hour });
  }

  function handleDragEnter(date, hour) {
    if (!drag || drag.date !== date) return;
    if (!isFutureSlot(date, hour)) return;
    setDrag((d) => ({ ...d, endHour: hour }));
  }

  function handleDragEnd() {
    if (!drag) return;
    const start = Math.min(drag.startHour, drag.endHour);
    const end = Math.max(drag.startHour, drag.endHour) + 1;
    const h = String(start).padStart(2, "0");
    const endH = String(end).padStart(2, "0");
    setForm((f) => ({ ...f, date: drag.date, time: `${h}:00`, end_time: `${endH}:00` }));
    clearFieldError("date_year");
    setFormOpen(true);
    setDrag(null);
    setFlashFields(true);
    setTimeout(() => setFlashFields(false), 1800);
    setTimeout(() => {
      if (fieldRefs.current.date) {
        fieldRefs.current.date.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 150);
  }

  const [activeCategory, setActiveCategory] = useState(null); // null = show all
  const [categoryFading, setCategoryFading] = useState(false);

  function switchCategory(cat) {
    // No animation when toggling off (going back to "all") or clicking same
    if (cat === null || cat === activeCategory) {
      setActiveCategory(cat === activeCategory ? null : cat);
      return;
    }
    setCategoryFading(true);
    setTimeout(() => {
      setActiveCategory(cat);
      setCategoryFading(false);
    }, 220);
  }

  const today = getBusinessNowParts().date;
  const maxBookableDate = addDaysToISO(today, MAX_ADVANCE_BOOKING_DAYS);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${weekEnd.getFullYear()}`;
  const weekDayStrings = weekDays.map(toISO);
  const allWeekAppts = appointments.filter((a) => weekDayStrings.includes(a.date));
  const weekAppts = activeCategory
    ? allWeekAppts.filter((a) => getAppointmentCategory(a, treatments) === activeCategory)
    : allWeekAppts;
  const isPastWeek = toISO(addDays(weekStart, 6)) < today;
  const isCurrentWeek = toISO(weekStart) === toISO(getWeekStart(new Date()));
  const apptDates = new Set(appointments.map((a) => a.date));

  function buildMonthGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function handleYearDayClick(year, month, day) {
    if (!day) return;
    const date = new Date(year, month, day);
    const iso = toISO(date);
    setWeekStart(getWeekStart(date));
    setViewMode("week");
    if (highlightedDateTimer.current) clearTimeout(highlightedDateTimer.current);
    setHighlightedDateCol(iso);
    highlightedDateTimer.current = setTimeout(() => setHighlightedDateCol(null), 1800);
    setTimeout(() => {
      if (calendarScrollRef.current)
        calendarScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  }

  function goToToday() {
    if (animating) return;
    const currentWeekStart = getWeekStart(new Date());
    const dir = currentWeekStart < weekStart ? "prev" : "next";
    setFlipDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setWeekStart(currentWeekStart);
      setAnimating(false);
      setFlipDir(null);
      // Return to the top of the current week view.
      setTimeout(() => {
        if (calendarScrollRef.current) {
          calendarScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 60);
    }, 350);
  }

  // Derive ordered category list from loaded treatments
  const loadedCategories = Array.from(new Set(treatments.map((t) => t.class_name).filter(Boolean)));
  const categories = [
    ...SECRETARY_CATEGORY_OPTIONS,
    ...loadedCategories.filter((cat) => !SECRETARY_CATEGORY_OPTIONS.includes(cat)),
  ];

  function inputCls(field) {
    const base = "w-full pr-8 pl-2 py-2.5 bg-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-all placeholder-[#7C6A57] shadow-[0_8px_20px_rgba(73,47,27,0.08)] border text-[#111111]";
    const hasTimingError = field === "date"
      ? fieldErrors.past_date || fieldErrors.past_time || fieldErrors.date_year
      : field === "time"
      ? fieldErrors.past_date || fieldErrors.past_time
      : false;
    if (fieldFlash[field]) return base + " border-red-400 focus:ring-red-200 focus:border-red-400";
    if (fieldErrors[field] || hasTimingError) return base + " border-red-300 focus:ring-red-200 focus:border-red-300";
    return base + " border-[#D6B99A] focus:ring-[#C9A27E]/45 focus:border-[#B88656]";
  }
  function selectCls(field) {
    const base = "w-full px-3 py-2.5 bg-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-all shadow-[0_8px_20px_rgba(73,47,27,0.08)] text-[#111111] border";
    if (fieldFlash[field]) return base + " border-red-400 focus:ring-red-200 focus:border-red-400";
    if (fieldErrors[field]) return base + " border-red-300 focus:ring-red-200 focus:border-red-300";
    return base + " border-[#D6B99A] focus:ring-[#C9A27E]/45 focus:border-[#B88656]";
  }
  const labelCls = "block text-[12px] font-bold uppercase tracking-widest mb-1.5 text-[#1B130C]";
  const fieldIconCls = "absolute right-3 top-1/2 -translate-y-1/2 text-[#6A4B2D]";
  const Star = () => <span className="text-[#C63B3B] font-black text-[15px] leading-none normal-case tracking-normal ml-1 inline-block align-middle">*</span>;
  const FieldError = ({ show, message = "שדה חובה." }) => (
    <div className="flex items-center gap-1 mt-1 overflow-hidden"
      style={{ maxHeight: show ? "24px" : "0px", opacity: show ? 1 : 0, transition: "max-height 0.3s ease, opacity 0.3s ease" }}>
      <X size={11} className="text-red-400 shrink-0" />
      <span className="text-[11px] text-red-400">{message}</span>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen" style={{
      backgroundImage: "url('/salon-bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    }}>
      <AppointmentModal
        appt={selectedAppt}
        onClose={() => setSelectedAppt(null)}
        onDelete={handleDelete}
      />

      {/* Header */}
      <div className="px-8 py-4 flex items-center justify-between relative overflow-hidden"
        style={{ background: "rgba(253,249,246,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(240,232,223,0.6)" }}>

        {/* Animated radiant glow from logo side */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[70%] h-[200%]"
            style={{
              background: "radial-gradient(ellipse at right center, rgba(201,162,126,0.18) 0%, rgba(201,162,126,0.07) 45%, transparent 72%)",
              animation: "radiateGlow 3.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Logo — faded */}
        <img src="/logo.png" alt="logo" className="h-16 w-auto opacity-60 relative z-10" />

        {/* Centered title */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center select-none">
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "13px",
              letterSpacing: "0.55em",
              color: "#8b6f52",
              textTransform: "uppercase",
              marginBottom: "1px",
              fontWeight: 400,
            }}>
              notebook of
            </p>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "42px",
              fontStyle: "italic",
              fontWeight: 600,
              letterSpacing: "0.06em",
              lineHeight: 1,
              color: "#7a4f2a",
            }}>
              appointments
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border relative z-10"
          style={{ color: "#8b6f52", background: "rgba(201,162,126,0.12)", borderColor: "rgba(201,162,126,0.35)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: "badge-pulse 2s ease-in-out infinite" }}></div>
          מחובר
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)] relative">

        {/* ── Left panel ─────────────────────────────────────── */}
        <div className="w-72 min-w-[272px] border-l border-gray-100 overflow-y-auto flex flex-col shadow-sm relative">
          {/* Faded white overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.62)" }} />

          {/* Vertical brand name */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden">
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "92px",
              fontWeight: 700,
              fontStyle: "italic",
              letterSpacing: "0.18em",
              color: "rgba(160,110,75,0.13)",
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              userSelect: "none",
              lineHeight: 1,
            }}>Meday</p>
          </div>

          {/* Toggle button */}
          <div className="p-4 border-b border-gray-50 relative z-10">
            <button
              type="button"
              onClick={() => setFormOpen((o) => !o)}
              className="w-full rounded-2xl transition-all duration-200 group overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #EDE0D0, #DCCAB5)",
                border: "none",
                borderRadius: "12px",
                boxShadow: "0 8px 20px rgba(220,202,181,0.3)",
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300
                    ${formOpen ? "rotate-45" : "bg-white group-hover:scale-110"}`}
                    style={{ background: "rgba(255,255,255,0.25)", boxShadow: "none" }}>
                    <Plus size={18} className={formOpen ? "rotate-45 transition-transform duration-300" : "transition-transform duration-300"} style={{ color: "#6b4f35" }} />
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm leading-tight" style={{ color: "#111111" }}>קביעת תור חדש</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#555555" }}>{formOpen ? "לחצי לסגירה" : "לחצי לפתיחה"}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${formOpen ? "rotate-180" : ""}`}
                  style={{ background: "rgba(107,79,53,0.12)" }}>
                  <ChevronLeft size={13} style={{ color: "#6b4f35" }} className="-rotate-90" />
                </div>
              </div>
              <div className="h-px bg-gradient-to-l from-transparent via-white/30 to-transparent" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}
            className={`p-5 space-y-4 overflow-y-auto transition-all duration-300 relative z-10 ${formOpen ? "flex-1 opacity-100" : "max-h-0 opacity-0 p-0 pointer-events-none overflow-hidden"}`}>

            {/* שם הלקוחה */}
            <div>
              <label className={labelCls}>שם הלקוחה <Star /></label>
              <div className="relative">
                <User size={13} className={fieldIconCls} />
                <input type="text" value={form.client_name}
                  ref={(el) => { fieldRefs.current.client_name = el; }}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, client_name: e.target.value }));
                    if (e.target.value.trim()) clearFieldError("client_name");
                  }}
                  placeholder="שם מלא" className={inputCls("client_name")} />
              </div>
              <FieldError show={fieldErrors.client_name} />
            </div>

            {/* טלפון */}
            <div>
              <label className={labelCls}>טלפון <Star /></label>
              <div className="relative">
                <Phone size={13} className={fieldIconCls} />
                <input type="tel" value={form.client_phone}
                  ref={(el) => { fieldRefs.current.client_phone = el; }}
                  onChange={handlePhoneChange}
                  placeholder="050-0000000"
                  className={inputCls("client_phone")} />
              </div>
              <FieldError show={fieldErrors.client_phone} />
            </div>

            <div className="h-px bg-gray-100" />

            {/* טיפול */}
            <div
              ref={(el) => { fieldRefs.current.treatment_id = el; }}
              className="space-y-3"
            >
              <div>
                <label className={labelCls}>סוגי טיפולים <Star /></label>
                <select
                  ref={(el) => { fieldRefs.current.treatment_category = el; }}
                  value={selectedTreatmentCategory}
                  onChange={handleTreatmentCategoryChange}
                  className={selectCls("treatment_category")}
                >
                  <option value="">בחרי סוג טיפול...</option>
                  {SECRETARY_CATEGORY_OPTIONS.map((categoryName) => (
                    <option key={categoryName} value={categoryName}>{categoryName}</option>
                  ))}
                </select>
                <FieldError show={fieldErrors.treatment_category} />
              </div>

              {showTreatmentSubcategory && (
                <div>
                  <label className={labelCls}>תת קטגוריה <Star /></label>
                  <select
                    ref={(el) => { fieldRefs.current.treatment_subcategory = el; }}
                    value={selectedTreatmentSubcategory}
                    onChange={handleTreatmentSubcategoryChange}
                    className={selectCls("treatment_subcategory")}
                  >
                    <option value="">בחרי תת קטגוריה...</option>
                    {selectedCategoryStructure.subcategories.map((group) => (
                      <option key={group.name} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                  <FieldError show={fieldErrors.treatment_subcategory} />
                </div>
              )}

              {showTreatmentSelect && (
                <div>
                  <label className={labelCls}>טיפול <Star /></label>
                  <select
                    ref={(el) => { fieldRefs.current.treatment_id = el; }}
                    value={form.treatment_id}
                    onChange={(e) => {
                      handleTreatmentChange(e);
                      if (e.target.value) clearFieldError("treatment_id");
                    }}
                    className={selectCls("treatment_id")}
                  >
                    <option value="">בחרי טיפול...</option>
                    {treatmentOptions.map((treatment) => (
                      <option key={treatment.id} value={treatment.id}>{treatment.name}</option>
                    ))}
                  </select>
                  <FieldError show={fieldErrors.treatment_id} />
                </div>
              )}

            </div>

            {/* תאריך */}
            <div
              className="rounded-xl"
              style={flashFields ? { animation: "fieldHighlight 1.8s ease forwards" } : {}}
            >
              <label className={labelCls}>תאריך <Star /></label>
              <div className="relative">
                <CalendarDays size={13} className={fieldIconCls} />
                <input
                  type="date"
                  min={today}
                  max={maxBookableDate}
                  value={form.date}
                  ref={(el) => { fieldRefs.current.date = el; }}
                  onChange={(e) => {
                    const nextValue = normalizeDateInput(e.target.value);
                    setForm((f) => ({ ...f, date: nextValue }));
                    if (nextValue) clearFieldError("date");
                    clearFieldError("date_year");
                    clearPastTimingErrors();
                  }}
                  className={inputCls("date")}
                />
              </div>
              <FieldError show={fieldErrors.date} />
              <FieldError show={fieldErrors.date_year} message="השנה הזו אינה תקינה" />
            </div>

            {/* שעות */}
            <div
              className="rounded-xl"
              style={flashFields ? { animation: "fieldHighlight 1.8s ease forwards" } : {}}
            >
              <label className={labelCls}>שעות <Star /></label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Clock size={13} className={fieldIconCls} />
                  <input
                    type="time"
                    value={form.time}
                    ref={(el) => { fieldRefs.current.time = el; }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => {
                        if (val) clearFieldError("time");
                        if (val && f.end_time && val < f.end_time) clearFieldError("time_order");
                        clearPastTimingErrors();
                        return { ...f, time: val };
                      });
                    }}
                    className={inputCls("time")}
                  />
                </div>
                <div className="relative">
                  <Clock size={13} className={fieldIconCls} />
                  <input
                    type="time"
                    value={form.end_time}
                    ref={(el) => { fieldRefs.current.end_time = el; }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => {
                        if (val) clearFieldError("end_time");
                        if (val && f.time && f.time < val) clearFieldError("time_order");
                        clearPastTimingErrors();
                        return { ...f, end_time: val };
                      });
                    }}
                    className={inputCls("end_time")}
                  />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#111111] font-semibold mt-1 px-1">
                <span>התחלה</span>
                <span>סיום</span>
              </div>
              <FieldError show={fieldErrors.time || fieldErrors.end_time} />
              <FieldError show={fieldErrors.time_order} message="שעת ההתחלה חייבת להיות מוקדמת משעת הסיום" />
              <FieldError show={fieldErrors.past_date} message="לא ניתן לקבוע תור לתאריך שכבר עבר" />
              <FieldError show={fieldErrors.past_time} message="לא ניתן לקבוע תור לשעה שכבר עברה" />
            </div>

            {/* הערות */}
            <div>
              <label className={labelCls}>הערות</label>
              <textarea rows={2} value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="הערות נוספות..."
                className="w-full px-3 py-2.5 bg-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-all resize-none shadow-[0_8px_20px_rgba(73,47,27,0.08)] text-[#111111] border border-[#D6B99A] focus:ring-[#C9A27E]/45 focus:border-[#B88656] placeholder-[#7C6A57]" />
            </div>

            <button type="submit" disabled={saving}
              className="w-full font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40 text-white shadow-md hover:shadow-lg active:scale-[0.98]"
              style={{
                background: "#C9A27E",
                boxShadow: "0 4px 18px rgba(201,162,126,0.35)",
              }}>
              {saving ? "שומר..." : "קבעי תור ←"}
            </button>

            {success && (
              <div className="text-center text-emerald-700 text-xs font-semibold bg-emerald-50 border border-emerald-100 py-2.5 rounded-xl">
                ✓ התור נקבע בהצלחה!
              </div>
            )}
          </form>

          {formOpen && (
            <div className="px-5 py-3 border-t border-gray-50 relative z-10">
              <p className="text-[11px] text-gray-300 text-center">
                לחצי על תא ביומן כדי למלא תאריך ושעה
              </p>
            </div>
          )}
        </div>

        {/* ── Right panel: Calendar ─────────────────────────── */}
        <div className="flex-1 flex items-stretch relative overflow-hidden">
          {/* Light overlay over the shared background */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(249,247,244,0.78)" }} />

          {/* Left arrow — next week (hidden in year view) */}
          {viewMode === "week" && (
          <button
            onClick={() => navigateWeek("next")}
            disabled={animating}
            className="absolute left-0 top-0 bottom-0 w-12 z-30 flex items-center justify-center group disabled:opacity-40"
          >
            <div className="w-8 h-24 bg-white hover:bg-[#F4EFEA] border rounded-r-2xl shadow-md flex items-center justify-center transition-all duration-200 group-hover:shadow-lg group-hover:w-10" style={{ borderColor: "#EADFD5" }}>
              <ChevronLeft size={20} className="text-[#B5B5B5] group-hover:text-[#C9A27E] transition-colors" />
            </div>
          </button>
          )}

          {/* Right arrow — previous week (hidden in year view) */}
          {viewMode === "week" && (
          <button
            onClick={() => navigateWeek("prev")}
            disabled={animating}
            className="absolute right-0 top-0 bottom-0 w-12 z-30 flex items-center justify-center group disabled:opacity-40"
          >
            <div className="w-8 h-24 bg-white hover:bg-[#F4EFEA] border rounded-l-2xl shadow-md flex items-center justify-center transition-all duration-200 group-hover:shadow-lg group-hover:w-10" style={{ borderColor: "#EADFD5" }}>
              <ChevronRight size={20} className="text-[#B5B5B5] group-hover:text-[#C9A27E] transition-colors" />
            </div>
          </button>
          )}

          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400;1,600&display=swap');
            @keyframes shimmer {
              0% { background-position: 200% center; }
              100% { background-position: -200% center; }
            }
            @keyframes radiateGlow {
              0%   { opacity: 0; transform: translateY(-50%) scaleX(0.85); }
              40%  { opacity: 1; transform: translateY(-50%) scaleX(1); }
              70%  { opacity: 0.8; transform: translateY(-50%) scaleX(1.05); }
              100% { opacity: 0; transform: translateY(-50%) scaleX(0.85); }
            }
            @keyframes fieldHighlight {
              0%   { background: transparent; box-shadow: 0 0 0 0px rgba(201,162,126,0); }
              18%  { background: #F4EFEA; box-shadow: 0 0 0 4px rgba(201,162,126,0.55); }
              55%  { background: #EDE4DA; box-shadow: 0 0 0 4px rgba(201,162,126,0.45); }
              82%  { background: #F4EFEA; box-shadow: 0 0 0 3px rgba(201,162,126,0.3); }
              100% { background: transparent; box-shadow: 0 0 0 0px rgba(201,162,126,0); }
            }
            @keyframes rescheduleGlow {
              0%   { box-shadow: 0 0 0 0px rgba(107,162,146,0); }
              20%  { box-shadow: 0 0 0 5px rgba(107,162,146,0.55); background-color: #b8dfd5; }
              65%  { box-shadow: 0 0 0 4px rgba(107,162,146,0.35); background-color: #b8dfd5; }
              100% { box-shadow: 0 0 0 0px rgba(107,162,146,0); }
            }
            @keyframes columnHighlight {
              0%   { background: transparent; }
              20%  { background: rgba(201,162,126,0.16); }
              70%  { background: rgba(201,162,126,0.10); }
              100% { background: transparent; }
            }
            @keyframes columnHeaderHighlight {
              0%   { background: #eddfc9; }
              20%  { background: rgba(186,138,90,0.55); }
              70%  { background: rgba(186,138,90,0.38); }
              100% { background: #eddfc9; }
            }
            @keyframes fadeInView {
              from { opacity: 0; transform: scale(0.97); }
              to   { opacity: 1; transform: scale(1); }
            }
            @keyframes newBookingPulse {
              0%   { box-shadow: 0 0 0 0px rgba(107,162,146,0); background-color: #d4ede6; }
              18%  { box-shadow: 0 0 0 7px rgba(107,162,146,0.6); background-color: #a8d5c8; }
              60%  { box-shadow: 0 0 0 5px rgba(107,162,146,0.35); background-color: #a8d5c8; }
              100% { box-shadow: 0 0 0 0px rgba(107,162,146,0); background-color: #d4ede6; }
            }
          `}</style>

          {/* Calendar card */}
          <div className="flex-1 min-h-0 mx-12 mt-14 mb-4 flex flex-col"
            style={{ perspective: "1200px" }}>

            <div
              className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden shadow-xl"
              style={{
                transform: animating
                  ? flipDir === "next"
                    ? "rotateY(-22deg) scale(0.94) translateX(-18px)"
                    : "rotateY(22deg) scale(0.94) translateX(18px)"
                  : "rotateY(0deg) scale(1) translateX(0px)",
                opacity: animating ? 0.3 : 1,
                filter: animating ? "blur(1px)" : "blur(0px)",
                transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease, filter 0.4s ease",
                transformOrigin: flipDir === "next" ? "left center" : "right center",
              }}
            >
              {/* Calendar header */}
              <div className="border-b px-6 py-3.5 flex items-center justify-between flex-shrink-0"
                style={{ background: "#EDE0D0", borderBottomColor: "#DCCAB5" }}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-red-400" : i === 1 ? "bg-yellow-400" : "bg-green-400"}`} />
                    ))}
                  </div>
                  <span className="text-xs pr-3" style={{ color: "#8b6f52", borderRight: "1px solid #c8ad8e" }}>
                    {viewMode === "week" ? "יומן שבועי" : "תצוגה שנתית"}
                  </span>
                </div>
                <div className="text-center">
                  {viewMode === "week" ? (
                    <>
                      <p style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "20px",
                        fontWeight: 700,
                        fontStyle: "italic",
                        letterSpacing: "0.04em",
                        color: "#3d2e1a",
                        lineHeight: 1,
                      }}>{weekLabel}</p>
                      <p className="text-xs mt-1 text-center" style={{ color: "#8b6f52", direction: "ltr" }}>{weekAppts.length} appointments this week</p>
                    </>
                  ) : (
                    <p style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: "22px",
                      fontWeight: 700,
                      fontStyle: "italic",
                      letterSpacing: "0.06em",
                      color: "#3d2e1a",
                    }}>{yearViewYear}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPastWeek && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full border" style={{ color: "#8b6f52", background: "#c8ad8e40", borderColor: "#c8ad8e" }}>
                      שבוע שעבר
                    </span>
                  )}
                  {!isCurrentWeek ? (
                    <button
                      onClick={goToToday}
                      disabled={animating}
                      title="חזור לשבוע הנוכחי"
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all hover:shadow-md active:scale-95 disabled:opacity-40"
                      style={{ color: "#6b4f35", background: "#fff", borderColor: "#c8ad8e" }}
                    >
                      <CalendarDays size={12} style={{ color: "#C9A27E" }} />
                      חזור לשבוע הנוכחי
                    </button>
                  ) : (
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center relative" style={{ background: "#c8ad8e50" }}>
                      <CalendarDays size={14} style={{ color: "#6b4f35" }} />
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Category filter bar — hidden in year view */}
              {viewMode === "week" && (
              <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
                style={{ background: "#f5ede3", borderBottom: "1px solid #e0cfbb" }}>
                <button
                  onClick={() => switchCategory(null)}
                  className="text-[11px] font-semibold px-3 py-1 rounded-full transition-all"
                  style={
                    activeCategory === null
                      ? { background: "#C9A27E", color: "#fff", boxShadow: "0 2px 8px rgba(201,162,126,0.35)" }
                      : { background: "rgba(201,162,126,0.12)", color: "#8b6f52" }
                  }>
                  הכל
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => switchCategory(cat === activeCategory ? null : cat)}
                    className="text-[11px] font-semibold px-3 py-1 rounded-full transition-all"
                    style={
                      activeCategory === cat
                        ? { background: "#C9A27E", color: "#fff", boxShadow: "0 2px 8px rgba(201,162,126,0.35)" }
                        : { background: "rgba(201,162,126,0.12)", color: "#8b6f52" }
                    }>
                    {cat}
                  </button>
                ))}
              </div>
              )}

              {/* ── Year view ─────────────────────────────────── */}
              {viewMode === "year" && (
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "#FAF7F4", animation: "fadeInView 0.25s ease" }}>
                  {/* Year navigation */}
                  <div className="flex items-center justify-center gap-5 py-4">
                    <button onClick={() => setYearViewYear((y) => y + 1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#EADFD5] transition-colors" style={{ color: "#8b6f52" }}>
                      <ChevronRight size={16} />
                    </button>
                    <span className="font-bold text-base" style={{ color: "#3d2e1a", fontFamily: "Georgia, serif", letterSpacing: "0.08em" }}>{yearViewYear}</span>
                    <button onClick={() => setYearViewYear((y) => y - 1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#EADFD5] transition-colors" style={{ color: "#8b6f52" }}>
                      <ChevronLeft size={16} />
                    </button>
                  </div>

                  {/* 4 × 3 month grid — keep months LTR, but each month calendar is RTL */}
                  <div className="grid grid-cols-4 gap-3 px-4 pb-4" dir="ltr">
                    {Array.from({ length: 12 }, (_, monthIdx) => {
                      const cells = buildMonthGrid(yearViewYear, monthIdx);
                      return (
                        <div key={monthIdx} className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #EADFD5", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                          {/* Month name */}
                          <div className="py-2 text-center" style={{ background: "#f5ede3", borderBottom: "1px solid #EADFD5" }}>
                            <span className="text-[11px] font-bold" style={{ fontFamily: "Georgia, serif", color: "#8b5e3c" }}>
                              {MONTH_NAMES_HE[monthIdx]}
                            </span>
                          </div>
                          {/* Day-of-week headers */}
                          <div className="grid grid-cols-7 px-1 pt-1.5" dir="rtl">
                            {MINI_DAY_HEADS.map((h, i) => (
                              <div key={i} className="text-center text-[8px] font-semibold pb-1" style={{ color: i >= 5 ? "#C9A27E" : "#b09070" }}>{h}</div>
                            ))}
                          </div>
                          {/* Day cells */}
                          <div className="grid grid-cols-7 px-1 pb-2" dir="rtl">
                            {cells.map((day, ci) => {
                              if (!day) return <div key={ci} />;
                              const colIdx = ci % 7;
                              const isWeekend = colIdx >= 5;
                              const dateStr = `${yearViewYear}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                              const isToday = dateStr === today;
                              const isPastDay = dateStr < today;
                              const hasAppt = apptDates.has(dateStr);
                              return (
                                <div
                                  key={ci}
                                  onClick={() => handleYearDayClick(yearViewYear, monthIdx, day)}
                                  className="flex flex-col items-center justify-center cursor-pointer rounded-md py-0.5 transition-colors hover:bg-[#F4EFEA]"
                                  style={{ opacity: isPastDay ? 0.4 : 1 }}
                                >
                                  <span
                                    className={`text-[9px] font-medium leading-none ${isToday ? "text-white rounded-full flex items-center justify-center" : ""}`}
                                    style={{
                                      width: isToday ? 16 : undefined,
                                      height: isToday ? 16 : undefined,
                                      background: isToday ? "#6BA292" : undefined,
                                      color: isToday ? "#fff" : isWeekend ? "#C9A27E" : "#3d2e1a",
                                    }}
                                  >
                                    {day}
                                  </span>
                                  {hasAppt && (
                                    <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: "#C9A27E" }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Page area — week view only */}
              {viewMode === "week" && <div className={`flex-1 min-h-0 flex flex-col overflow-hidden bg-white relative ${isPastWeek ? "opacity-75" : ""}`} style={{ animation: "fadeInView 0.25s ease" }}>

                {isPastWeek && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    {pastLabelVisible && (
                      <span
                        onClick={() => setPastLabelVisible(false)}
                        className="pointer-events-auto cursor-pointer bg-white/90 backdrop-blur-sm text-gray-500 text-xs font-medium px-4 py-2 rounded-full shadow-lg hover:bg-white transition-all border border-gray-200"
                      >
                        צפייה בלבד
                      </span>
                    )}
                  </div>
                )}

                {/* Scrollable body — headers are sticky inside so they always match column widths */}
                <div ref={calendarScrollRef} className="overflow-y-auto flex-1" onMouseLeave={handleDragEnd}>
                  <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>

                    {/* Sticky day headers row */}
                    <div className="contents sticky top-0 z-30">
                      <div style={{ background: "#eddfc9", borderBottom: "2px solid #c8ad8e", borderRight: "1px solid #c8ad8e", position: "sticky", top: 0, zIndex: 30 }} />
                      {weekDays.map((day, i) => {
                        const iso = toISO(day);
                        const isToday = iso === today;
                        return (
                          <div key={i}
                            className={`text-center py-3 ${iso < today && !isCurrentWeek ? "blur-[1.5px]" : ""}`}
                            style={{ background: "#eddfc9", borderBottom: "2px solid #c8ad8e", borderRight: "1px solid #c8ad8e", position: "sticky", top: 0, zIndex: 30, animation: iso === highlightedDateCol ? "columnHeaderHighlight 1.8s ease forwards" : undefined }}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider"
                              style={{ color: isToday ? "#6BA292" : "#7A7A7A" }}>
                              {DAY_NAMES[day.getDay()]}
                            </p>
                            <p className={`text-sm font-bold mt-0.5 ${isToday
                              ? "text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto shadow-sm"
                              : ""}`}
                              style={isToday ? { background: "#6BA292" } : { color: "#2C2C2C" }}>
                              {day.getDate()}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time gutter */}
                    <div style={{ borderRight: "1px solid #e0d0bc" }}>
                      {HOURS.map((hour) => (
                        <div key={hour}
                          className="flex items-start justify-center pt-1.5"
                          style={{ height: `${ROW_HEIGHT}px`, borderBottom: "1px solid #e0d0bc" }}>
                          <span className="text-[10px] font-medium" style={{ color: "#b09070" }}>
                            {`${String(hour).padStart(2, "0")}:00`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Day columns */}
                    {weekDays.map((day, di) => {
                      const iso = toISO(day);
                      const isPastDay = iso < today;
                      const dayAppts = weekAppts.filter((a) => a.date === iso);
                      const layout = computeOverlapLayout(dayAppts);
                      const totalHeight = HOURS.length * ROW_HEIGHT;

                      return (
                        <div key={di}
                          className="relative"
                          style={{ height: `${totalHeight}px`, borderRight: "1px solid #e0d0bc", animation: iso === highlightedDateCol ? "columnHighlight 1.8s ease forwards" : undefined }}>

                          {/* Hour cell interaction areas */}
                          {HOURS.map((hour) => {
                            const dragMin = drag ? Math.min(drag.startHour, drag.endHour) : null;
                            const dragMax = drag ? Math.max(drag.startHour, drag.endHour) : null;
                            const isDragCell = drag && drag.date === iso && hour >= dragMin && hour <= dragMax;
                            const isRescheduleTarget = reschedule && reschedule.targetDate === iso && reschedule.targetHour === hour;
                            const isPastSlot = !isFutureSlot(iso, hour);
                            return (
                              <div key={hour}
                                onClick={() => handleCellClick(iso, hour)}
                                onMouseDown={(e) => { e.preventDefault(); handleDragStart(iso, hour); }}
                                onMouseEnter={() => { handleDragEnter(iso, hour); handleRescheduleEnter(iso, hour); }}
                                onMouseUp={handleDragEnd}
                                className={`absolute w-full select-none transition-colors
                                  ${isPastSlot ? (isPastDay && !isCurrentWeek ? "blur-[1.5px] cursor-not-allowed" : "cursor-not-allowed") : "cursor-pointer"}
                                  ${!isPastSlot && isDragCell ? "bg-yellow-50" : ""}
                                  ${!isPastSlot && isRescheduleTarget ? "bg-[#F4EFEA]" : ""}
                                  ${!isPastSlot && !isDragCell && !isRescheduleTarget ? "hover:bg-yellow-50/70" : ""}`}
                                style={{
                                  top: `${(hour - FIRST_HOUR) * ROW_HEIGHT}px`,
                                  height: `${ROW_HEIGHT}px`,
                                  borderBottom: "1px solid #e0d0bc",
                                }}
                              />
                            );
                          })}

                          {/* Appointments overlay — pointer-events:none so empty-cell clicks reach the hour cells below */}
                          <div style={{ opacity: categoryFading ? 0 : 1, transition: "opacity 0.2s ease", position: "absolute", inset: 0, pointerEvents: "none" }}>
                          {dayAppts.map((a) => {
                            const pos = layout.get(a.id);
                            if (!pos) return null;
                            const isHovered = hoveredApptId === a.id;
                            const isBeingDragged = reschedule?.appt.id === a.id;
                            const isJustRescheduled = justRescheduledId === a.id;
                            const isApptFuture = new Date(`${a.date}T${a.time}`) > new Date();
                            const GAP = 2;
                            const containerW = 100;
                            const leftPct = pos.left * containerW + GAP;
                            const widthPct = pos.width * containerW - GAP * 2;
                            return (
                              <div key={a.id}
                                onClick={(e) => {
                                  if (reschedule) return;
                                  e.stopPropagation();
                                  setSelectedAppt(a);
                                }}
                                onMouseDown={(e) => { if (isApptFuture) handleRescheduleStart(a, e); }}
                                onMouseEnter={() => setHoveredApptId(a.id)}
                                onMouseLeave={() => setHoveredApptId(null)}
                                className={`absolute text-[10px] px-1.5 pt-1 leading-tight rounded-lg border z-10 overflow-hidden transition-all duration-150
                                  ${isApptFuture && !isBeingDragged ? "cursor-grab" : "cursor-pointer"}
                                  ${isBeingDragged ? "opacity-25" : "opacity-100"}
                                  ${!isBeingDragged && isHovered ? "shadow-md" : "shadow-sm"}
                                  ${isPastDay ? "blur-[1.5px] opacity-70" : ""}`}
                                style={{
                                  top: `${pos.top + 2}px`,
                                  height: `${pos.height - 4}px`,
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  pointerEvents: "auto",
                                  backgroundColor: !isBeingDragged && isHovered ? "#bfddd6" : "#d4ede6",
                                  borderColor: !isBeingDragged && isHovered ? "rgba(107,162,146,0.6)" : "rgba(107,162,146,0.35)",
                                  animation: isJustRescheduled
                                    ? "rescheduleGlow 2s ease forwards"
                                    : a.id === newlyBookedId
                                    ? "newBookingPulse 2.5s ease forwards"
                                    : undefined,
                                }}>
                                <div className="font-bold truncate text-[#2d5a4f]">{a.client_name}</div>
                                {pos.height > 30 && (
                                  <div className="truncate text-[#5a9a8a] text-[9px]">{a.treatment_name}</div>
                                )}
                                {pos.height > 44 && (
                                  <div className="text-[9px] text-[#6BA292]">{a.time}{a.end_time ? `–${a.end_time}` : ""}</div>
                                )}
                              </div>
                            );
                          })}

                          {/* Reschedule ghost — shown in the target day column */}
                          {reschedule && reschedule.targetDate === iso && (() => {
                            const ghostTop = (reschedule.targetHour - FIRST_HOUR) * ROW_HEIGHT;
                            const ghostHeight = Math.min(
                              (reschedule.durationMin / 60) * ROW_HEIGHT,
                              totalHeight - ghostTop
                            );
                            return (
                              <div
                                className="absolute z-20 rounded-lg border-2 border-dashed pointer-events-none overflow-hidden"
                                style={{
                                  top: `${ghostTop + 2}px`,
                                  height: `${Math.max(ghostHeight - 4, 18)}px`,
                                  left: "4%",
                                  right: "4%",
                                  background: "rgba(201,162,126,0.18)",
                                  borderColor: "#C9A27E",
                                }}
                              >
                                <div className="text-[10px] px-1.5 pt-1 font-bold truncate" style={{ color: "#7a4f2a" }}>
                                  {reschedule.appt.client_name}
                                </div>
                                {ghostHeight > 30 && (
                                  <div className="text-[9px] px-1.5 truncate" style={{ color: "#C9A27E" }}>
                                    {reschedule.appt.treatment_name}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>}

            </div>

          {/* ── Floating view-toggle button ───────────────────── */}
          <button
            onClick={() => {
              if (viewMode === "week") { setYearViewYear(weekStart.getFullYear()); setViewMode("year"); }
              else setViewMode("week");
            }}
            title={viewMode === "week" ? "תצוגה שנתית" : "חזרה לשבועי"}
            className="absolute bottom-6 right-6 z-40 flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-2xl transition-all duration-200 hover:shadow-lg active:scale-95"
            style={{
              color: "#6b4f35",
              background: "rgba(255,252,248,0.85)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(200,173,142,0.5)",
              boxShadow: "0 4px 20px rgba(139,111,82,0.15), 0 1px 4px rgba(139,111,82,0.1)",
            }}
          >
            {viewMode === "week"
              ? <><LayoutGrid size={14} style={{ color: "#C9A27E" }} /><span>zoom out</span></>
              : <><CalendarDays size={14} style={{ color: "#C9A27E" }} /><span>zoom in</span></>
            }
          </button>

          </div>
        </div>
      </div>
    </div>
  );
}
