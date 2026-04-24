import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Heart, ShieldCheck } from 'lucide-react';
import HeroSlideshow from '../components/HeroSlideshow';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary" dir="rtl">
      {/* Hero Section - Asymmetrical Layout */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-secondary via-accent-light/20 to-secondary">
        <div className="w-full container mx-auto px-6 py-16 md:py-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Side - Content */}
            <div className="order-2 lg:order-1 z-10 animate-in fade-in slide-in-from-left duration-700">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-primary-dark text-sm font-bold mb-8 border border-primary/30">
                <Sparkles size={16} />
                <span>MeDay Beauty Center</span>
              </div>

              <h1 className="text-6xl md:text-7xl font-black text-gray-900 mb-6 leading-tight tracking-tight">
                העור שלך <br /> 
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">בידיים מקצועיות</span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-700 mb-10 leading-relaxed font-light max-w-lg">
                טכנולוגיה חדישה + AI חכם + ידיים מנוסות = התוצאה המושלמת עבורך ✨
              </p>

              {/* Buttons - Unique Placement */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button 
                  onClick={() => navigate('/categories')}
                  className="group px-8 py-4 bg-primary-dark text-white rounded-full font-bold text-lg hover:bg-primary transition-all shadow-lg hover:shadow-primary/40 hover:-translate-y-1 duration-300 flex items-center justify-center gap-3 flex-1 sm:flex-auto"
                >
                  <span>לכל הטיפולים</span>
                  <ArrowLeft size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button 
                  onClick={() => {
                    const chatBtn = document.querySelector('button[title="Ask MeDay"]');
                    if (chatBtn) chatBtn.click();
                  }}
                  className="group px-8 py-4 bg-accent-light text-primary-dark rounded-full font-bold text-lg border-2 border-primary-dark hover:bg-primary hover:text-white transition-all shadow-lg hover:shadow-primary/40 hover:-translate-y-1 duration-300 flex items-center justify-center gap-2 flex-1 sm:flex-auto"
                >
                  <span>התחילי AI</span>
                  <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                </button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-col gap-3 text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">משך טיפול ממוצע: 30-60 דקות</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="font-medium">ייעוץ AI בחינם לכל גראות</span>
                </div>
              </div>
            </div>

            {/* Right Side - Slideshow */}
            <div className="order-1 lg:order-2 z-10 animate-in fade-in slide-in-from-right duration-700">
              <div className="relative">
                <HeroSlideshow />
                {/* Decorative elements */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-accent rounded-3xl opacity-20 blur-xl"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-primary rounded-3xl opacity-10 blur-xl"></div>
              </div>
            </div>

          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-1 h-1/2 bg-gradient-to-b from-primary/20 to-transparent opacity-30"></div>
      </section>

      {/* Quick Info Section */}
      <section className="py-20 bg-secondary container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center text-primary-dark">
              <Heart size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">טיפול מותאם אישית</h3>
            <p className="text-gray-600">אנחנו לא רק מטפלים, אנחנו מאבחנים את הצרכים הייחודיים של העור שלך.</p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center text-primary-dark">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">בטיחות ומקצועיות</h3>
            <p className="text-gray-600">כל הטיפולים נבדקו ואושרו על פי הסטנדרטים הגבוהים ביותר.</p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center text-primary-dark">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">טכנולוגיה מתקדמת</h3>
            <p className="text-gray-600">שימוש במכשור החדיש ביותר בעולם הקוסמטיקה והלייזר.</p>
          </div>
        </div>
      </section>
    </div>
  );
}