import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { cosmeticSections } from "../data/cosmeticSections";

export default function TreatmentsListPage() {
  const location = useLocation();

  // أي فئة مفتوحة؟
  const [openSectionId, setOpenSectionId] = useState(
    cosmeticSections?.[0]?.id || null
  );

  // أي علاج مفتوح (لـ "לקרוא עוד")؟
  const [openTreatments, setOpenTreatments] = useState({});

  // إذا إجانا state من صفحة ثانية (اختياري)
  useEffect(() => {
    const target = location.state?.openSectionId;
    if (target) {
      setOpenSectionId(target);
      setTimeout(() => {
        const el = document.getElementById(target);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [location.state]);

  const toggleSection = (id) => {
    setOpenSectionId((prev) => (prev === id ? null : id));
  };

  const toggleTreatment = (id) => {
    setOpenTreatments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-secondary py-10 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-light text-primary text-sm font-bold mb-4">
            <Sparkles size={16} />
            <span>התפריט המלא</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-3">
            סוגי טיפולים
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            בחרי קטגוריה כדי לראות את הטיפולים שבתוכה.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {cosmeticSections.map((section) => {
            const isOpen = openSectionId === section.id;

            return (
              <div
                key={section.id}
                id={section.id}
                className="rounded-3xl overflow-hidden border border-accent-light bg-white/70"
              >
                {/* Section Header (click to open) */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-6 py-5 text-right hover:bg-white transition"
                >
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                      {section.title}
                    </h2>
                    {section.subtitle ? (
                      <p className="text-primary font-medium mt-1">
                        {section.subtitle}
                      </p>
                    ) : null}
                  </div>

                  <ChevronDown
                    className={`w-6 h-6 text-primary transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Section Body */}
                {isOpen ? (
                  <div className="px-6 pb-6">
                    <div className="h-px bg-accent-light mb-4" />

                    <ul className="space-y-6">
                      {section.treatments.map((t) => {
                        const expanded = !!openTreatments[t.id];
                        const linesToShow = expanded ? t.lines : t.lines.slice(0, 2);

                        return (
                          <li key={t.id} className="py-2">
                            <div className="flex flex-col md:flex-row gap-6">
                              {/* Treatment Image */}
                              {t.image && (
                                <div className="flex-shrink-0 relative">
                                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/10 rounded-xl"></div>
                                  <img
                                    src={t.image}
                                    alt={t.name}
                                    className="relative w-full md:w-48 h-32 md:h-32 object-cover rounded-xl shadow-md border-2 border-white"
                                  />
                                </div>
                              )}

                              {/* Treatment Content */}
                              <div className="flex-1">
                                {/* Treatment Title */}
                                <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 leading-tight">
                                  {t.name}
                                </h3>

                                {/* Treatment Text */}
                                <div className="mt-3 space-y-2 text-gray-700 leading-relaxed">
                                  {linesToShow.map((line, idx) => (
                                    <p key={idx}>{line}</p>
                                  ))}
                                </div>

                                {/* Read more */}
                                {t.lines.length > 2 ? (
                                  <button
                                    onClick={() => toggleTreatment(t.id)}
                                    className="mt-3 text-primary font-bold text-sm hover:underline"
                                  >
                                    {expanded ? "לסגור ▲" : "לקרוא עוד ▼"}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {/* Soft separator */}
                            <div className="mt-6 h-px bg-accent-light/70" />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}




