import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { createEmployee, fetchEmployees, updateEmployee } from "../api/medayApi";

const emptyForm = {
  full_name: "",
  phone: "",
  specialties: [],
  is_active: true,
};

function isValidPhone(phone) {
  if (!phone) return true;
  return /^\+?[0-9][0-9\s-]{6,18}$/.test(phone);
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) || null;

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (statusFilter === "active" && !employee.is_active) return false;
      if (statusFilter === "inactive" && employee.is_active) return false;
      if (!query) return true;
      return (
        employee.full_name.toLowerCase().includes(query) ||
        (employee.phone || "").includes(query) ||
        (employee.specialties || []).some((specialty) => specialty.toLowerCase().includes(query))
      );
    });
  }, [employees, search, statusFilter]);

  async function loadEmployees() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchEmployees({ includeInactive: true });
      setEmployees(result.employees || []);
      setCategories(result.categories || []);
    } catch (err) {
      setError(err.message || "לא ניתן לטעון עובדים");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  function startCreate() {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  function startEdit(employee) {
    setSelectedId(employee.id);
    setForm({
      full_name: employee.full_name || "",
      phone: employee.phone || "",
      specialties: employee.specialties || [],
      is_active: !!employee.is_active,
    });
    setMessage("");
    setError("");
  }

  function toggleSpecialty(specialty) {
    setForm((current) => ({
      ...current,
      specialties: current.specialties.includes(specialty)
        ? current.specialties.filter((item) => item !== specialty)
        : [...current.specialties, specialty],
    }));
  }

  function validateForm() {
    if (!form.full_name.trim()) return "שם מלא הוא שדה חובה";
    if (!form.specialties.length) return "יש לבחור לפחות תחום טיפול אחד";
    if (!isValidPhone(form.phone.trim())) return "מספר טלפון לא תקין";
    return "";
  }

  async function saveEmployee(event) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        specialties: form.specialties,
        is_active: form.is_active,
      };
      const result = selectedId
        ? await updateEmployee(selectedId, payload)
        : await createEmployee(payload);
      setMessage(result.message || (selectedId ? "פרטי העובד/ת עודכנו בהצלחה" : "העובד/ת נוסף/ה בהצלחה"));
      await loadEmployees();
      if (!selectedId && result.employee?.id) setSelectedId(result.employee.id);
    } catch (err) {
      setError(err.message || "שמירת העובד/ת נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function setEmployeeStatus(employee, isActive) {
    if (!isActive) {
      const accepted = window.confirm("האם להעביר את העובד/ת למצב לא פעיל?");
      if (!accepted) return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateEmployee(employee.id, {
        full_name: employee.full_name,
        phone: employee.phone || "",
        specialties: employee.specialties || [],
        is_active: isActive,
      });
      setMessage(isActive ? "העובד/ת הופעל/ה מחדש" : "העובד/ת הועבר/ה למצב לא פעיל");
      await loadEmployees();
      if (selectedId === employee.id) {
        setForm((current) => ({ ...current, is_active: isActive }));
      }
    } catch (err) {
      setError(err.message || "עדכון סטטוס העובד/ת נכשל");
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
            <div className="flex items-center gap-3 rounded-2xl bg-[#C4795A]/20 px-4 py-3 text-sm font-bold text-[#E8C4A0]">
              <Users size={17} />
              ניהול עובדים
            </div>
            <Link to="/admin/employee-shifts" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[#E8C4A0]/70 transition hover:bg-white/5 hover:text-[#E8C4A0]">
              <UserCheck size={17} />
              ניהול משמרות עובדים
            </Link>
          </nav>
        </aside>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-5">
            <header className="rounded-[2rem] bg-gradient-to-l from-[#1D0D05] via-[#6F3B24] to-[#C4795A] p-6 text-white shadow-2xl shadow-[#9B5C38]/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-[#E8C4A0]">
                    <Users size={14} />
                    צוות טיפולים
                  </div>
                  <h2 className="text-3xl font-black">ניהול עובדים</h2>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    הוספה, עריכה, תחומי טיפול והפעלה או השבתה ללא מחיקת היסטוריה.
                  </p>
                </div>
                <button onClick={startCreate} type="button" className="inline-flex w-fit items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold text-[#8B5030] shadow-lg">
                  <Plus size={16} />
                  עובד/ת חדש/ה
                </button>
              </div>
            </header>

            {message ? (
              <div className="flex items-center gap-2 rounded-3xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
                <CheckCircle2 size={18} />
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="flex items-center gap-2 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                <AlertTriangle size={18} />
                {error}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
              <section className="rounded-3xl border border-white/70 bg-white/82 p-4 shadow-xl shadow-[#9B5C38]/5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-black text-[#5F432B]">רשימת עובדים</h3>
                  <button type="button" onClick={loadEmployees} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF6F1] text-[#8B5030]">
                    <RefreshCw size={15} />
                  </button>
                </div>
                <label className="mb-3 flex items-center gap-2 rounded-2xl bg-[#FAF6F1] px-3 py-2 text-sm text-[#6B4F35]">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="חיפוש לפי שם, טלפון או תחום טיפול"
                    className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-[#9A8A7A]"
                  />
                </label>
                <div className="mb-3 flex gap-2">
                  {[
                    ["active", "פעיל/ה"],
                    ["inactive", "לא פעיל/ה"],
                    ["all", "הכל"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      className="rounded-full px-3 py-1.5 text-xs font-black"
                      style={statusFilter === key ? { background: "#C4795A", color: "white" } : { background: "#FAF6F1", color: "#8B5030" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {loading ? (
                  <p className="rounded-2xl bg-[#FAF6F1] p-5 text-center text-sm font-bold text-[#8B5030]">טוען עובדים...</p>
                ) : (
                  <div className="max-h-[38rem] space-y-2 overflow-y-auto pr-1">
                    {filteredEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => startEdit(employee)}
                        className="flex w-full items-start justify-between gap-3 rounded-2xl px-4 py-3 text-right transition"
                        style={selectedId === employee.id ? { background: "#C4795A", color: "white" } : { background: "#FAF6F1", color: "#6B4F35" }}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-black">{employee.full_name}</span>
                          <span className={`mt-1 block text-xs leading-5 ${selectedId === employee.id ? "text-white/75" : "text-[#8B6F52]"}`}>
                            {(employee.specialties || []).join(" · ")}
                          </span>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${employee.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                            {employee.is_active ? "פעיל/ה" : "לא פעיל/ה"}
                          </span>
                        </span>
                        <UserRound size={16} className="mt-0.5 shrink-0" />
                      </button>
                    ))}
                    {filteredEmployees.length === 0 ? (
                      <p className="rounded-2xl bg-[#FAF6F1] p-4 text-center text-sm font-bold text-[#8B5030]">לא נמצאו עובדים</p>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/70 bg-white/82 p-5 shadow-xl shadow-[#9B5C38]/5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#C4795A]">{selectedEmployee ? "עריכת עובד/ת" : "עובד/ת חדש/ה"}</p>
                    <h3 className="text-2xl font-black text-[#3D2418]">{selectedEmployee?.full_name || "פרטי עובד/ת"}</h3>
                  </div>
                  {selectedEmployee ? <Edit3 size={20} className="text-[#C4795A]" /> : <Plus size={22} className="text-[#C4795A]" />}
                </div>

                <form onSubmit={saveEmployee} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-bold text-[#5F432B]">
                      שם מלא
                      <input
                        value={form.full_name}
                        onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                        className="mt-1 w-full rounded-2xl border border-[#E8C4A0] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#C4795A]"
                      />
                    </label>
                    <label className="text-sm font-bold text-[#5F432B]">
                      מספר טלפון
                      <input
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        className="mt-1 w-full rounded-2xl border border-[#E8C4A0] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#C4795A]"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-bold text-[#5F432B]">תחומי טיפול</p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {categories.map((category) => (
                        <label key={category} className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[#FAF6F1] px-4 py-3 text-sm font-bold text-[#6B4F35]">
                          <input
                            type="checkbox"
                            checked={form.specialties.includes(category)}
                            onChange={() => toggleSpecialty(category)}
                          />
                          {category}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-2xl bg-[#FAF6F1] px-4 py-3 text-sm font-bold text-[#6B4F35]">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    סטטוס: {form.is_active ? "פעיל/ה" : "לא פעיל/ה"}
                  </label>

                  <div className="flex flex-col gap-3 border-t border-[#E8C4A0]/45 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {selectedEmployee && selectedEmployee.is_active ? (
                        <button type="button" onClick={() => setEmployeeStatus(selectedEmployee, false)} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-50">
                          <UserX size={15} />
                          העברה ללא פעיל/ה
                        </button>
                      ) : null}
                      {selectedEmployee && !selectedEmployee.is_active ? (
                        <button type="button" onClick={() => setEmployeeStatus(selectedEmployee, true)} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-xs font-black text-green-700 disabled:opacity-50">
                          <UserCheck size={15} />
                          הפעלה מחדש
                        </button>
                      ) : null}
                    </div>
                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#C4795A]/20 disabled:opacity-50">
                      <Save size={16} />
                      {saving ? "שומר..." : "שמירה"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
