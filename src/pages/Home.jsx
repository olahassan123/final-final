import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Heart, ShieldCheck } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-pink-50/50 to-white">
        <div className="container mx-auto px-6 text-center z-10 animate-in fade-in zoom-in duration-700">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-100 text-primary text-sm font-bold mb-8 shadow-sm">
            <Sparkles size={16} />
            <span>ברוכים הבאים ל-MeDay Beauty Center</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-serif font-bold text-gray-900 mb-6 leading-tight">
            העור שלך בידיים <br /> 
            <span className="text-primary italic">המקצועיות ביותר</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            גלי עולם של יופי ואסתטיקה מתקדמת. בעזרת טכנולוגיה חדישה וייעוץ חכם מבוסס AI, נתאים לך את הטיפול המושלם עבורך.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/treatments')}
              className="w-full sm:w-auto px-10 py-4 bg-gray-900 text-white rounded-full font-bold text-lg hover:bg-primary transition-all shadow-xl hover:shadow-primary/20 flex items-center justify-center gap-2"
            >
              לכל הטיפולים
              <ArrowLeft size={20} />
            </button>
            
            <button 
              onClick={() => {
                // כאן אפשר להוסיף לוגיקה שתפתח את ה-ChatWidget
                const chatBtn = document.querySelector('button[title="Ask MeDay"]');
                if (chatBtn) chatBtn.click();
              }}
              className="w-full sm:w-auto px-10 py-4 bg-white text-gray-900 border border-gray-200 rounded-full font-bold text-lg hover:bg-gray-50 transition-all"
            >
              התחילי ייעוץ AI
            </button>
          </div>
        </div>

        {/* אלמנטים עיצוביים ברקע */}
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-pink-200/30 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-pink-300/20 rounded-full blur-[100px]"></div>
      </section>

      {/* Quick Info Section */}
      <section className="py-20 container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center text-primary">
              <Heart size={32} />
            </div>
            <h3 className="text-xl font-bold">טיפול מותאם אישית</h3>
            <p className="text-gray-500">אנחנו לא רק מטפלים, אנחנו מאבחנים את הצרכים הייחודיים של העור שלך.</p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center text-primary">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold">בטיחות ומקצועיות</h3>
            <p className="text-gray-500">כל הטיפולים נבדקו ואושרו על פי הסטנדרטים הגבוהים ביותר.</p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center text-primary">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl font-bold">טכנולוגיה מתקדמת</h3>
            <p className="text-gray-500">שימוש במכשור החדיש ביותר בעולם הקוסמטיקה והלייזר.</p>
          </div>
        </div>
      </section>
    </div>
  );
}