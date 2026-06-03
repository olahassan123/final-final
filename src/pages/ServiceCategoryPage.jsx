import { useRef } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowRight, ChevronLeft, Sparkles, Scissors, Heart, Star,
  Zap, Eye, Award, ShieldCheck, Brush, LayoutGrid, Layers,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import { getCategoryBySlug, getCategoryTreatments } from "../data/serviceCatalog";
import SkinAnalysisWidget from "../components/SkinAnalysisWidget";

/* ── shared category meta (mirrors CategorySelectionPage) ─────── */
const CATEGORY_META = {
  "manicure-pedicure":      { Icon: Sparkles,    gradient: "from-[#f9a8d4] to-[#ec4899]", accent: "#ec4899", light: "#fdf2f8" },
  "hair-design":            { Icon: Scissors,    gradient: "from-[#c4b5fd] to-[#7c3aed]", accent: "#7c3aed", light: "#f5f3ff" },
  "body-treatments":        { Icon: Heart,       gradient: "from-[#6ee7b7] to-[#059669]", accent: "#059669", light: "#ecfdf5" },
  "cosmetology":            { Icon: Star,        gradient: "from-[#fca5a5] to-[#dc2626]", accent: "#dc2626", light: "#fef2f2" },
  "hair-removal":           { Icon: Zap,         gradient: "from-[#93c5fd] to-[#2563eb]", accent: "#2563eb", light: "#eff6ff" },
  "professional-makeup":    { Icon: Brush,       gradient: "from-[#fcd34d] to-[#d97706]", accent: "#d97706", light: "#fffbeb" },
  "permanent-makeup-brows": { Icon: Eye,         gradient: "from-[#a5b4fc] to-[#4f46e5]", accent: "#4f46e5", light: "#eef2ff" },
  "personal-styling":       { Icon: Award,       gradient: "from-[#f0abfc] to-[#a21caf]", accent: "#a21caf", light: "#fdf4ff" },
  "aesthetic-treatments":   { Icon: ShieldCheck, gradient: "from-[#fde68a] to-[#b45309]", accent: "#b45309", light: "#fffbeb" },
};

function getMeta(slug) {
  return CATEGORY_META[slug] || {
    Icon: Layers, gradient: "from-[#C4795A] to-[#9B5C38]", accent: "#9B5C38", light: "#FAF0E6",
  };
}

/* ── 3-D tilt treatment card ──────────────────────────────────── */
function TreatmentLinkCard({ categorySlug, treatment, sectionTitle, index, accent, light }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xS = useSpring(x, { stiffness: 140, damping: 18 });
  const yS = useSpring(y, { stiffness: 140, damping: 18 });
  const rotateX = useTransform(yS, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(xS, [-0.5, 0.5], ["-7deg", "7deg"]);

  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-50px" });

  function handleMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width  / 2) / r.width);
    y.set((e.clientY - r.top  - r.height / 2) / r.height);
  }

  const variantCount = treatment.variants?.length || 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 45 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: (index % 6) * 0.09, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
      <Link
        to={`/categories/${categorySlug}/${treatment.slug}`}
        className="group block relative rounded-3xl overflow-hidden transition-shadow duration-300 hover:shadow-2xl"
        style={{ background: light }}
      >
        {/* glass base */}
        <div className="absolute inset-0 rounded-3xl border border-white/70 bg-white/60 backdrop-blur-sm group-hover:bg-white/80 transition-colors duration-300" />

        {/* accent glow on hover */}
        <div
          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-400"
          style={{ background: `radial-gradient(ellipse at 10% 10%, ${accent}20 0%, transparent 65%)` }}
        />

        {/* left accent bar */}
        <div
          className="absolute top-4 bottom-4 right-0 w-1 rounded-l-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(to bottom, ${accent}cc, ${accent}44)` }}
        />

        <div style={{ transform: "translateZ(18px)" }} className="relative z-10 p-6 flex items-start gap-4">
          <div className="flex-1 text-right space-y-2">
            {sectionTitle && (
              <span
                className="inline-flex text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                {sectionTitle}
              </span>
            )}

            <h3 className="text-xl font-extrabold text-gray-900 transition-colors duration-200 group-hover:text-gray-800 leading-snug">
              {treatment.name}
            </h3>

            <p className="text-sm text-gray-500 leading-6 line-clamp-2">
              {treatment.summary || "עמוד הטיפול מוכן לצפייה."}
            </p>

            {variantCount > 0 && (
              <p className="text-xs font-semibold" style={{ color: accent }}>
                {variantCount} וריאנטים
              </p>
            )}
          </div>

          {/* arrow */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${accent}18` }}
          >
            <ChevronLeft size={20} style={{ color: accent }} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── section block (for cosmetology layout) ───────────────────── */
function SectionBlock({ section, categorySlug, accent, light, baseIndex }) {
  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl overflow-hidden"
      style={{ background: light }}
    >
      {/* section header */}
      <div
        className="px-7 py-5 border-b border-white/50"
        style={{ background: `${accent}12` }}
      >
        <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
        {section.subtitle && (
          <p className="text-sm mt-1" style={{ color: accent }}>{section.subtitle}</p>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ perspective: "1000px" }}>
        {section.treatments.map((treatment, i) => (
          <TreatmentLinkCard
            key={treatment.slug}
            categorySlug={categorySlug}
            treatment={treatment}
            sectionTitle={section.title}
            index={baseIndex + i}
            accent={accent}
            light="rgba(255,255,255,0.6)"
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ── page ─────────────────────────────────────────────────────── */
export default function ServiceCategoryPage() {
  const { categorySlug } = useParams();
  const category = getCategoryBySlug(categorySlug);

  if (!category) {
    return (
      <div className="min-h-screen bg-[#fdf8ff] px-6 py-16" dir="rtl">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-sm border border-red-100">
          <h1 className="text-3xl font-bold text-gray-900">הקטגוריה לא נמצאה</h1>
          <p className="mt-4 text-gray-500">אפשר לחזור למסך הקטגוריות ולבחור טיפול אחר.</p>
          <Link to="/categories" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#e8a5b5] px-6 py-3 font-bold text-white">
            <ArrowRight size={18} /> חזרה לקטגוריות
          </Link>
        </div>
      </div>
    );
  }

  const treatments = getCategoryTreatments(category);
  const hasSectionLayout = Boolean(category.sections?.length);
  const shouldOpenSingleTreatment = !hasSectionLayout && treatments.length === 1;

  if (shouldOpenSingleTreatment) {
    return <Navigate to={`/categories/${category.slug}/${treatments[0].slug}`} replace />;
  }

  const { Icon, gradient, accent, light } = getMeta(categorySlug);
  const totalCount = treatments.length;

  return (
    <div className="min-h-screen bg-[#fdf8ff]" dir="rtl">

      {/* ══ HERO HEADER ══ */}
      <section className="relative overflow-hidden pb-16 pt-20 px-6">
        {/* background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#12090f] via-[#1e0d28] to-[#fdf8ff]" />

        {/* color glow matching this category */}
        <div
          className="absolute top-0 right-1/3 w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none"
          style={{ background: `${accent}22` }}
        />
        <div
          className="absolute top-10 left-1/4 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: `${accent}14` }}
        />

        {/* micro stars */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/35"
            style={{ top: `${10 + Math.random() * 65}%`, left: `${Math.random() * 100}%` }}
            animate={{ opacity: [0.15, 0.8, 0.15] }}
            transition={{ duration: 2.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* breadcrumb */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/categories"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 text-sm font-medium transition-colors mb-8"
            >
              <ArrowRight size={16} />
              כל הקטגוריות
            </Link>
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              {/* badge */}
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 text-sm font-bold mb-6"
              >
                <Sparkles size={14} className="text-[#e8a5b5]" />
                MeDay Beauty Center
              </motion.div>

              {/* icon + title */}
              <motion.div
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-5"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl flex-shrink-0`}
                  style={{ boxShadow: `0 12px 30px ${accent}55` }}>
                  <Icon size={30} className="text-white" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white leading-tight">
                  {category.name}
                </h1>
              </motion.div>

              {category.description && (
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3 }}
                  className="mt-5 text-white/50 max-w-2xl leading-relaxed"
                >
                  {category.description}
                </motion.p>
              )}
            </div>

            {/* count badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.35, type: "spring" }}
              className="flex-shrink-0 rounded-2xl px-7 py-5 text-center backdrop-blur-sm border border-white/10"
              style={{ backgroundColor: `${accent}20` }}
            >
              <div className="flex items-center gap-3">
                <LayoutGrid size={22} style={{ color: accent }} />
                <div className="text-right">
                  <p className="text-3xl font-black text-white">{totalCount}</p>
                  <p className="text-xs font-semibold text-white/60">טיפולים זמינים</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ SKIN ANALYSIS (cosmetology only) ══ */}
      {categorySlug === "cosmetology" && (
        <div className="px-6 -mt-4 mb-4 max-w-5xl mx-auto">
          <SkinAnalysisWidget />
        </div>
      )}

      {/* ══ TREATMENTS ══ */}
      <section className="px-6 pb-24 -mt-4 max-w-5xl mx-auto">

        {hasSectionLayout ? (
          <div className="space-y-6">
            {category.sections.map((section, si) => {
              const baseIndex = category.sections.slice(0, si).reduce((acc, s) => acc + s.treatments.length, 0);
              return (
                <SectionBlock
                  key={section.slug}
                  section={section}
                  categorySlug={category.slug}
                  accent={accent}
                  light={light}
                  baseIndex={baseIndex}
                />
              );
            })}
          </div>

        ) : treatments.length > 0 ? (
          <div
            className="grid grid-cols-1 gap-5 lg:grid-cols-2"
            style={{ perspective: "1100px" }}
          >
            {treatments.map((t, i) => (
              <TreatmentLinkCard
                key={t.slug}
                categorySlug={category.slug}
                treatment={t}
                index={i}
                accent={accent}
                light={light}
              />
            ))}
          </div>

        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl border-2 border-dashed bg-white/60 p-14 text-center"
            style={{ borderColor: `${accent}40` }}
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ backgroundColor: `${accent}18` }}
            >
              <Icon size={28} style={{ color: accent }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">הקטגוריה מוכנה למילוי</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              ברגע שנוסיף את הטיפולים לקטגוריה הזאת הם יופיעו כאן.
            </p>
          </motion.div>
        )}
      </section>

    </div>
  );
}
