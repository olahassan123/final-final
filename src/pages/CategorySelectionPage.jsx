import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Scissors, Heart, Star, Zap, Eye,
  Award, ShieldCheck, Brush, ArrowLeft, ChevronLeft,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import { serviceCatalog } from "../data/serviceCatalog";

/* ── per-category meta (icon + gradient + accent) ─────────────── */
const CATEGORY_META = {
  "manicure-pedicure":      { Icon: Sparkles,    gradient: "from-[#f9a8d4] to-[#ec4899]", accent: "#ec4899", bg: "#fdf2f8" },
  "hair-design":            { Icon: Scissors,    gradient: "from-[#c4b5fd] to-[#7c3aed]", accent: "#7c3aed", bg: "#f5f3ff" },
  "body-treatments":        { Icon: Heart,       gradient: "from-[#6ee7b7] to-[#059669]", accent: "#059669", bg: "#ecfdf5" },
  "cosmetology":            { Icon: Star,        gradient: "from-[#fca5a5] to-[#dc2626]", accent: "#dc2626", bg: "#fef2f2" },
  "hair-removal":           { Icon: Zap,         gradient: "from-[#93c5fd] to-[#2563eb]", accent: "#2563eb", bg: "#eff6ff" },
  "professional-makeup":    { Icon: Brush,       gradient: "from-[#fcd34d] to-[#d97706]", accent: "#d97706", bg: "#fffbeb" },
  "permanent-makeup-brows": { Icon: Eye,         gradient: "from-[#a5b4fc] to-[#4f46e5]", accent: "#4f46e5", bg: "#eef2ff" },
  "personal-styling":       { Icon: Award,       gradient: "from-[#f0abfc] to-[#a21caf]", accent: "#a21caf", bg: "#fdf4ff" },
  "aesthetic-treatments":   { Icon: ShieldCheck, gradient: "from-[#fde68a] to-[#b45309]", accent: "#b45309", bg: "#fffbeb" },
};

function treatmentCount(cat) {
  if (cat.treatments?.length) return cat.treatments.length;
  if (cat.sections?.length)
    return cat.sections.reduce((s, sec) => s + (sec.treatments?.length || 0), 0);
  return null;
}

/* ── 3D tilt category card ────────────────────────────────────── */
function CategoryCard({ category, index }) {
  const navigate = useNavigate();
  const meta = CATEGORY_META[category.slug] || {
    Icon: Sparkles,
    gradient: "from-[#C4795A] to-[#9B5C38]",
    accent: "#9B5C38",
    bg: "#FAF0E6",
  };
  const { Icon, gradient, accent, bg } = meta;
  const count = treatmentCount(category);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xS = useSpring(x, { stiffness: 140, damping: 18 });
  const yS = useSpring(y, { stiffness: 140, damping: 18 });
  const rotateX = useTransform(yS, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(xS, [-0.5, 0.5], ["-8deg", "8deg"]);

  function handleMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width  / 2) / r.width);
    y.set((e.clientY - r.top  - r.height / 2) / r.height);
  }

  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 55 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="group"
    >
      <button
        onClick={() => navigate(`/categories/${category.slug}`)}
        className="w-full text-right relative rounded-3xl overflow-hidden p-6 transition-shadow duration-300 group-hover:shadow-2xl"
        style={{ background: bg }}
      >
        {/* glass overlay */}
        <div className="absolute inset-0 rounded-3xl border border-white/60 bg-white/50 backdrop-blur-sm group-hover:bg-white/70 transition-colors duration-300" />

        {/* hover glow */}
        <div
          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(ellipse at 20% 20%, ${accent}18 0%, transparent 70%)` }}
        />

        {/* top-right shine */}
        <div
          className="absolute -top-8 -left-8 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle, ${accent}35 0%, transparent 70%)` }}
        />

        {/* content */}
        <div style={{ transform: "translateZ(22px)" }} className="relative z-10">
          <div className="flex items-start justify-between mb-5">
            {/* icon box */}
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
              style={{ boxShadow: `0 8px 20px ${accent}40` }}>
              <Icon size={26} className="text-white" />
            </div>

            {/* treatment count badge */}
            {count != null && count > 0 && (
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                {count} טיפולים
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 mb-2 leading-snug">
            {category.name}
          </h2>

          {category.description && (
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">
              {category.description}
            </p>
          )}

          {/* CTA row */}
          <div className="flex items-center justify-between mt-auto">
            <span
              className="text-sm font-bold transition-colors duration-200"
              style={{ color: accent }}
            >
              לצפייה בטיפולים
            </span>
            <motion.div
              animate={{ x: 0 }}
              whileHover={{ x: -4 }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${accent}15` }}
            >
              <ChevronLeft size={18} style={{ color: accent }} />
            </motion.div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

/* ── Floating decoration orb ──────────────────────────────────── */
function Orb({ className, style, delay = 0 }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{ y: [0, -18, 0], scale: [1, 1.06, 1] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
      style={style}
    />
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function CategorySelectionPage() {
  return (
    <div className="min-h-screen bg-[#FAF6F1]" dir="rtl">

      {/* ══ HERO HEADER ══ */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        {/* background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0E06] via-[#2C1A0A] to-[#FAF6F1]" />

        {/* decorative orbs */}
        <Orb className="w-80 h-80 bg-[#C4795A]/20 top-[-60px] right-[-60px]" delay={0} />
        <Orb className="w-64 h-64 bg-[#E8C4A0]/18 top-10 left-[-40px]"       delay={2} />
        <Orb className="w-48 h-48 bg-[#D4A882]/15 bottom-10 right-1/3"       delay={1} />

        {/* micro stars */}
        {[...Array(14)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/40"
            style={{ top: `${10 + Math.random() * 70}%`, left: `${Math.random() * 100}%` }}
            animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.6, 1] }}
            transition={{ duration: 2.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-bold mb-8"
          >
            <Sparkles size={14} className="text-[#C4795A]" />
            MeDay Beauty Center
            <Sparkles size={14} className="text-[#E8C4A0]" />
          </motion.div>

          {/* title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-7xl font-black text-white leading-tight mb-4"
          >
            בחרי את
            <span
              className="block"
              style={{
                background: "linear-gradient(135deg,#C4795A 0%,#E8C4A0 55%,#F2C4A0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              הטיפול שלך
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg text-white/55 max-w-md mx-auto"
          >
            {serviceCatalog.length} קטגוריות טיפולים — בחרי את שמתאים לך ✨
          </motion.p>
        </div>
      </section>

      {/* ══ CARDS GRID ══ */}
      <section className="px-6 pb-24 -mt-6">
        <div
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          style={{ perspective: "1200px" }}
        >
          {serviceCatalog.map((category, i) => (
            <CategoryCard key={category.slug} category={category} index={i} />
          ))}
        </div>
      </section>

    </div>
  );
}
