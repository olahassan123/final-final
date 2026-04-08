import { useState, useEffect } from "react";
import { fetchTreatments, fetchAppointments, createAppointment, deleteAppointment } from "../api/medayApi";
import {
  ChevronLeft, ChevronRight, Trash2, Plus, Sparkles, User, Phone, CalendarDays, Clock, X,
} from "lucide-react";

// ── Calendar helpers ──────────────────────────────────────────
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8..22
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

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

function apptHour(time) {
  return parseInt((time || "00:00").split(":")[0], 10);
}

function apptSpansHour(appt, hour) {
  const start = apptHour(appt.time);
  const end = apptHour(appt.end_time || appt.time);
  return hour > start && hour < end;
}

function apptStartsAt(appt, hour) {
  return apptHour(appt.time) === hour;
}

function apptEndsAt(appt, hour) {
  return apptHour(appt.end_time || appt.time) === hour;
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

  useEffect(() => {
    fetchTreatments().then(setTreatments).catch(console.error);
    load();
  }, []);

  useEffect(() => { setPastLabelVisible(true); }, [weekStart]);

  function load() {
    fetchAppointments().then(setAppointments).catch(console.error);
  }

  const grouped = treatments.reduce((acc, t) => {
    const cat = t.class_name || "כללי";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  function handleTreatmentChange(e) {
    const t = treatments.find((x) => x.id === e.target.value);
    setForm((f) => ({ ...f, treatment_id: t?.id || "", treatment_name: t?.name || "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.client_name || !form.treatment_id || !form.date || !form.time) return;
    if (form.end_time && form.end_time <= form.time) {
      alert("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    setSaving(true);
    try {
      await createAppointment(form);
      setForm({ client_name: "", client_phone: "", treatment_id: "", treatment_name: "", date: "", time: "", end_time: "", notes: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      load();
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

  function handleCellClick(date, hour) {
    if (isDragging) return;
    if (date < today) return;
    const h = String(hour).padStart(2, "0");
    const endH = String(hour + 1).padStart(2, "0");
    setForm((f) => ({ ...f, date, time: `${h}:00`, end_time: `${endH}:00` }));
  }

  function handleDragStart(date, hour) {
    if (date < today) return;
    setDrag({ date, startHour: hour, endHour: hour });
  }

  function handleDragEnter(date, hour) {
    if (!drag || drag.date !== date) return;
    setDrag((d) => ({ ...d, endHour: hour }));
  }

  function handleDragEnd() {
    if (!drag) return;
    const start = Math.min(drag.startHour, drag.endHour);
    const end = Math.max(drag.startHour, drag.endHour) + 1;
    const h = String(start).padStart(2, "0");
    const endH = String(end).padStart(2, "0");
    setForm((f) => ({ ...f, date: drag.date, time: `${h}:00`, end_time: `${endH}:00` }));
    setFormOpen(true);
    setDrag(null);
    setFlashFields(true);
    setTimeout(() => setFlashFields(false), 1800);
  }

  const today = toISO(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${displayDate(weekStart)} – ${displayDate(addDays(weekStart, 6))}`;
  const weekDayStrings = weekDays.map(toISO);
  const weekAppts = appointments.filter((a) => weekDayStrings.includes(a.date));
  const isPastWeek = toISO(addDays(weekStart, 6)) < today;

  const inputCls = "w-full pr-8 pl-2 py-2.5 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 transition-all placeholder-gray-300 shadow-sm"
    + " border focus:ring-[#C9A27E]/40 focus:border-[#C9A27E]"
    + " " + "border-[#EADFD5] text-[#2C2C2C]";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-widest mb-1.5" + " text-[#7A7A7A]";

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: "#F9F7F4" }}>
      <AppointmentModal
        appt={selectedAppt}
        onClose={() => setSelectedAppt(null)}
        onDelete={handleDelete}
      />

      {/* Header */}
      <div className="px-8 py-4 flex items-center justify-between relative overflow-hidden"
        style={{ background: "#C9A27E", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>

        {/* Animated radiant glow from logo side */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[70%] h-[200%]"
            style={{
              background: "radial-gradient(ellipse at right center, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 40%, transparent 75%)",
              animation: "radiateGlow 3.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Logo — faded */}
        <img src="/logo.png" alt="logo" className="h-16 w-auto opacity-40 relative z-10" />

        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border relative z-10"
          style={{ color: "#FFFFFF", background: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.4)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          מחובר
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">

        {/* ── Left panel ─────────────────────────────────────── */}
        <div className="w-72 min-w-[272px] border-l border-gray-100 overflow-y-auto flex flex-col shadow-sm relative"
          style={{
            backgroundImage: "url('/salon-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}>
          {/* Faded white overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.82)" }} />

          {/* Toggle button */}
          <div className="p-4 border-b border-gray-50 relative z-10">
            <button
              type="button"
              onClick={() => setFormOpen((o) => !o)}
              className="w-full rounded-2xl transition-all duration-200 group overflow-hidden"
              style={{
                background: "#C9A27E",
                border: "none",
                borderRadius: "12px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300
                    ${formOpen ? "rotate-45" : "bg-white group-hover:scale-110"}`}
                    style={{ background: "rgba(255,255,255,0.25)", boxShadow: "none" }}>
                    <Plus size={18} className={formOpen ? "rotate-45 transition-transform duration-300" : "transition-transform duration-300"} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm leading-tight text-white">קביעת תור חדש</p>
                    <p className="text-[10px] mt-0.5 text-white/70">{formOpen ? "לחצי לסגירה" : "לחצי לפתיחה"}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${formOpen ? "rotate-180" : ""}`}
                  style={{ background: "rgba(255,255,255,0.2)" }}>
                  <ChevronLeft size={13} className="text-white -rotate-90" />
                </div>
              </div>
              <div className="h-px bg-gradient-to-l from-transparent via-white/30 to-transparent" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}
            className={`p-5 space-y-4 overflow-y-auto transition-all duration-300 relative z-10 ${formOpen ? "flex-1 opacity-100" : "max-h-0 opacity-0 p-0 pointer-events-none overflow-hidden"}`}>

            <div>
              <label className={labelCls}>שם הלקוחה</label>
              <div className="relative">
                <User size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input type="text" required value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  placeholder="שם מלא" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>טלפון</label>
              <div className="relative">
                <Phone size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input type="tel" value={form.client_phone}
                  onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                  placeholder="050-0000000" className={inputCls} />
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            <div>
              <label className={labelCls}>טיפול</label>
              <select required value={form.treatment_id} onChange={handleTreatmentChange}
                className="w-full px-3 py-2.5 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 transition-all shadow-sm text-[#2C2C2C] border border-[#EADFD5] focus:ring-[#C9A27E]/40 focus:border-[#C9A27E]">
                <option value="">בחרי טיפול...</option>
                {Object.entries(grouped).map(([cat, items]) => (
                  <optgroup key={cat} label={cat}>
                    {items.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className={`rounded-xl transition-all duration-500 ${flashFields ? "ring-2 ring-[#C9A27E]/50 bg-[#F4EFEA] p-2 -m-2" : ""}`}>
              <label className={labelCls}>תאריך</label>
              <div className="relative">
                <CalendarDays size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input type="date" required min={today} value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className={inputCls} />
              </div>
            </div>

            <div className={`rounded-xl transition-all duration-500 ${flashFields ? "ring-2 ring-[#C9A27E]/50 bg-[#F4EFEA] p-2 -m-2" : ""}`}>
              <label className={labelCls}>שעות</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Clock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input type="time" required value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className={inputCls} />
                </div>
                <div className="relative">
                  <Clock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input type="time" required value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-1">
                <span>התחלה</span>
                <span>סיום</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>הערות</label>
              <textarea rows={2} value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="הערות נוספות..."
                className="w-full px-3 py-2.5 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none shadow-sm text-[#2C2C2C] border border-[#EADFD5] focus:ring-[#C9A27E]/40 focus:border-[#C9A27E] placeholder-[#B5B5B5]" />
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
        <div className="flex-1 flex items-stretch relative overflow-hidden" style={{ background: "#F9F7F4" }}>

          {/* Left arrow — next week */}
          <button
            onClick={() => navigateWeek("next")}
            disabled={animating}
            className="absolute left-0 top-0 bottom-0 w-12 z-30 flex items-center justify-center group disabled:opacity-40"
          >
            <div className="w-8 h-24 bg-white hover:bg-[#F4EFEA] border rounded-r-2xl shadow-md flex items-center justify-center transition-all duration-200 group-hover:shadow-lg group-hover:w-10" style={{ borderColor: "#EADFD5" }}>
              <ChevronLeft size={20} className="text-[#B5B5B5] group-hover:text-[#C9A27E] transition-colors" />
            </div>
          </button>

          {/* Right arrow — previous week */}
          <button
            onClick={() => navigateWeek("prev")}
            disabled={animating}
            className="absolute right-0 top-0 bottom-0 w-12 z-30 flex items-center justify-center group disabled:opacity-40"
          >
            <div className="w-8 h-24 bg-white hover:bg-[#F4EFEA] border rounded-l-2xl shadow-md flex items-center justify-center transition-all duration-200 group-hover:shadow-lg group-hover:w-10" style={{ borderColor: "#EADFD5" }}>
              <ChevronRight size={20} className="text-[#B5B5B5] group-hover:text-[#C9A27E] transition-colors" />
            </div>
          </button>

          {/* Title above calendar */}
          <div className="absolute top-4 inset-x-12 z-20 flex justify-center pointer-events-none">
            <h1
              style={{
                fontFamily: "Georgia, serif",
                background: "linear-gradient(135deg, #c8a06a, #8b5e3c, #c8a06a)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmer 3s linear infinite",
                letterSpacing: "0.12em",
                textShadow: "none",
              }}
              className="text-2xl font-bold tracking-widest select-none"
            >
              ניהול תורים
            </h1>
          </div>

          <style>{`
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
                style={{ background: "#d9c4aa", borderBottomColor: "#c8ad8e" }}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-red-400" : i === 1 ? "bg-yellow-400" : "bg-green-400"}`} />
                    ))}
                  </div>
                  <span className="text-xs pr-3" style={{ color: "#8b6f52", borderRight: "1px solid #c8ad8e" }}>יומן שבועי</span>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm" style={{ color: "#3d2e1a" }}>{weekLabel}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8b6f52" }}>{weekAppts.length} תורים השבוע</p>
                </div>
                <div className="flex items-center gap-2">
                  {isPastWeek && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full border" style={{ color: "#8b6f52", background: "#c8ad8e40", borderColor: "#c8ad8e" }}>
                      שבוע שעבר
                    </span>
                  )}
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "#c8ad8e50" }}>
                    <CalendarDays size={14} style={{ color: "#6b4f35" }} />
                  </div>
                </div>
              </div>

              {/* Page area */}
              <div className={`flex-1 min-h-0 flex flex-col overflow-hidden bg-white relative ${isPastWeek ? "opacity-75" : ""}`}>

                {isPastWeek && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    {pastLabelVisible && (
                      <span
                        onClick={() => setPastLabelVisible(false)}
                        className="cursor-pointer bg-white/90 backdrop-blur-sm text-gray-500 text-xs font-medium px-4 py-2 rounded-full shadow-lg hover:bg-white transition-all border border-gray-200"
                      >
                        צפייה בלבד
                      </span>
                    )}
                  </div>
                )}

                <div className="overflow-y-auto flex-1" onMouseLeave={handleDragEnd}>
                  {/* Day headers */}
                  <div className="grid sticky top-0 z-30"
                    style={{ gridTemplateColumns: "52px repeat(7, 1fr)", background: "#eddfc9", borderBottom: "2px solid #c8ad8e" }}>
                    <div style={{ borderRight: "1px solid #c8ad8e" }} />
                    {weekDays.map((day, i) => {
                      const iso = toISO(day);
                      const isToday = iso === today;
                      return (
                        <div key={i}
                          className={`text-center py-3 ${iso < today ? "blur-[1.5px]" : ""}`}
                          style={{ borderRight: "1px solid #c8ad8e" }}>
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

                  {/* Hour rows */}
                  {HOURS.map((hour) => (
                    <div key={hour}
                      className="grid last:border-0"
                      style={{ gridTemplateColumns: "52px repeat(7, 1fr)", height: "56px", borderBottom: "1px solid #e0d0bc" }}>

                      <div className="flex items-start justify-center pt-1.5" style={{ borderRight: "1px solid #e0d0bc" }}>
                        <span className="text-[10px] font-medium" style={{ color: "#b09070" }}>
                          {`${String(hour).padStart(2, "0")}:00`}
                        </span>
                      </div>

                      {weekDays.map((day, di) => {
                        const iso = toISO(day);
                        const startingHere = weekAppts.filter((a) => a.date === iso && apptStartsAt(a, hour));
                        const spanningHere = weekAppts.filter((a) => a.date === iso && apptSpansHour(a, hour));
                        const isPastDay = iso < today;
                        const dragMin = drag ? Math.min(drag.startHour, drag.endHour) : null;
                        const dragMax = drag ? Math.max(drag.startHour, drag.endHour) : null;
                        const isDragCell = drag && drag.date === iso && hour >= dragMin && hour <= dragMax;

                        return (
                          <div key={di}
                            onClick={() => handleCellClick(iso, hour)}
                            onMouseDown={(e) => { e.preventDefault(); handleDragStart(iso, hour); }}
                            onMouseEnter={() => handleDragEnter(iso, hour)}
                            onMouseUp={handleDragEnd}
                            className={`relative h-14 select-none transition-colors
                              ${isPastDay ? "blur-[1.5px] cursor-not-allowed" : "cursor-pointer"}
                              ${!isPastDay && isDragCell ? "bg-yellow-50" : ""}
                              ${!isPastDay && !isDragCell ? "hover:bg-yellow-50/70" : ""}`}
                            style={{ borderRight: "1px solid #e0d0bc" }}>

                            {startingHere.map((a) => {
                              const hasContinuation = a.end_time && apptHour(a.end_time) > hour;
                              const isHovered = hoveredApptId === a.id;
                              return (
                                <div key={a.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedAppt(a); }}
                                  onMouseEnter={() => setHoveredApptId(a.id)}
                                  onMouseLeave={() => setHoveredApptId(null)}
                                  className={`absolute inset-x-0.5 top-0 bottom-0 text-[10px] px-1.5 pt-1 leading-tight cursor-pointer transition-all z-10
                                    border-t border-x
                                    ${isHovered
                                      ? "bg-yellow-100 border-yellow-400 shadow-sm"
                                      : "bg-yellow-50 border-yellow-300"}
                                    ${hasContinuation ? "rounded-t-lg" : "rounded-lg border-b"}`}>
                                  <div className="font-bold truncate text-yellow-900">{a.client_name}</div>
                                  <div className="truncate text-yellow-600 text-[9px]">{a.treatment_name}</div>
                                  <div className="text-[9px] text-yellow-500">{a.time}{a.end_time ? `–${a.end_time}` : ""}</div>
                                </div>
                              );
                            })}

                            {spanningHere.map((a) => {
                              const isHovered = hoveredApptId === a.id;
                              return (
                                <div key={a.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedAppt(a); }}
                                  onMouseEnter={() => setHoveredApptId(a.id)}
                                  onMouseLeave={() => setHoveredApptId(null)}
                                  className={`absolute inset-x-0.5 top-0 bottom-0 border-x cursor-pointer transition-all z-10
                                    ${isHovered ? "bg-yellow-100 border-yellow-400" : "bg-yellow-50 border-yellow-300"}
                                    ${apptEndsAt(a, hour) ? "rounded-b-lg border-b" : ""}`}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
