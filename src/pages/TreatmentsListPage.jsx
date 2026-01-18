import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTreatments } from "../api/medayApi";
import cosmeticsCategories from "../data/cosmeticsCategories";
import { Sparkles, ArrowLeft, Info } from "lucide-react";
import { cn } from "../lib/utils";
import { useLocation } from "react-router-dom"; // Add this to imports






function TreatmentCard({ t }) {
  const navigate = useNavigate();
  const { state } = useLocation();

useEffect(() => {
  if (state?.scrollTo && !loading) {
    const element = document.getElementById(state.scrollTo);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}, [state, loading]);
  // בחירת טקסט קצר להצגה בכרטיס
  const brief = t.keywords || t.results_timing || "לחצי לפרטים נוספים";

  return (
    <div className="group bg-white border border-pink-100 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-pink-100/50 hover:-translate-y-1 flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-primary transition-colors">
          {t.name}
        </h3>
        <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">
          {brief}
        </p>
      </div>

      <button 
        onClick={() => navigate(`/treatments/${t.id}`)}
        className="mt-6 flex items-center justify-between w-full text-primary font-bold text-sm border-t border-pink-50 pt-4 group/btn"
      >
        <span>לפרטי הטיפול</span>
        <ArrowLeft className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" />
      </button>
    </div>
  );
}

export default function TreatmentsListPage() {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
  let alive = true;
  (async () => {
    try {
      setLoading(true);
      const data = await fetchTreatments();
      if (alive) setTreatments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      // אם השרת נכשל, נטען נתונים מקומיים כדי שהדף לא יהיה ריק
      if (alive) {
          // כאן את יכולה להכניס מערך דוגמה אם יש לך קובץ נתונים מקומי
          setError("לא הצלחנו להתחבר לשרת, אנא וודאי שה-Backend פועל.");
      }
    } finally {
      if (alive) setLoading(false);
    }
  })();
  return () => { alive = false; };
}, []);

  const byCategory = useMemo(() => {
    return treatments.reduce((acc, t) => {
      const cat = t.category || "General";
      acc[cat] = acc[cat] || [];
      acc[cat].push(t);
      return acc;
    }, {});
  }, [treatments]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p className="text-gray-500 font-medium">טוען טיפולים...</p>
    </div>
  );

  if (error) return (
    <div className="container mx-auto p-20 text-center text-red-500 italic">
      {error}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fffafa] py-12 px-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-4">
            <span className="bg-pink-100 text-primary px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2">
              <Sparkles size={14} />
              התפריט המלא
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">סוגי טיפולים</h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            גלי את מגוון הטיפולים המקצועיים שלנו. לכל שאלה נוספת, את מוזמנת להתייעץ עם הצ'אטבוט החכם שלנו בפינת המסך.
          </p>
        </div>

        {/* Categories Loop */}
        <div className="space-y-20">
          {cosmeticsCategories.map((cat) => {
            const list = byCategory[cat.key] || [];
            return (
              <section key={cat.key} className="scroll-mt-24">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 border-r-4 border-primary pr-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{cat.title}</h2>
                    <p className="text-primary font-medium">{cat.subtitle}</p>
                  </div>
                  <p className="text-gray-500 max-w-md text-sm mt-2 md:mt-0 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                {list.length === 0 ? (
                  <div className="bg-white/50 border border-dashed border-gray-200 rounded-3xl p-10 text-center text-gray-400">
                    עדיין לא נוספו טיפולים לקטגוריה זו.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {list.map((t) => (
                      <TreatmentCard key={t.id} t={t} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Footer Info Box */}
        <div className="mt-20 bg-gray-900 rounded-[2rem] p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8">
          <div className="bg-white/10 p-4 rounded-2xl">
            <Info className="w-8 h-8 text-pink-300" />
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">צריכה עזרה בבחירת הטיפול?</h4>
            <p className="text-gray-400">
              מערכת הבינה המלאכותית שלנו למדה את כל הידע המקצועי של MeDay כדי לתת לך המלצה מדויקת לפי סוג העור והמטרות שלך.
            </p>
          </div>
          <button className="whitespace-nowrap bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-primary transition-all shadow-lg shadow-primary/20">
            התחילי ייעוץ עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}