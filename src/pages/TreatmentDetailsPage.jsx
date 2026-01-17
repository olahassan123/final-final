import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; // לשימוש בכתובת URL
import { fetchTreatmentById } from "../api/medayApi";
import { ArrowRight, Clock, ShieldCheck, Sparkles, AlertCircle } from "lucide-react"; // אייקונים לעיצוב

// רכיב שורה מעוצב עם Tailwind
function DetailRow({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-4 border-b border-pink-50 last:border-0">
      {Icon && <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
      <div className="flex flex-col sm:flex-row sm:gap-2">
        <span className="font-bold text-gray-800 min-w-[150px]">{label}:</span>
        <span className="text-gray-600 leading-relaxed">{value}</span>
      </div>
    </div>
  );
}

export default function TreatmentDetailsPage() {
  const { id } = useParams(); // לוקח את ה-ID מהכתובת: /treatments/123
  const navigate = useNavigate();
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchTreatmentById(id);
        if (alive) setTreatment(data);
      } catch (e) {
        if (alive) setError(e?.message || "נכשל בטעינת הטיפול");
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadData();
    return () => { alive = false; };
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (error || !treatment) return (
    <div className="container mx-auto p-10 text-center">
      <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
      <p className="text-xl text-gray-700">{error || "הטיפול לא נמצא"}</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-primary font-bold">חזרה לרשימה</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 bg-white" dir="rtl">
      {/* כפתור חזרה מעוצב */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors mb-8 group"
      >
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        <span>חזרה לכל הטיפולים</span>
      </button>

      {/* כותרת הטיפול */}
      <div className="mb-10">
        <span className="text-primary font-medium tracking-wide uppercase text-sm">{treatment.category}</span>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mt-2 tracking-tight">
          {treatment.name}
        </h1>
      </div>

      {/* גוף המידע - חלוקה לכרטיסים */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* עמודה ראשית: פרטי הטיפול */}
        <div className="md:col-span-2 space-y-2">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            מידע על הטיפול
          </h3>
          <div className="bg-pink-50/30 rounded-3xl p-6 border border-pink-100/50">
            <DetailRow label="מתאים לכל סוגי העור" value={treatment.suitable_for_all_skins} />
            <DetailRow label="גילאים" value={treatment.ages} />
            <DetailRow label="מתי רואים תוצאות" value={treatment.results_timing} icon={Clock} />
            <DetailRow label="מוצרים משלימים" value={treatment.complementary_products} />
            <DetailRow label="הנחיות לאחר טיפול" value={treatment.aftercare} icon={ShieldCheck} />
            <DetailRow label="הגבלות רפואיות" value={treatment.medical_limitations} />
          </div>
        </div>

        {/* עמודה צדדית: סיכום מהיר / CTA */}
        <div className="space-y-6">
          <div className="bg-gray-900 text-white rounded-3xl p-8 shadow-xl">
            <h4 className="text-xl font-bold mb-4 italic">MeDay Tip</h4>
            <p className="text-gray-300 leading-relaxed mb-6">
              חשוב לדעת: {treatment.consultation_required === 'Yes' ? 'טיפול זה דורש ייעוץ מקדים עם המומחיות שלנו.' : 'ניתן להגיע לטיפול ללא פגישת ייעוץ מקדימה.'}
            </p>
            <button className="w-full bg-primary hover:bg-white hover:text-primary text-white py-3 rounded-full font-bold transition-all duration-300">
              תיאום תור לטיפול זה
            </button>
          </div>
        </div>
      </div>

      {/* שאלות ותשובות (FAQ) */}
      <div className="mt-16">
        <h3 className="text-2xl font-serif font-bold text-gray-900 mb-8 border-r-4 border-primary pr-4">שאלות נפוצות</h3>
        <div className="grid gap-4">
          {Object.entries(treatment.faq || {}).length === 0 ? (
            <p className="text-gray-400 italic">אין עדיין שאלות נפוצות לטיפול זה.</p>
          ) : (
            Object.entries(treatment.faq).map(([question, answer]) => (
              <div key={question} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="font-bold text-gray-800 text-lg mb-2">{question}</h4>
                <p className="text-gray-600 leading-relaxed">{answer}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}