import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Heart, Mail, Phone, Save, Sparkles, UserRound, X } from "lucide-react";
import {
  categoriesForTreatments,
  CLIENT_GENDER_OPTIONS,
  getClientTreatmentOptions,
  labelsForTreatments,
} from "./clientProfileOptions";

function ProfileField({ label, value }) {
  return (
    <div className="rounded-2xl border border-accent-light bg-white/75 p-4">
      <p className="text-xs font-bold text-primary-dark">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#3d2e1a]">{value || "לא הוזן"}</p>
    </div>
  );
}

function EditInput({ label, children }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      {children}
    </label>
  );
}

function AppointmentList({ appointments = [] }) {
  if (!appointments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/25 bg-secondary/65 p-5 text-sm leading-7 text-gray-600">
        עדיין לא נמצאו תורים שמורים. אחרי קביעת תור, הוא יוצג כאן לפי מספר הטלפון בפרופיל.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <div key={appointment.id} className="rounded-2xl border border-accent-light bg-white/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#3d2e1a]">{appointment.treatment_name}</p>
              <p className="mt-1 text-sm text-gray-500">
                {appointment.date} בשעה {appointment.time}
                {appointment.end_time ? `-${appointment.end_time}` : ""}
              </p>
            </div>
            {appointment.employee_name ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary-dark">
                {appointment.employee_name}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkedAppointmentList({ appointments = [] }) {
  if (!appointments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/25 bg-secondary/65 p-5 text-sm leading-7 text-gray-600">
        עדיין אין לך תורים במערכת
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <div key={appointment.id} className="rounded-2xl border border-accent-light bg-white/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#3d2e1a]">{appointment.treatment_name}</p>
              <p className="mt-1 text-sm text-gray-500">
                {appointment.date} בשעה {appointment.time}
                {appointment.end_time ? `-${appointment.end_time}` : ""}
              </p>
              {appointment.status ? (
                <p className="mt-1 text-xs font-bold text-primary-dark">סטטוס: {appointment.status}</p>
              ) : null}
            </div>
            {appointment.employee_name ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary-dark">
                {appointment.employee_name}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClientProfile({
  profile,
  appointments = [],
  onSave,
  isEditOpen = false,
  onEditClose,
  onCompleteProfile,
}) {
  const [draft, setDraft] = useState(() => ({
    fullName: profile?.fullName || "",
    email: profile?.email || "",
    age: profile?.age || "",
    gender: profile?.gender || "",
    phone: profile?.phone || "",
    selectedTreatments: profile?.selectedTreatments || [],
  }));
  const treatmentOptions = useMemo(() => getClientTreatmentOptions(), []);
  const selectedTreatmentLabels = useMemo(
    () => labelsForTreatments(profile?.selectedTreatments || []),
    [profile?.selectedTreatments]
  );
  const selectedCategories = useMemo(
    () => categoriesForTreatments(profile?.selectedTreatments || []),
    [profile?.selectedTreatments]
  );

  useEffect(() => {
    setDraft({
      fullName: profile?.fullName || "",
      email: profile?.email || "",
      age: profile?.age || "",
      gender: profile?.gender || "",
      phone: profile?.phone || "",
      selectedTreatments: profile?.selectedTreatments || [],
    });
  }, [profile]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleTreatment = (value) => {
    setDraft((current) => {
      const selected = current.selectedTreatments.includes(value)
        ? current.selectedTreatments.filter((item) => item !== value)
        : [...current.selectedTreatments, value];

      return { ...current, selectedTreatments: selected };
    });
  };

  const cancelEdit = () => {
    onEditClose?.();
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const result = await onSave({ ...draft });

    if (result?.ok) {
      onEditClose?.();
    }
  };

  const hasMissingDetails = !profile?.phone || !profile?.email || !profile?.age || !profile?.gender;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/85 shadow-2xl shadow-[#9B5C38]/10 backdrop-blur">
      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          {hasMissingDetails ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-sm font-bold text-primary-dark">עדיין לא הושלם פרופיל אישי</p>
              <p className="mt-2 text-sm leading-7 text-gray-600">
                השלמת הפרטים תעזור לנו להתאים המלצות, תורים והעדפות טיפול.
              </p>
              <button
                type="button"
                onClick={onCompleteProfile}
                className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-dark"
              >
                השלמת פרופיל
              </button>
            </div>
          ) : null}

          <div className="rounded-3xl border border-accent-light bg-secondary/55 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <UserRound size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-primary-dark">הפרטים האישיים שלי</p>
                <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">פרופיל לקוח/ה</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileField label="שם מלא" value={profile?.fullName} />
              <ProfileField label="שם משתמש" value={profile?.username} />
              <ProfileField label="אימייל" value={profile?.email} />
              <ProfileField label="טלפון" value={profile?.phone} />
              <ProfileField label="גיל" value={profile?.age} />
              <ProfileField label="מגדר" value={profile?.gender} />
            </div>
          </div>

          <div className="rounded-3xl border border-accent-light bg-white/75 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <Heart size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-primary-dark">הטיפולים שמעניינים אותי</p>
                <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">העדפות טיפול</h2>
              </div>
            </div>
            {selectedTreatmentLabels.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedTreatmentLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary-dark"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-primary/25 bg-secondary/65 p-5 text-sm text-gray-600">
                עדיין לא נבחרו טיפולים. אפשר לעדכן את ההעדפות בעריכת הפרופיל.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-accent-light bg-secondary/65 p-5">
            <Sparkles className="mb-4 text-primary" size={26} />
            <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">קטגוריות שמעניינות אותי</h2>
            {selectedCategories.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedCategories.map((category) => (
                  <span key={category} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primary-dark">
                    {category}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-7 text-gray-600">בחרי/בחר העדפות טיפול כדי שנוכל להציג כאן קטגוריות רלוונטיות.</p>
            )}
          </div>

          <div id="client-appointments" className="scroll-mt-28 rounded-3xl border border-accent-light bg-white/75 p-5">
            <CalendarDays className="mb-4 text-primary" size={26} />
            <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">התורים שלי</h2>
            <div className="mt-4">
              <LinkedAppointmentList appointments={appointments} />
            </div>
          </div>
        </div>
      </div>

      {isEditOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={saveProfile}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/75 bg-secondary p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-primary-dark">עדכון פרטים</p>
                <h2 className="font-serif text-3xl font-bold text-[#3d2e1a]">עריכת אזור אישי</h2>
              </div>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full bg-white p-2 text-primary-dark shadow-sm transition hover:bg-primary/10"
                aria-label="סגירה"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <EditInput label="שם מלא">
                <input
                  value={draft.fullName}
                  onChange={(event) => updateDraft("fullName", event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </EditInput>
              <EditInput label="אימייל">
                <div className="relative mt-1">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                  <input
                    value={draft.email}
                    onChange={(event) => updateDraft("email", event.target.value)}
                    type="email"
                    className="w-full rounded-2xl border border-accent-light bg-white py-3 pl-4 pr-11 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </EditInput>
              <EditInput label="טלפון">
                <div className="relative mt-1">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                  <input
                    value={draft.phone}
                    onChange={(event) => updateDraft("phone", event.target.value)}
                    className="w-full rounded-2xl border border-accent-light bg-white py-3 pl-4 pr-11 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </EditInput>
              <EditInput label="גיל">
                <input
                  value={draft.age}
                  onChange={(event) => updateDraft("age", event.target.value)}
                  type="number"
                  min="1"
                  className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </EditInput>
              <EditInput label="מגדר">
                <select
                  value={draft.gender}
                  onChange={(event) => updateDraft("gender", event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                >
                  <option value="">בחירה</option>
                  {CLIENT_GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </EditInput>
              <div className="rounded-2xl border border-accent-light bg-white/70 p-4 text-sm text-gray-600">
                שם המשתמש נשאר קבוע כדי לשמור על התחברות יציבה:{" "}
                <span className="font-bold text-primary-dark">{profile?.username}</span>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-accent-light bg-white/70 p-4">
              <p className="mb-3 text-sm font-bold text-[#3d2e1a]">העדפות טיפול</p>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {treatmentOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-secondary/60 px-3 py-2 text-sm text-gray-700 transition hover:border-primary/20 hover:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      checked={draft.selectedTreatments.includes(option.value)}
                      onChange={() => toggleTreatment(option.value)}
                      className="mt-1 accent-primary"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark"
              >
                <Save size={18} />
                שמירת שינויים
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-primary/20 px-6 py-3 font-semibold text-primary-dark transition hover:bg-primary/5"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
