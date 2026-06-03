import { useMemo, useState } from "react";
import { Heart, Lock, Phone, UserRound } from "lucide-react";
import {
  CLIENT_GENDER_OPTIONS,
  getClientTreatmentOptions,
} from "./clientProfileOptions";

const INITIAL_FORM = {
  fullName: "",
  username: "",
  password: "",
  age: "",
  gender: "",
  phone: "",
  selectedTreatments: [],
};

export default function ClientRegisterForm({ error, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const treatmentOptions = useMemo(() => getClientTreatmentOptions(), []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
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
    onSubmit(form);
  };

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
          />
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
            />
          </div>
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          גיל
          <input
            value={form.age}
            onChange={(event) => updateField("age", event.target.value)}
            type="number"
            min="1"
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>

        <label className="block text-sm font-semibold text-gray-700">
          מגדר
          <select
            value={form.gender}
            onChange={(event) => updateField("gender", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          >
            <option value="">בחירה</option>
            {CLIENT_GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
            />
          </div>
        </label>
      </div>

      <div className="rounded-3xl border border-accent-light bg-white/70 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#3d2e1a]">
          <Heart size={18} className="text-primary" />
          טיפולים שיש לי או מעניינים אותי
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

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark hover:shadow-glow-terracotta"
      >
        הרשמה וכניסה
      </button>
    </form>
  );
}
