import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function CategorySelectionPage() {
  const navigate = useNavigate();

  // רשימת כל סוגי הטיפולים שביקשת
  const categories = [
    { id: 1, name: "מניקור ופדיקור" },
    { id: 2, name: "עיצוב שיער" },
    { id: 3, name: "טיפולי קוסמטיקה", target: "/treatments" }, // רק זה מוביל לעמוד הרשימה
    { id: 4, name: "טיפולי גוף" },
    { id: 5, name: "הסרת שיער" },
    { id: 6, name: "איפור מקצועי" },
    { id: 7, name: "איפור קבוע ועיצוב גבות" },
    { id: 8, name: "סטיילינג אישי" },
    { id: 9, name: "טיפולי אסתטיקה" },
  ];

  const handleCategoryClick = (category) => {
    if (category.target) {
      navigate(category.target);
    } else {
      alert(`העמוד עבור ${category.name} בבנייה...`);
    }
  };

  return (
    <div className="min-h-screen bg-[#fffafa] py-12 px-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* כותרת העמוד */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-100 text-primary text-sm font-bold mb-4">
            <Sparkles size={16} />
            <span>MeDay Beauty Center</span>
          </div>
          <h1 className="text-4xl font-serif font-bold text-gray-900">סוגי טיפולים</h1>
        </div>

        {/* רשימת כפתורי הקטגוריות */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className="group flex items-center justify-between p-6 bg-white border border-pink-100 rounded-2xl hover:shadow-lg hover:border-primary transition-all text-right"
            >
              <span className={`text-xl font-bold transition-colors ${category.target ? 'text-gray-900 group-hover:text-primary' : 'text-gray-400'}`}>
                {category.name}
              </span>
              <ArrowLeft className={`w-5 h-5 transition-transform group-hover:-translate-x-1 ${category.target ? 'text-primary' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}