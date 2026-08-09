import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { API_BASE_URL } from "../api/config";
import { openAppointmentWhatsApp } from "../lib/booking";

function DetailRow({ label, value, icon: Icon = Sparkles }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 border-b border-[#E8C4A0]/35 py-4 last:border-b-0">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#C4795A]/10">
        <Icon size={16} className="text-[#C4795A]" />
      </div>
      <div className="space-y-1 text-right">
        <p className="text-sm font-bold text-[#2B211C]">{label}</p>
        <p className="text-sm leading-7 text-[#6F625A]">{value}</p>
      </div>
    </div>
  );
}

export default function TreatmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/chat/treatments/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("הטיפול לא נמצא");
        const data = await res.json();
        if (!alive) return;
        setTreatment(data);
        window.__medaySelectedTreatment = { id: data.id, name: data.name };
        window.dispatchEvent(
          new CustomEvent("treatmentSelected", {
            detail: window.__medaySelectedTreatment,
          })
        );
      } catch (e) {
        if (alive) setError(e?.message || "נכשלה טעינת הטיפול");
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadData();
    return () => {
      alive = false;
    };
  }, [id]);

  const detailRows = useMemo(() => {
    if (!treatment) return [];
    return [
      ["למי זה מתאים", treatment.good_for, Sparkles],
      ["שיטה / מכשור", treatment.technique_or_equipment, Stethoscope],
      ["מה קורה בטיפול", treatment.what_to_expect, Sparkles],
      ["הכנה לפני הטיפול", treatment.preparation, ShieldCheck],
      ["הנחיות לאחר הטיפול", treatment.aftercare, ShieldCheck],
      ["תחושה / כאב", treatment.pain_level, AlertCircle],
      ["החלמה", treatment.downtime, Clock],
      ["מספר טיפולים מומלץ", treatment.sessions_recommended, CalendarDays],
      ["משך התוצאה", treatment.results_longevity, Clock],
    ];
  }, [treatment]);

  const askAboutTreatment = () => {
    if (!treatment) return;
    window.dispatchEvent(
      new CustomEvent("openChatWithQuestion", {
        detail: `אני רוצה לשאול על טיפול ${treatment.name}`,
      })
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF5F0]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#C4795A]/20 border-b-[#C4795A]" />
      </div>
    );
  }

  if (error || !treatment) {
    return (
      <div className="min-h-[70vh] bg-[#FAF5F0] px-6 py-16 text-center" dir="rtl">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-10 shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <p className="text-xl font-bold text-gray-800">{error || "הטיפול לא נמצא"}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#C4795A] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#9B5C38]"
          >
            <ArrowRight size={16} />
            חזרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF5F0]" dir="rtl">
      <section className="relative overflow-hidden px-6 pb-16 pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDF8F4] via-[#FAF0E6] to-[#FAF5F0]" />
        <div className="relative z-10 mx-auto max-w-5xl text-right">
          <button
            onClick={() => navigate(-1)}
            className="mb-8 flex items-center gap-2 text-sm font-bold text-[#9B5C38] transition-colors hover:text-[#6F3D2A]"
          >
            <ArrowRight size={16} />
            חזרה לכל הטיפולים
          </button>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#E8C4A0]/60 bg-white/80 px-4 py-2 text-sm font-bold text-[#9B5C38] shadow-sm">
            <Sparkles size={14} className="text-[#C4795A]" />
            {treatment.category}
          </div>

          <h1 className="max-w-3xl text-4xl font-black leading-tight text-[#2B211C] md:text-6xl">
            {treatment.name}
          </h1>
          {treatment.summary ? (
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#6F625A]">
              {treatment.summary}
            </p>
          ) : null}
        </div>
      </section>

      <main className="mx-auto -mt-6 grid max-w-5xl grid-cols-1 gap-7 px-6 pb-24 xl:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-[#E8C4A0]/40 bg-white/85 p-7 text-right shadow-xl backdrop-blur-xl md:p-8">
            <h2 className="mb-6 flex items-center justify-end gap-3 text-2xl font-bold text-gray-900">
              מידע על הטיפול
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C4795A]/10">
                <Stethoscope size={17} className="text-[#C4795A]" />
              </span>
            </h2>

            <div className="space-y-0">
              {detailRows.some(([, value]) => value) ? (
                detailRows.map(([label, value, Icon]) => (
                  <DetailRow key={label} label={label} value={value} icon={Icon} />
                ))
              ) : (
                <p className="text-sm leading-7 text-[#6F625A]">
                  {treatment.description || "אין כרגע פירוט נוסף על הטיפול הזה."}
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="relative overflow-hidden rounded-3xl border border-[#E8C4A0]/40 bg-[#FFF7F2] p-7 text-right text-[#2B211C] shadow-xl">
            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(196,121,90,0.18),transparent_70%)]" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C4795A]/15">
                <CalendarDays size={22} className="text-[#C4795A]" />
              </div>
              <h2 className="mb-3 text-xl font-bold">MeDay Tip</h2>
              <p className="mb-6 text-sm leading-7 text-[#6F625A]">
                לייעוץ מותאם אישית ותיאום מועד הטיפול המתאים עבורך, צוות MeDay כאן לעזור.
              </p>

              <div className="space-y-3">
                <button
                  onClick={openAppointmentWhatsApp}
                  className="w-full rounded-full bg-[#C4795A] py-3.5 text-sm font-bold text-white transition-all hover:bg-[#9B5C38] hover:shadow-[0_0_25px_rgba(196,121,90,0.24)]"
                >
                  תיאום תור לטיפול זה
                </button>
                <button
                  onClick={askAboutTreatment}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[#C4795A]/25 py-3.5 text-sm font-bold text-[#9B5C38] transition-colors hover:bg-white/70"
                >
                  <MessageCircle size={17} />
                  שאלי את ה-AI על הטיפול
                </button>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
