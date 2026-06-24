import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Heart, Lock, Phone, UserRound } from "lucide-react";
import {
  CLIENT_GENDER_OPTIONS,
  getClientTreatmentOptions,
} from "./clientProfileOptions";

const INITIAL_FORM = {
  fullName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  age: "",
  gender: "",
  phone: "",
  selectedTreatments: [],
};

function passwordRules(password, confirmPassword) {
  return [
    { label: "8 תווים לפחות", ok: password.length >= 8 },
    { label: "אות גדולה באנגלית", ok: /[A-Z]/.test(password) },
    { label: "אות קטנה באנגלית", ok: /[a-z]/.test(password) },
    { label: "מספר אחד לפחות", ok: /\d/.test(password) },
    { label: "תו מיוחד אחד לפחות", ok: /[!@#$%^&*()_\-+=\[\]{};:'\",.<>/?\\|`~]/.test(password) },
    { label: "הסיסמאות תואמות", ok: Boolean(password) && password === confirmPassword },
  ];
}

export function isStrongCustomerPassword(password, confirmPassword) {
  return passwordRules(password, confirmPassword).every((rule) => rule.ok);
}

function PasswordChecklist({ password, confirmPassword }) {
  const rules = passwordRules(password, confirmPassword);
  return (
    <div className="mt-3 rounded-2xl border border-accent-light bg-white/75 p-3">
      <p className="mb-2 text-xs font-bold text-primary-dark">חוזק סיסמה</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rules.map((rule) => {
          const Icon = rule.ok ? CheckCircle2 : Circle;
          return (
            <div
              key={rule.label}
              className={`flex items-center gap-2 text-xs font-semibold ${
                rule.ok ? "text-green-700" : "text-gray-500"
              }`}
            >
              <Icon size={15} />
              {rule.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientRegisterForm({ error, loading = false, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [localError, setLocalError] = useState("");
  const treatmentOptions = useMemo(() => getClientTreatmentOptions(), []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError("");
  };

  const toggleTreatment = (value) => {
    setForm((current) => {
      const selected = current.selectedTreatments.includes(value)
        ? current.selectedTreatments.filter((item) => item !== value)
        : [...current.selectedTreatments, value];

      return { ...current, selectedTreatments: selected };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // Password strength is checked in the UI and again by the backend.
    if (!isStrongCustomerPassword(form.password, form.confirmPassword)) {
      setLocalError(
        form.password !== form.confirmPassword
          ? "הסיסמאות אינן תואמות"
          : "הסיסמה אינה חזקה מספיק"
      );
      return;
    }
    const { confirmPassword, ...payload } = form;
    onSubmit(payload);
  };

  const visibleError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-gray-700">
          שם מלא
          <div className="relative mt-1">
            <UserRound className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
            <input
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
              className="w-full rounded-2xl border border-accent-light bg-white py-3 pl-4 pr-11 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              autoComplete="name"
              required
            />
          </div>
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          שם משתמש
          <input
            value={form.username}
            onChange={(event) => updateField("username", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            autoComplete="username"
            required
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          אימייל
          <input
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            type="email"
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            autoComplete="email"
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          טלפון
          <div className="relative mt-1">
            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="w-full rounded-2xl border border-accent-light bg-white py-3 pl-4 pr-11 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              autoComplete="tel"
              required
            />
          </div>
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          סיסמה
          <div className="relative mt-1">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
            <input
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              type="password"
              className="w-full rounded-2xl border border-accent-light bg-white py-3 pl-4 pr-11 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              autoComplete="new-password"
              required
            />
          </div>
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          אימות סיסמה
          <input
            value={form.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            type="password"
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          גיל
          <input
            value={form.age}
            onChange={(event) => updateField("age", event.target.value)}
            type="number"
            min="1"
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            required
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          מגדר
          <select
            value={form.gender}
            onChange={(event) => updateField("gender", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            required
          >
            <option value="">בחירה</option>
            {CLIENT_GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PasswordChecklist password={form.password} confirmPassword={form.confirmPassword} />

      <div className="rounded-3xl border border-accent-light bg-white/70 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#3d2e1a]">
          <Heart size={18} className="text-primary" />
          טיפולים שמעניינים אותי
        </div>
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
          {treatmentOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-secondary/60 px-3 py-2 text-sm text-gray-700 transition hover:border-primary/20 hover:bg-primary/5"
            >
              <input
                type="checkbox"
                checked={form.selectedTreatments.includes(option.value)}
                onChange={() => toggleTreatment(option.value)}
                className="mt-1 accent-primary"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {visibleError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {visibleError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark hover:shadow-glow-terracotta disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "שומרת..." : "הרשמה וכניסה"}
      </button>
    </form>
  );
}
