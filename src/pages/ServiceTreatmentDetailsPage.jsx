import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight, Clock, MessageCircle, ShieldCheck, Sparkles,
  Stethoscope, CheckCircle2, CalendarDays, ChevronRight,
  Scissors, Heart, Star, Zap, Eye, Award, Brush, Layers,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import { getTreatmentBySlugs } from "../data/serviceCatalog";

/* ── category meta ────────────────────────────────────────────── */
const CATEGORY_META = {
  "manicure-pedicure":      { gradient: "from-[#f9a8d4] to-[#ec4899]", accent: "#ec4899", light: "#fdf2f8" },
  "hair-design":            { gradient: "from-[#c4b5fd] to-[#7c3aed]", accent: "#7c3aed", light: "#f5f3ff" },
  "body-treatments":        { gradient: "from-[#6ee7b7] to-[#059669]", accent: "#059669", light: "#ecfdf5" },
  "cosmetology":            { gradient: "from-[#fca5a5] to-[#dc2626]", accent: "#dc2626", light: "#fef2f2" },
  "hair-removal":           { gradient: "from-[#93c5fd] to-[#2563eb]", accent: "#2563eb", light: "#eff6ff" },
  "professional-makeup":    { gradient: "from-[#fcd34d] to-[#d97706]", accent: "#d97706", light: "#fffbeb" },
  "permanent-makeup-brows": { gradient: "from-[#a5b4fc] to-[#4f46e5]", accent: "#4f46e5", light: "#eef2ff" },
  "personal-styling":       { gradient: "from-[#f0abfc] to-[#a21caf]", accent: "#a21caf", light: "#fdf4ff" },
  "aesthetic-treatments":   { gradient: "from-[#fde68a] to-[#b45309]", accent: "#b45309", light: "#fffbeb" },
};
function getMeta(slug) {
  return CATEGORY_META[slug] || { gradient: "from-[#C4795A] to-[#9B5C38]", accent: "#9B5C38", light: "#FAF0E6" };
}

/* ── info row ─────────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, accent }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 border-b py-4 last:border-b-0" style={{ borderColor: `${accent}20` }}>
      <div className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}18` }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div className="space-y-1 text-right">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-sm leading-7 text-gray-500">{value}</p>
      </div>
    </div>
  );
}

/* ── 3-D tilt variant card ────────────────────────────────────── */
function VariantCard({ variant, treatmentName, index, accent, light }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xS = useSpring(x, { stiffness: 130, damping: 17 });
  const yS = useSpring(y, { stiffness: 130, damping: 17 });
  const rotateX = useTransform(yS, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(xS, [-0.5, 0.5], ["-7deg", "7deg"]);

  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-40px" });

  function handleMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width  / 2) / r.width);
    y.set((e.clientY - r.top  - r.height / 2) / r.height);
  }

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="group relative rounded-3xl overflow-hidden transition-shadow duration-300 hover:shadow-2xl"
    >
      {/* glass base */}
      <div className="absolute inset-0 rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl group-hover:bg-white/90 transition-colors duration-300" />

      {/* hover glow */}
      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{ background: `radial-gradient(ellipse at 15% 15%, ${accent}1a 0%, transparent 65%)` }}
      />

      {/* accent top bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${accent === "#ec4899" ? "from-[#f9a8d4] to-[#ec4899]" : ""} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        style={{ background: `linear-gradient(to left, ${accent}cc, ${accent}44)` }}
      />

      <div style={{ transform: "translateZ(20px)" }} className="relative z-10 p-6 space-y-4 text-right">
        {/* variant name */}
        <h3 className="text-xl font-extrabold" style={{ color: accent }}>
          {variant.name}
        </h3>

        {variant.description && (
          <p className="text-sm text-gray-600 leading-7">{variant.description}</p>
        )}

        {/* detail lines */}
        {variant.details?.length > 0 && (
          <ul className="space-y-2">
            {variant.details.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        {/* info box */}
        {(variant.idealFor || variant.results || variant.aftercare || variant.frequency || variant.consultation) && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: `${accent}0d` }}
          >
            {variant.idealFor && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">למי זה מתאים</p>
                <p className="text-xs text-gray-500 leading-5">{variant.idealFor}</p>
              </div>
            )}
            {variant.results && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">תוצאות</p>
                <p className="text-xs text-gray-500 leading-5">{variant.results}</p>
              </div>
            )}
            {variant.aftercare && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">לאחר הטיפול</p>
                <p className="text-xs text-gray-500 leading-5">{variant.aftercare}</p>
              </div>
            )}
            {(variant.frequency || variant.consultation) && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">
                  {variant.frequency ? "תדירות" : "הערה"}
                </p>
                <p className="text-xs text-gray-500 leading-5">{variant.frequency || variant.consultation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}

/* ── animated section wrapper ─────────────────────────────────── */
function RevealSection({ children, delay = 0 }) {
  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 35 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── page ─────────────────────────────────────────────────────── */
export default function ServiceTreatmentDetailsPage() {
  const { categorySlug, treatmentSlug } = useParams();
  const { category, treatment } = getTreatmentBySlugs(categorySlug, treatmentSlug);
  const { gradient, accent, light } = getMeta(categorySlug);

  useEffect(() => {
    if (!treatment) return;
    window.dispatchEvent(new CustomEvent("treatmentSelected", {
      detail: { id: `${categorySlug}:${treatment.slug}`, name: treatment.name },
    }));
  }, [categorySlug, treatment?.name, treatment?.slug]);

  if (!category || !treatment) {
    return (
      <div className="min-h-screen bg-[#fdf8ff] px-6 py-16" dir="rtl">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-sm border border-red-100">
          <h1 className="text-3xl font-bold text-gray-900">דף הטיפול לא נמצא</h1>
          <p className="mt-4 text-gray-500">אפשר לחזור לקטגוריה ולבחור טיפול אחר.</p>
          <Link to="/categories" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#e8a5b5] px-6 py-3 font-bold text-white">
            <ArrowRight size={18} /> חזרה לקטגוריות
          </Link>
        </div>
      </div>
    );
  }

  const openChat = () => {
    window.dispatchEvent(new CustomEvent("openChatWithQuestion", {
      detail: `אני רוצה לשאול על טיפול ${treatment.name}`,
    }));
  };

  return (
    <div className="min-h-screen bg-[#fdf8ff]" dir="rtl">

      {/* ══ HERO HEADER ══ */}
      <section className="relative overflow-hidden pb-20 pt-20 px-6">
        {/* dark base */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#12090f] via-[#1e0d28] to-[#fdf8ff]" />

        {/* category-colored glow */}
        <div className="absolute top-0 right-1/4 w-[550px] h-[400px] rounded-full blur-[130px] pointer-events-none"
          style={{ background: `${accent}20` }} />
        <div className="absolute top-10 left-1/3 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: `${accent}12` }} />

        {/* micro stars */}
        {[...Array(10)].map((_, i) => (
          <motion.div key={i}
            className="absolute w-1 h-1 rounded-full bg-white/35"
            style={{ top: `${10 + Math.random() * 65}%`, left: `${Math.random() * 100}%` }}
            animate={{ opacity: [0.15, 0.85, 0.15] }}
            transition={{ duration: 2.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* breadcrumb */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center gap-2 text-sm text-white/40 mb-8"
          >
            <Link to="/categories" className="hover:text-white/70 transition-colors">כל הקטגוריות</Link>
            <ChevronRight size={14} />
            <Link to={`/categories/${category.slug}`} className="hover:text-white/70 transition-colors">{category.name}</Link>
            <ChevronRight size={14} />
            <span className="text-white/70">{treatment.name}</span>
          </motion.div>

          {/* category badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 text-sm font-bold mb-5"
          >
            <Sparkles size={13} style={{ color: accent }} />
            {category.name}
          </motion.div>

          {/* treatment name */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-6xl font-black text-white leading-tight mb-5"
          >
            {treatment.name}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="text-white/50 max-w-2xl leading-relaxed text-base"
          >
            {treatment.summary || treatment.description}
          </motion.p>
        </div>
      </section>

      {/* ══ MAIN CONTENT ══ */}
      <div className="px-6 pb-24 max-w-5xl mx-auto -mt-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-7">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-6">

            {/* About */}
            <RevealSection>
              <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-xl p-8 text-right">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3 justify-end">
                  על הטיפול
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${accent}18` }}>
                    <Sparkles size={16} style={{ color: accent }} />
                  </div>
                </h2>

                {treatment.details?.length > 0 && (
                  <ul className="space-y-3 mb-6">
                    {treatment.details.map((line, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-600 leading-7">
                        <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {(treatment.description && !treatment.details?.length) && (
                  <p className="text-gray-600 leading-8 mb-6">{treatment.description}</p>
                )}

                <div className="space-y-0 mt-4">
                  <InfoRow icon={Stethoscope} label="למי זה מתאים"     value={treatment.idealFor}  accent={accent} />
                  <InfoRow icon={Sparkles}    label="תוצאות"            value={treatment.results}   accent={accent} />
                  <InfoRow icon={ShieldCheck} label="הנחיות לאחר טיפול" value={treatment.aftercare} accent={accent} />
                  <InfoRow icon={Clock}       label="תדירות מומלצת"     value={treatment.frequency} accent={accent} />
                </div>
              </div>
            </RevealSection>

            {/* Variants */}
            {treatment.variants?.length > 0 && (
              <RevealSection delay={0.1}>
                <div className="rounded-3xl bg-white/60 backdrop-blur-sm border border-white/60 p-7 text-right">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">סוגי הטיפול</h2>
                  <p className="text-sm text-gray-400 mb-7">
                    כל האפשרויות של {treatment.name} מרוכזות כאן
                  </p>

                  <div
                    className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                    style={{ perspective: "1100px" }}
                  >
                    {treatment.variants.map((variant, i) => (
                      <VariantCard
                        key={`${treatment.slug}-${variant.name}`}
                        variant={variant}
                        treatmentName={treatment.name}
                        index={i}
                        accent={accent}
                        light={light}
                      />
                    ))}
                  </div>
                </div>
              </RevealSection>
            )}

          </div>

          {/* ── SIDEBAR ── */}
          <aside className="space-y-5">

            {/* Booking card */}
            <RevealSection delay={0.2}>
              <div
                className="relative rounded-3xl overflow-hidden p-7 text-white text-right shadow-2xl"
                style={{ background: `linear-gradient(135deg, #12090f 0%, #1e0d28 100%)` }}
              >
                {/* glow inside */}
                <div className="absolute top-0 left-0 right-0 h-32 rounded-t-3xl"
                  style={{ background: `radial-gradient(ellipse at 50% -30%, ${accent}35, transparent 70%)` }} />

                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center"
                    style={{ backgroundColor: `${accent}25`, boxShadow: `0 0 20px ${accent}35` }}>
                    <CalendarDays size={22} style={{ color: accent }} />
                  </div>

                  <h3 className="text-xl font-bold mb-2">MeDay Tip</h3>
                  <p className="text-sm leading-7 text-white/60 mb-6">
                    {treatment.consultation ||
                      "לייעוץ מותאם אישית ותיאום מועד הטיפול המושלם עבורך — אנחנו כאן."}
                  </p>

                  <div className="space-y-3">
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: `0 0 25px ${accent}55` }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full rounded-full py-3.5 font-bold text-white text-sm transition-all"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}
                    >
                      תיאום תור ←
                    </motion.button>

                    <button
                      onClick={openChat}
                      className="w-full flex items-center justify-center gap-2 rounded-full border py-3.5 font-bold text-white/80 text-sm hover:bg-white/10 transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.15)" }}
                    >
                      <MessageCircle size={17} />
                      שאלי את ה-AI על הטיפול
                    </button>
                  </div>
                </div>
              </div>
            </RevealSection>

            {/* FAQ */}
            <RevealSection delay={0.3}>
              <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-xl p-7 text-right">
                <h3 className="text-lg font-bold text-gray-900 mb-4">שאלות נפוצות</h3>

                {treatment.faq?.length > 0 ? (
                  <div className="space-y-4">
                    {treatment.faq.map((item, i) => (
                      <motion.div
                        key={item.question}
                        initial={{ opacity: 0, x: 15 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-2xl p-4"
                        style={{ backgroundColor: `${accent}0d` }}
                      >
                        <p className="font-bold text-gray-800 text-sm mb-1">{item.question}</p>
                        <p className="text-xs text-gray-500 leading-6">{item.answer}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 leading-6">
                    עדיין אין שאלות נפוצות לטיפול הזה.
                  </p>
                )}
              </div>
            </RevealSection>

            {/* back link */}
            <RevealSection delay={0.35}>
              <Link
                to={`/categories/${category.slug}`}
                className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:shadow-md"
                style={{ backgroundColor: `${accent}12`, color: accent }}
              >
                <ArrowRight size={16} />
                חזרה ל-{category.name}
              </Link>
            </RevealSection>

          </aside>
        </div>
      </div>

    </div>
  );
}
