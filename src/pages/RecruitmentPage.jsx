import { useState } from "react";
import { ArrowLeft, Briefcase, CheckCircle2, Link as LinkIcon, Mail, Phone, UserRound } from "lucide-react";
import { saveJobApplication } from "../api/jobsApi";

const JOB_FIELDS = [
  "קוסמטיקה",
  "מניקור ופדיקור",
  "עיצוב שיער",
  "איפור מקצועי",
  "איפור קבוע ועיצוב גבות",
  "טיפולי גוף",
  "שיווק וניהול תוכן",
  "ניהול לקוחות וקבלה",
];

const INITIAL_FORM = {
  fullName: "",
  email: "",
  phone: "",
  portfolioLink: "",
  field: "",
};

function FormField({ label, error, children }) {
  return (
    <label className="block text-right">
      <span className="mb-2 block text-sm font-bold text-[#3d2e1a]">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm font-semibold text-red-600">{error}</span> : null}
    </label>
  );
}

function fieldClass(error) {
  return `w-full rounded-2xl border bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 ${
    error
      ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100"
      : "border-accent-light focus:border-primary focus:ring-4 focus:ring-primary/10"
  }`;
}

export default function RecruitmentPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.fullName.trim()) nextErrors.fullName = "נא להזין שם מלא";
    if (!form.email.trim()) {
      nextErrors.email = "נא להזין מייל";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "כתובת המייל אינה תקינה";
    }
    if (!form.phone.trim()) nextErrors.phone = "נא להזין טלפון";
    if (!form.portfolioLink.trim()) nextErrors.portfolioLink = "נא לצרף לינק לרשת חברתית או תיק עבודות";
    if (!form.field) nextErrors.field = "נא לבחור תחום";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validate()) return;

    saveJobApplication(form);
    setForm(INITIAL_FORM);
    setIsSubmitted(true);
  };

  return (
    <section
      dir="rtl"
      className="relative min-h-screen overflow-hidden bg-[#FAF6F1] px-4 pb-16 pt-28 sm:px-6 lg:pt-32"
    >
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#F3C8B7]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-0 h-80 w-80 rounded-full bg-[#E7D1BD]/45 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <header className="rounded-[2rem] border border-white/75 bg-white/80 p-6 shadow-2xl shadow-[#9B5C38]/10 backdrop-blur sm:p-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
              <Briefcase size={28} />
            </div>
            <p className="text-sm font-bold text-primary-dark">MeDay Careers</p>
            <h1 className="mt-3 font-serif text-5xl font-black leading-tight text-[#3d2e1a]">
              דרושים
            </h1>
            <p className="mt-4 text-base leading-8 text-gray-600">
              אנחנו מחפשות נשות מקצוע שאוהבות יופי, שירות ואסתטיקה מוקפדת. השאירי פרטים ונחזור אלייך.
            </p>
            <div className="mt-6 rounded-3xl bg-secondary/70 p-5 text-sm leading-7 text-gray-600">
              הטופס נשמר כרגע ב-localStorage ויופיע באזור הניהול תחת דרושים.
            </div>
          </header>

          <div className="rounded-[2rem] border border-white/75 bg-white/85 p-5 shadow-2xl shadow-[#9B5C38]/10 backdrop-blur sm:p-8">
            {isSubmitted ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <CheckCircle2 size={34} />
                </div>
                <h2 className="font-serif text-4xl font-bold text-[#3d2e1a]">הבקשה נשלחה</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-gray-600">
                  תודה, הפרטים נשמרו בהצלחה. צוות MeDay יבדוק את הפנייה ויחזור אלייך בהמשך.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-7 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark"
                >
                  שליחת בקשה נוספת
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="mb-2">
                  <p className="text-sm font-bold text-primary-dark">טופס מועמדות</p>
                  <h2 className="font-serif text-3xl font-bold text-[#3d2e1a]">הצטרפות לצוות</h2>
                </div>

                <FormField label="שם מלא" error={errors.fullName}>
                  <div className="relative">
                    <UserRound className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                    <input
                      value={form.fullName}
                      onChange={(event) => updateField("fullName", event.target.value)}
                      className={`${fieldClass(errors.fullName)} pr-11 text-right`}
                      autoComplete="name"
                    />
                  </div>
                </FormField>

                <FormField label="מייל" error={errors.email}>
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                    <input
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      type="email"
                      dir="ltr"
                      className={`${fieldClass(errors.email)} pl-4 pr-11 text-left`}
                      autoComplete="email"
                    />
                  </div>
                </FormField>

                <FormField label="טלפון" error={errors.phone}>
                  <div className="relative">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                    <input
                      value={form.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      type="tel"
                      dir="ltr"
                      className={`${fieldClass(errors.phone)} pl-4 pr-11 text-left`}
                      autoComplete="tel"
                    />
                  </div>
                </FormField>

                <FormField label="לינק לרשת חברתית עם תיק עבודות" error={errors.portfolioLink}>
                  <div className="relative">
                    <LinkIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                    <input
                      value={form.portfolioLink}
                      onChange={(event) => updateField("portfolioLink", event.target.value)}
                      type="url"
                      dir="ltr"
                      className={`${fieldClass(errors.portfolioLink)} pl-4 pr-11 text-left`}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                </FormField>

                <FormField label="בחירת תחום" error={errors.field}>
                  <select
                    value={form.field}
                    onChange={(event) => updateField("field", event.target.value)}
                    className={`${fieldClass(errors.field)} text-right`}
                  >
                    <option value="">בחרי תחום</option>
                    {JOB_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </FormField>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-primary-dark hover:shadow-glow-terracotta"
                >
                  שלחו
                  <ArrowLeft size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
