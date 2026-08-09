import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { fetchEmployeeShifts, saveWeeklyEmployeeShifts } from "../api/medayApi";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTH_NAMES = ["בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekRange(weekStart) {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) {
    return `שבוע ${weekStart.getDate()}-${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `שבוע ${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} - ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function sortBlocks(blocks) {
  return [...blocks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
}

function validateShiftBlocks(blocksByEmployeeDate) {
  for (const blocks of Object.values(blocksByEmployeeDate)) {
    const sorted = sortBlocks(blocks);
    const seen = new Set();
    for (const block of sorted) {
      if (!block.start_time || !block.end_time) return "יש למלא שעת התחלה ושעת סיום לכל חלון עבודה";
      if (timeToMinutes(block.end_time) <= timeToMinutes(block.start_time)) {
        return "שעת הסיום חייבת להיות אחרי שעת ההתחלה";
      }
      const duplicateKey = `${block.start_time}-${block.end_time}`;
      if (seen.has(duplicateKey)) return "קיימת כפילות בחלונות העבודה";
      seen.add(duplicateKey);
    }
    for (let index = 1; index < sorted.length; index += 1) {
      if (timeToMinutes(sorted[index].start_time) < timeToMinutes(sorted[index - 1].end_time)) {
        return "זמני המשמרות חופפים. יש לעדכן את שעות העבודה";
      }
    }
  }
  return "";
}

function blockMapKey(employeeId, date) {
  return `${employeeId}__${date}`;
}

function normalizeBlocks(employees, weekDates, blocks) {
  const next = {};
  employees.forEach((employee) => {
    weekDates.forEach((date) => {
      next[blockMapKey(employee.id, date)] = [];
    });
  });
  (blocks || []).forEach((block) => {
    const key = blockMapKey(block.employee_id, block.shift_date);
    if (!next[key]) next[key] = [];
    next[key].push({
      employee_id: block.employee_id,
      shift_date: block.shift_date,
      start_time: block.start_time,
      end_time: block.end_time,
    });
  });
  Object.keys(next).forEach((key) => {
    next[key] = sortBlocks(next[key]);
  });
  return next;
}

function normalizeEmployee(employee) {
  const fullName = (employee.full_name || employee.fullName || employee.name || "").trim();
  return {
    ...employee,
    id: employee.id,
    full_name: fullName,
    name: fullName,
    is_active: employee.is_active ?? employee.active ?? true,
    specialties: Array.isArray(employee.specialties)
      ? employee.specialties.filter(Boolean)
      : employee.specialty
      ? [employee.specialty]
      : [],
  };
}

export default function AdminEmployeeShifts() {
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [shiftBlocks, setShiftBlocks] = useState({});
  const [hasSavedShifts, setHasSavedShifts] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState([]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => toISO(addDays(selectedWeekStart, index))),
    [selectedWeekStart]
  );
  const weekStartISO = toISO(selectedWeekStart);
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || employees[0] || null;
  const visibleEmployees = employees.filter((employee) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      employee.full_name.toLowerCase().includes(query) ||
      (employee.specialties || []).some((specialty) => specialty.toLowerCase().includes(query))
    );
  });

  const flatBlocks = useMemo(() => (
    Object.values(shiftBlocks)
      .flat()
      .filter((block) => block.employee_id && block.shift_date && block.start_time && block.end_time)
      .map((block) => ({
        employee_id: block.employee_id,
        shift_date: block.shift_date,
        start_time: block.start_time,
        end_time: block.end_time,
      }))
  ), [shiftBlocks]);

  const summary = useMemo(() => {
    const activeEmployeeIds = new Set(flatBlocks.map((block) => block.employee_id));
    const staffedDays = new Set(flatBlocks.map((block) => block.shift_date));
    return {
      activeEmployees: activeEmployeeIds.size,
      blockCount: flatBlocks.length,
      daysWithoutStaff: weekDates.filter((date) => !staffedDays.has(date)).length,
    };
  }, [flatBlocks, weekDates]);

  async function loadWeeklyShifts(weekStartDate = selectedWeekStart) {
    setLoading(true);
    setError("");
    setMessage("");
    setConflicts([]);
    try {
      const result = await fetchEmployeeShifts(toISO(weekStartDate));
      const normalizedEmployees = (result.employees || []).map(normalizeEmployee);
      const invalidEmployees = normalizedEmployees.filter((employee) => !employee.full_name);
      if (invalidEmployees.length > 0) {
        console.warn("Invalid employee records without a display name:", invalidEmployees);
      }
      const loadedEmployees = normalizedEmployees.filter((employee) => employee.full_name);
      const dates = Array.from({ length: 7 }, (_, index) => toISO(addDays(weekStartDate, index)));
      setEmployees(loadedEmployees);
      setSelectedEmployeeId((current) => (
        loadedEmployees.some((employee) => employee.id === current) ? current : loadedEmployees[0]?.id || null
      ));
      setShiftBlocks(normalizeBlocks(loadedEmployees, dates, result.shift_blocks || result.shifts || []));
      setHasSavedShifts(!!result.has_shifts);
      setDirty(false);
    } catch (err) {
      setError(err.message || "לא ניתן לטעון משמרות");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeeklyShifts(selectedWeekStart);
  }, [selectedWeekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  function replaceDayBlocks(employeeId, date, nextBlocks) {
    setShiftBlocks((current) => ({
      ...current,
      [blockMapKey(employeeId, date)]: sortBlocks(nextBlocks),
    }));
    setDirty(true);
    setMessage("");
    setError("");
    setConflicts([]);
  }

  function addShiftBlock(date) {
    if (!selectedEmployee) return;
    const key = blockMapKey(selectedEmployee.id, date);
    const existing = shiftBlocks[key] || [];
    replaceDayBlocks(selectedEmployee.id, date, [
      ...existing,
      { employee_id: selectedEmployee.id, shift_date: date, start_time: "09:00", end_time: "16:00" },
    ]);
  }

  function updateShiftBlock(date, index, field, value) {
    if (!selectedEmployee) return;
    const key = blockMapKey(selectedEmployee.id, date);
    const next = [...(shiftBlocks[key] || [])];
    next[index] = { ...next[index], [field]: value };
    replaceDayBlocks(selectedEmployee.id, date, next);
  }

  function removeShiftBlock(date, index) {
    if (!selectedEmployee) return;
    const key = blockMapKey(selectedEmployee.id, date);
    const next = [...(shiftBlocks[key] || [])];
    next.splice(index, 1);
    replaceDayBlocks(selectedEmployee.id, date, next);
  }

  async function copyPreviousWeek() {
    setLoading(true);
    setError("");
    setMessage("");
    setConflicts([]);
    try {
      const previousStart = addDays(selectedWeekStart, -7);
      const result = await fetchEmployeeShifts(toISO(previousStart));
      if (!result.has_shifts) {
        setError("לא נמצאו משמרות בשבוע הקודם");
        return;
      }
      const copied = normalizeBlocks(employees, weekDates, []);
      (result.shift_blocks || result.shifts || []).forEach((block) => {
        const previousIndex = Math.floor((new Date(`${block.shift_date}T00:00:00`) - previousStart) / 86400000);
        const targetDate = weekDates[previousIndex];
        if (!targetDate) return;
        const key = blockMapKey(block.employee_id, targetDate);
        if (!copied[key]) copied[key] = [];
        copied[key].push({
          employee_id: block.employee_id,
          shift_date: targetDate,
          start_time: block.start_time,
          end_time: block.end_time,
        });
      });
      Object.keys(copied).forEach((key) => {
        copied[key] = sortBlocks(copied[key]);
      });
      setShiftBlocks(copied);
      setDirty(true);
      setHasSavedShifts(true);
      setMessage("המשמרות מהשבוע הקודם הועתקו. יש לשמור כדי לעדכן את השבוע הנוכחי.");
    } catch (err) {
      setError(err.message || "לא ניתן להעתיק משמרות מהשבוע הקודם");
    } finally {
      setLoading(false);
    }
  }

  async function saveWeeklyShifts(forceConflicts = false) {
    const validationError = validateShiftBlocks(shiftBlocks);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    setConflicts([]);
    try {
      const result = await saveWeeklyEmployeeShifts({ weekStart: weekStartISO, shiftBlocks: flatBlocks, forceConflicts });
      setShiftBlocks(normalizeBlocks(employees, weekDates, result.shift_blocks || []));
      setHasSavedShifts(true);
      setDirty(false);
      setMessage(result.message || "המשמרות נשמרו בהצלחה");
    } catch (err) {
      if (err.status === 409 && err.conflicts?.length) {
        setConflicts(err.conflicts);
        setError(err.message || "קיימים תורים מחוץ לחלונות העבודה החדשים");
      } else {
        setError(err.message || "שמירת המשמרות נכשלה");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7EFE7] text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 bg-[#201007] p-5 text-[#E8C4A0] lg:block">
          <div className="mb-8">
            <p className="text-xs font-bold text-[#C4795A]">MeDay Beauty Center</p>
            <h1 className="mt-2 text-2xl font-black text-white">אזור ניהול</h1>
          </div>
          <nav className="space-y-2">
            <Link to="/admin" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[#E8C4A0]/70 transition hover:bg-white/5 hover:text-[#E8C4A0]">
              <ArrowRight size={17} />
              חזרה לדשבורד
            </Link>
            <Link to="/admin/employees" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[#E8C4A0]/70 transition hover:bg-white/5 hover:text-[#E8C4A0]">
              <Users size={17} />
              ניהול עובדים
            </Link>
            <div className="flex items-center gap-3 rounded-2xl bg-[#C4795A]/20 px-4 py-3 text-sm font-bold text-[#E8C4A0]">
              <CalendarDays size={17} />
              ניהול משמרות עובדים
            </div>
          </nav>
        </aside>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-5">
            <header className="rounded-[2rem] bg-gradient-to-l from-[#1D0D05] via-[#6F3B24] to-[#C4795A] p-6 text-white shadow-2xl shadow-[#9B5C38]/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-[#E8C4A0]">
                    <CalendarDays size={14} />
                    תכנון שבועי
                  </div>
                  <h2 className="text-3xl font-black">ניהול משמרות עובדים</h2>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    בחירת עובד, עריכת חלונות עבודה נפרדים ושמירה שבועית מסודרת.
                  </p>
                </div>
                <Link to="/admin" className="inline-flex w-fit items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold text-[#8B5030] shadow-lg">
                  <ArrowRight size={16} />
                  חזרה לאזור הניהול
                </Link>
              </div>
            </header>

            <section className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-xl shadow-[#9B5C38]/5 backdrop-blur">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))} className="inline-flex items-center gap-2 rounded-full bg-[#F4EFEA] px-4 py-2 text-sm font-bold text-[#7A4A2F]">
                    <ChevronRight size={16} />
                    שבוע קודם
                  </button>
                  <button type="button" onClick={() => setSelectedWeekStart(getWeekStart(new Date()))} className="inline-flex items-center gap-2 rounded-full bg-[#C4795A] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#C4795A]/25">
                    השבוע הנוכחי
                  </button>
                  <button type="button" onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))} className="inline-flex items-center gap-2 rounded-full bg-[#F4EFEA] px-4 py-2 text-sm font-bold text-[#7A4A2F]">
                    שבוע הבא
                    <ChevronLeft size={16} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400">השבוע הנבחר</p>
                  <p className="text-xl font-black text-[#5F432B]">{formatWeekRange(selectedWeekStart)}</p>
                </div>
                <button type="button" onClick={copyPreviousWeek} disabled={loading || saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2E7A87] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#2E7A87]/20 disabled:cursor-not-allowed disabled:opacity-50">
                  <Copy size={16} />
                  העתקת משמרות מהשבוע הקודם
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-white/80 p-4 shadow-md">
                <p className="text-xs font-bold text-gray-400">מספר העובדים הפעילים השבוע</p>
                <p className="mt-1 text-2xl font-black text-[#C4795A]">{summary.activeEmployees}</p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-md">
                <p className="text-xs font-bold text-gray-400">מספר חלונות העבודה</p>
                <p className="mt-1 text-2xl font-black text-[#2E7A87]">{summary.blockCount}</p>
              </div>
              <div className="rounded-3xl bg-white/80 p-4 shadow-md">
                <p className="text-xs font-bold text-gray-400">מספר ימים ללא צוות</p>
                <p className="mt-1 text-2xl font-black text-[#8B5030]">{summary.daysWithoutStaff}</p>
              </div>
            </section>

            {!loading && !hasSavedShifts && !dirty ? (
              <div className="rounded-3xl border border-[#E8C4A0]/60 bg-[#FFF8F2] p-5 text-right text-sm font-bold text-[#8B5030]">
                לא הוגדרו משמרות לשבוע זה. ניתן ליצור משמרות ידנית או להעתיק את המשמרות מהשבוע הקודם.
              </div>
            ) : null}

            {message ? (
              <div className="flex items-center gap-2 rounded-3xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
                <CheckCircle2 size={18} />
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} />
                  {error}
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-3xl bg-white/80 p-8 text-center text-sm font-bold text-[#8B5030] shadow-xl">טוען משמרות...</div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
                <section className="rounded-3xl border border-white/70 bg-white/82 p-4 shadow-xl shadow-[#9B5C38]/5">
                  <div className="mb-4 flex items-center gap-2 text-[#5F432B]">
                    <Users size={18} />
                    <h3 className="text-base font-black">עובדים פעילים</h3>
                  </div>
                  <label className="mb-3 flex items-center gap-2 rounded-2xl bg-[#FAF6F1] px-3 py-2 text-sm text-[#6B4F35]">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="חיפוש לפי שם או תחום טיפול"
                      className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-[#9A8A7A]"
                    />
                  </label>
                  <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                    {visibleEmployees.map((employee) => {
                      const isActive = selectedEmployee?.id === employee.id;
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className="flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3 text-right transition"
                          style={isActive ? { background: "#C4795A", color: "white" } : { background: "#FAF6F1", color: "#6B4F35" }}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-black">{employee.full_name}</span>
                            <span className={`mt-1 block text-xs leading-5 ${isActive ? "text-white/75" : "text-[#8B6F52]"}`}>
                              {(employee.specialties || []).join(" · ")}
                            </span>
                          </span>
                          <UserRound size={16} className="mt-0.5 shrink-0" />
                        </button>
                      );
                    })}
                    {visibleEmployees.length === 0 ? (
                      <p className="rounded-2xl bg-[#FAF6F1] p-4 text-center text-sm font-bold text-[#8B5030]">לא נמצאו עובדים</p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-white/70 bg-white/82 p-5 shadow-xl shadow-[#9B5C38]/5">
                  <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#C4795A]">משמרות השבוע</p>
                      <h3 className="text-2xl font-black text-[#3D2418]">{selectedEmployee?.full_name || "בחר/י עובד/ת"}</h3>
                      <p className="mt-1 text-xs font-bold text-[#8B6F52]">{(selectedEmployee?.specialties || []).join(" · ")}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {selectedEmployee ? weekDates.map((date, index) => {
                      const dayBlocks = shiftBlocks[blockMapKey(selectedEmployee.id, date)] || [];
                      return (
                        <article key={date} className="rounded-2xl border border-[#E8C4A0]/55 bg-[#FFFDFC] p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-black text-[#3D2418]">{DAY_NAMES[index]}</p>
                              <p className="text-xs font-bold text-gray-400">{formatDate(date)}</p>
                            </div>
                            <span className="rounded-full bg-[#F4EFEA] px-3 py-1 text-xs font-bold text-[#8B5030]">
                              {dayBlocks.length ? `${dayBlocks.length} חלונות` : "לא עובד/ת"}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {dayBlocks.map((block, blockIndex) => (
                              <div key={`${date}-${blockIndex}`} className="rounded-2xl bg-[#FAF6F1] p-3">
                                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                                  <label className="text-xs font-bold text-gray-500">
                                    התחלה
                                    <input
                                      type="time"
                                      value={block.start_time}
                                      onChange={(event) => updateShiftBlock(date, blockIndex, "start_time", event.target.value)}
                                      className="mt-1 w-full rounded-xl border border-[#E8C4A0] bg-white px-2 py-2 text-sm font-bold"
                                    />
                                  </label>
                                  <label className="text-xs font-bold text-gray-500">
                                    סיום
                                    <input
                                      type="time"
                                      value={block.end_time}
                                      onChange={(event) => updateShiftBlock(date, blockIndex, "end_time", event.target.value)}
                                      className="mt-1 w-full rounded-xl border border-[#E8C4A0] bg-white px-2 py-2 text-sm font-bold"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => removeShiftBlock(date, blockIndex)}
                                    title="מחיקה"
                                    className="mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {dayBlocks.length === 0 ? (
                              <p className="rounded-xl bg-[#F4EFEA] px-3 py-3 text-center text-xs font-bold text-[#8B5030]">לא עובד/ת</p>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => addShiftBlock(date)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#C4795A]/25 bg-white px-4 py-2 text-xs font-black text-[#8B5030] transition hover:bg-[#FFF8F2]"
                          >
                            <Plus size={14} />
                            הוספת חלון עבודה
                          </button>
                        </article>
                      );
                    }) : null}
                  </div>

                  {conflicts.length > 0 ? (
                    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-900">
                        <AlertTriangle size={18} />
                        קיימים תורים מחוץ לחלונות העבודה החדשים
                      </div>
                      <ul className="space-y-1 text-sm font-bold text-amber-900">
                        {conflicts.map((conflict, index) => (
                          <li key={`${conflict.employee_name}-${conflict.date}-${conflict.start_time}-${index}`}>
                            • {conflict.employee_name} - {formatDate(conflict.date)} - {conflict.start_time}-{conflict.end_time}
                            {conflict.treatment_name ? ` - ${conflict.treatment_name}` : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setConflicts([])} className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#8B5030]">ביטול</button>
                        <button type="button" onClick={() => saveWeeklyShifts(true)} disabled={saving} className="rounded-full bg-[#C4795A] px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                          שמירה בכל זאת
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col gap-3 border-t border-[#E8C4A0]/45 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-bold text-gray-400">{dirty ? "יש שינויים שלא נשמרו" : "כל השינויים שמורים"}</p>
                    <button
                      type="button"
                      onClick={() => saveWeeklyShifts(false)}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#C4795A]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={16} />
                      {saving ? "שומר..." : "שמירת משמרות"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
