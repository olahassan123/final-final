import { useMemo, useState } from "react";
import { CalendarDays, Heart, Save, Sparkles, UserRound, X } from "lucide-react";
import {
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

export default function ClientProfile({ profile, onSave, isEditOpen = false, onEditClose }) {
  const [draft, setDraft] = useState(() => ({
    fullName: profile?.fullName || "",
    age: profile?.age || "",
    gender: profile?.gender || "",
    phone: profile?.phone || "",
    password: "",
    selectedTreatments: profile?.selectedTreatments || [],
  }));
  const treatmentOptions = useMemo(() => getClientTreatmentOptions(), []);
  const selectedTreatmentLabels = useMemo(
    () => labelsForTreatments(profile?.selectedTreatments || []),
    [profile?.selectedTreatments]
  );

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

  const resetDraft = () => {
    setDraft({
      fullName: profile?.fullName || "",
      age: profile?.age || "",
      gender: profile?.gender || "",
      phone: profile?.phone || "",
      password: "",
      selectedTreatments: profile?.selectedTreatments || [],
    });
  };

  const cancelEdit = () => {
    resetDraft();
    onEditClose?.();
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const result = onSave({
      ...draft,
      password: draft.password.trim(),
    });

    if (result?.ok) {
      setDraft((current) => ({ ...current, password: "" }));
      onEditClose?.();
    }
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/85 shadow-2xl shadow-[#9B5C38]/10 backdrop-blur">
      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-accent-light bg-secondary/55 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <UserRound size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-primary-dark">פרטים אישיים</p>
                <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">פרופיל לקוחה</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileField label="שם מלא" value={profile?.fullName} />
              <ProfileField label="שם משתמש" value={profile?.username} />
              <ProfileField label="גיל" value={profile?.age} />
              <ProfileField label="מגדר" value={profile?.gender} />
              <ProfileField label="טלפון" value={profile?.phone} />
            </div>
          </div>

          <div className="rounded-3xl border border-accent-light bg-white/75 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <Heart size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-primary-dark">העדפות טיפול</p>
                <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">טיפולים נבחרים</h2>
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
          <div id="client-appointments" className="scroll-mt-28 rounded-3xl border border-accent-light bg-white/75 p-5">
            <CalendarDays className="mb-4 text-primary" size={26} />
            <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">תורים והיסטוריה</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              בהמשך יוצגו כאן תורים עתידיים, ביקורים קודמים והמלצות המשך טיפול.
            </p>
          </div>
          <div className="rounded-3xl border border-accent-light bg-secondary/65 p-5">
            <Sparkles className="mb-4 text-primary" size={26} />
            <h2 className="font-serif text-2xl font-bold text-[#3d2e1a]">תוכנית אישית</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              מקום שמור לתוכנית טיפולים מותאמת אישית לפי העדפות הלקוחה והמלצות הצוות.
            </p>
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
                <p className="text-sm font-bold text-primary-dark">עריכת פרופיל</p>
                <h2 className="font-serif text-3xl font-bold text-[#3d2e1a]">עדכון פרטי לקוחה</h2>
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
              <EditInput label="טלפון">
                <input
                  value={draft.phone}
                  onChange={(event) => updateDraft("phone", event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </EditInput>
              <EditInput label="סיסמה חדשה">
                <input
                  value={draft.password}
                  onChange={(event) => updateDraft("password", event.target.value)}
                  type="password"
                  placeholder="להשאיר ריק אם אין שינוי"
                  className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </EditInput>
              <div className="rounded-2xl border border-accent-light bg-white/70 p-4 text-sm text-gray-600">
                שם המשתמש נשאר קבוע כדי לשמור על התחברות יציבה:{" "}
                <span className="font-bold text-primary-dark">{profile?.username}</span>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-accent-light bg-white/70 p-4">
              <p className="mb-3 text-sm font-bold text-[#3d2e1a]">טיפולים</p>
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
