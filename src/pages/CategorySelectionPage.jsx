import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { serviceCatalog } from "../data/serviceCatalog";
import makeupSlide from "../assets/makeup-professional.png";
import manicureSlide from "../assets/slide1.jpg";
import hairSlide from "../assets/slide2.jpg";
import cosmoSlide from "../assets/Como.jpg";
import eyebrowsSlide from "../assets/eyebrows.png";
import hairRemovalSlide from "../assets/hair-removal.png";
import aestheticSlide from "../assets/aesth.png";
import personalStylingSlide from "../assets/personal_styling.png";
import bodySlide from "../assets/body-treatments.png";

/* ── Unsplash photo per category ───────────────────────────────── */
const CATEGORY_PHOTOS = {
  "manicure-pedicure":      manicureSlide,
  "hair-design":            hairSlide,
  "body-treatments":        bodySlide,
  "cosmetology":            cosmoSlide,
  "hair-removal":           hairRemovalSlide,
  "professional-makeup":    makeupSlide,
  "permanent-makeup-brows": eyebrowsSlide,
  "personal-styling":       personalStylingSlide,
  "aesthetic-treatments":   aestheticSlide,
};

/* scrolling ticker items */
const TICKER = [
  "מניקור ופדיקור", "עיצוב שיער", "טיפולי קוסמטיקה",
  "טיפולי גוף", "הסרת שיעור", "איפור מקצועי",
  "איפור קבוע ועיצוב גבות", "סטיילינג אישי", "טיפולי אסתטיקה",
];

/* brand helpers */
function accent(i)   { return i % 2 === 0 ? "#4A9BA8" : "#C4795A"; }
function accentBg(i) { return i % 2 === 0 ? "rgba(74,155,168,0.10)" : "rgba(196,121,90,0.10)"; }

function treatmentCount(cat) {
  if (cat.treatments?.length) return cat.treatments.length;
  if (cat.sections?.length)
    return cat.sections.reduce((s, sec) => s + (sec.treatments?.length || 0), 0);
  return null;
}

/* ── Category Card ─────────────────────────────────────────────── */
function CategoryCard({ category, index }) {
  const navigate   = useNavigate();
  const photo      = CATEGORY_PHOTOS[category.slug];
  const count      = treatmentCount(category);
  const num        = String(index + 1).padStart(2, "0");
  const cardAccent = accent(index);
  const cardBg     = accentBg(index);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        onClick={() => navigate(`/categories/${category.slug}`)}
        className="group w-full text-right bg-white rounded-2xl overflow-hidden transition-all duration-300"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.09)", border: "1px solid rgba(232,196,160,0.45)" }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow   = `0 20px 48px rgba(0,0,0,0.13), 0 0 32px ${cardAccent}28`;
          e.currentTarget.style.transform   = "translateY(-7px)";
          e.currentTarget.style.borderColor = cardAccent;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow   = "0 4px 20px rgba(0,0,0,0.09)";
          e.currentTarget.style.transform   = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(232,196,160,0.45)";
        }}
      >
        {/* brand gradient top accent line */}
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #4A9BA8, #C4795A)" }} />

        {/* ── full-width image zone ── */}
        <div className="relative h-44 overflow-hidden bg-[#F5EFE8]">
          <img
            src={photo?.startsWith("photo-") ? `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=600&q=80` : photo}
            alt={category.name}
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            onError={e => { e.currentTarget.style.display = "none"; }}
          />
          {/* brand colour tint over the photo */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{ background: `${cardAccent}20`, mixBlendMode: "multiply" }}
          />
          {/* bottom fade into the tinted content zone */}
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, transparent, ${cardAccent}18)` }}
          />
          {/* number overlay */}
          <div className="absolute top-3 right-4 select-none pointer-events-none">
            <span
              className="font-black text-white leading-none"
              style={{ fontSize: "1.9rem", textShadow: "0 2px 10px rgba(0,0,0,0.40)", opacity: 0.88 }}
            >
              {num}
            </span>
          </div>
        </div>

        {/* ── text content zone — tinted to match card accent ── */}
        <div
          className="px-5 pt-3 pb-5"
          style={{ background: `linear-gradient(to bottom, ${cardAccent}09, ${cardAccent}03)` }}
        >
          <h2
            className="text-lg font-black mb-2 leading-snug"
            style={{ color: cardAccent }}
          >
            {category.name}
          </h2>

          {category.description && (
            <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-4">
              {category.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: `${cardAccent}22` }}>
            <span
              className="text-sm font-bold transition-all duration-200 group-hover:underline underline-offset-2"
              style={{ color: cardAccent }}
            >
              לצפייה בטיפולים
            </span>

            {count != null && count > 0 && (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: cardBg, color: cardAccent }}
              >
                {count} טיפולים
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function CategorySelectionPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }} dir="rtl">

      {/* ══ HERO — full-bleed photo ══ */}
      <section className="relative overflow-hidden" style={{ minHeight: "84vh" }}>

        {/* background photo */}
        <img
          src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1400&q=85"
          alt="MeDay Beauty Center"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* warm dark overlay — lighter in the middle, darker top+bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(22,11,4,0.68) 0%, rgba(22,11,4,0.32) 45%, rgba(22,11,4,0.72) 100%)",
          }}
        />
        {/* subtle coral tint bleeding from left (RTL: left = visual end) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(196,121,90,0.18) 0%, transparent 55%)" }}
        />

        {/* ── centred text content ── */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center px-6"
          style={{ minHeight: "84vh", paddingTop: "5rem" }}
        >
          {/* eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="font-bold tracking-[0.35em] uppercase mb-7 text-white/50"
            style={{ fontSize: "0.7rem" }}
          >
            ✦ MEDAY BEAUTY CENTER · TREATMENTS ✦
          </motion.p>

          {/* heading */}
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="font-black text-white leading-tight mb-6"
            style={{
              fontSize: "clamp(3.2rem, 7vw, 6.5rem)",
              textShadow: "0 4px 28px rgba(0,0,0,0.35)",
            }}
          >
            בחרי את
            <span
              className="block"
              style={{
                background:           "linear-gradient(135deg, #C4795A 0%, #E8C4A0 55%, #F2C4A0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
                filter:               "drop-shadow(0 4px 16px rgba(196,121,90,0.40))",
              }}
            >
              הטיפול שלך
            </span>
          </motion.h1>

          {/* subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-white/40 mb-10"
            style={{ fontSize: "clamp(0.95rem, 1.3vw, 1.1rem)" }}
          >
            {serviceCatalog.length} קטגוריות טיפולים — בחרי את שמתאים לך
          </motion.p>

          {/* diamond divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-4"
          >
            <div className="h-px w-16 bg-gradient-to-l from-white/30 to-transparent" />
            <div
              className="w-2.5 h-2.5 rounded-sm rotate-45"
              style={{ background: "linear-gradient(135deg, #4A9BA8, #C4795A)" }}
            />
            <div className="h-px w-16 bg-gradient-to-r from-white/30 to-transparent" />
          </motion.div>
        </div>

        {/* ── scrolling credential ticker ── */}
        <div
          className="absolute bottom-0 left-0 right-0 border-t border-white/10"
          style={{ background: "rgba(18,9,3,0.58)", backdropFilter: "blur(12px)" }}
        >
          <div className="py-3.5 overflow-hidden" dir="ltr">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
              className="flex items-center"
              style={{ width: "max-content" }}
            >
              {[...TICKER, ...TICKER].map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-4 px-6 text-white/45 font-bold tracking-[0.28em] uppercase whitespace-nowrap"
                  style={{ fontSize: "10px" }}
                >
                  <span style={{ color: "#C4795A", fontSize: "14px", opacity: 0.75 }}>·</span>
                  {item}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ CARDS GRID ══ */}
      <section
        className="px-6 pb-28 pt-14 relative overflow-hidden"
        style={{
          background: [
            /* thin dark fade at top — bridges from hero, fades out quickly */
            "linear-gradient(to bottom, rgba(22,11,4,0.82) 0%, rgba(22,11,4,0) 9%)",
            /* brand colour blooms on cream base — light, vivid */
            "radial-gradient(ellipse 100% 88% at 20% 8%,   rgba(196,121,90,0.46)  0%, transparent 100%)",
            "radial-gradient(ellipse 80%  70% at 75% 25%,  rgba(196,121,90,0.24)  0%, transparent 100%)",
            "radial-gradient(ellipse 70%  60% at 40% 65%,  rgba(232,196,160,0.22) 0%, transparent 100%)",
            "radial-gradient(ellipse 30%  20% at 85% 100%, rgba(74,155,168,0.42)  0%, transparent 100%)",
            "radial-gradient(ellipse 22%  16% at 15% 100%, rgba(74,155,168,0.26)  0%, transparent 100%)",
            "#FAF7F2",
          ].join(", "),
        }}
      >

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
          {serviceCatalog.map((category, i) => (
            <CategoryCard key={category.slug} category={category} index={i} />
          ))}
        </div>
      </section>

    </div>
  );
}
