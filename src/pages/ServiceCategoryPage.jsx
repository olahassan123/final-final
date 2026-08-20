import { useEffect, useRef, useState } from "react";
import manicureSlide from "../assets/slide1.jpg";
import hairSlide from "../assets/slide2.jpg";
import cosmoSlide from "../assets/Como.jpg";
import bodySlide from "../assets/body-treatments.png";
import hairRemovalSlide from "../assets/hair-removal.png";
import makeupSlide from "../assets/makeup-professional.png";
import eyebrowsSlide from "../assets/eyebrows.png";
import personalStylingSlide from "../assets/personal_styling.png";
import aestheticSlide from "../assets/aesth.png";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import {
  ArrowRight, ChevronLeft, Sparkles, Scissors, Heart, Star,
  Zap, Eye, Award, ShieldCheck, Brush, LayoutGrid, Layers, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import { getCategoryBySlug, getCategoryTreatments } from "../data/serviceCatalog";
import { applyCategoryContent } from "../data/categoryContent";
import { fetchCategoryContent } from "../api/siteContentApi";

/* ── per-category hero photos ────────────────────────────────── */
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

const CATEGORY_EN = {
  "manicure-pedicure":      "MANICURE & PEDICURE",
  "hair-design":            "HAIR DESIGN",
  "body-treatments":        "BODY TREATMENTS",
  "cosmetology":            "COSMETOLOGY",
  "hair-removal":           "HAIR REMOVAL",
  "professional-makeup":    "PROFESSIONAL MAKEUP",
  "permanent-makeup-brows": "PERMANENT MAKEUP",
  "personal-styling":       "PERSONAL STYLING",
  "aesthetic-treatments":   "AESTHETIC TREATMENTS",
};

/* ── shared category meta (mirrors CategorySelectionPage) ─────── */
const CATEGORY_META = {
  "manicure-pedicure":      { Icon: Sparkles,    gradient: "from-[#f9a8d4] to-[#ec4899]", accent: "#ec4899", light: "#fdf2f8" },
  "hair-design":            { Icon: Scissors,    gradient: "from-[#c4b5fd] to-[#7c3aed]", accent: "#7c3aed", light: "#f5f3ff" },
  "body-treatments":        { Icon: Heart,       gradient: "from-[#6ee7b7] to-[#059669]", accent: "#059669", light: "#ecfdf5" },
  "cosmetology":            { Icon: Star,        gradient: "from-[#7dd3d8] to-[#4A9BA8]", accent: "#4A9BA8", light: "#EDF5F6" },
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
      id={`treatment-${treatment.slug}`}
      ref={ref}
      initial={{ opacity: 0, y: 45 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: (index % 6) * 0.09, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      className="scroll-mt-28 target:rounded-3xl target:ring-4 target:ring-[#4A9BA8]/40"
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

/* ── Cosmetology section — warm peach + teal bar style ────────── */
const SECTION_META = {
  "classic":          { eyebrow: "CLASSIC FACIALS"      },
  "pamper":           { eyebrow: "PAMPER & GLOW"        },
  "tech-special":     { eyebrow: "ADVANCED TECH"        },
  "special-events":   { eyebrow: "SPECIAL EVENTS"       },
  "everyday-styling": { eyebrow: "EVERYDAY & LESSONS"   },
};

function CosmeticSectionBlock({ section }) {
  const [openSlug, setOpenSlug] = useState(null);
  const meta = SECTION_META[section.slug] || SECTION_META["classic"];

  return (
    <div
      className="relative overflow-hidden"
      dir="rtl"
      style={{ isolation: "isolate", background: "#FBE9DC" }}
    >
      {/* ── teal title bar ── */}
      <div
        className="w-full px-10 py-5 flex items-center"
        style={{ background: "#4A9BA8" }}
      >
        <div className="flex-1 text-right">
          <span
            className="font-black text-white leading-tight block"
            style={{ fontSize: "clamp(1.25rem, 2.2vw, 1.7rem)" }}
          >
            {section.title}
          </span>
          <span
            className="font-medium text-white/75 block mt-0.5"
            style={{ fontSize: "0.85rem" }}
          >
            {section.subtitle}
          </span>
        </div>
      </div>

      {/* ── treatment rows — 2-column text layout ── */}
      <div className="px-10 py-8 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
        {section.treatments.map((treatment) => {
          const isOpen = openSlug === treatment.slug;
          const summary = (treatment.summary || "").trim();
          const detailLines = (treatment.details || [])
            .map((line) => (line || "").trim())
            .filter((line) => line && line !== summary);
          const contentLength = summary.length + detailLines.join(" ").length;
          const shouldCollapse = detailLines.length > 3 || contentLength > 280;
          return (
            <div
              id={`treatment-${treatment.slug}`}
              key={treatment.slug}
              className="scroll-mt-28 rounded-2xl text-right target:bg-white/60 target:p-4 target:ring-4 target:ring-[#4A9BA8]/40"
            >
              <h3
                className="font-black mb-2 leading-snug"
                style={{ fontSize: "clamp(1.2rem, 1.55vw, 1.38rem)", color: "#1A0E06" }}
              >
                {treatment.name}
              </h3>
              <p className="mb-3 text-base leading-8" style={{ color: "#5C4033" }}>
                {summary}
              </p>

              {/* expandable details */}
              <AnimatePresence initial={false}>
                {(!shouldCollapse || isOpen) && detailLines.length > 0 && (
                  <motion.div
                    initial={shouldCollapse ? { height: 0, opacity: 0 } : false}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="mb-4 space-y-2">
                      {detailLines.map((line, i) => (
                        <p key={i} className="text-base leading-8" style={{ color: "#5C4033" }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* read more toggle */}
              {shouldCollapse && (
                <button
                  onClick={() => setOpenSlug(isOpen ? null : treatment.slug)}
                  className="mb-4 inline-flex items-center gap-1 text-base font-semibold"
                  style={{ color: "#4A9BA8" }}
                >
                  <span>{isOpen ? "סגור ▲" : "לקרוא עוד ▼"}</span>
                </button>
              )}

              {/* CTA — bordered style */}
              <div>
                <a
                  href="https://wa.me/972"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-full transition-colors duration-200"
                  style={{
                    border: "2px solid #4A9BA8",
                    color: "#4A9BA8",
                    background: "transparent",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#4A9BA8";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#4A9BA8";
                  }}
                >
                  לתיאום תור
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Promo description block — light warm bg + coral heading ──── */
function PromoDescriptionBlock({ heading, subheading, paragraphs }) {
  return (
    <div
      className="relative overflow-hidden text-center"
      dir="rtl"
      style={{ background: "#FBF0E8" }}
    >
      {/* large ring watermarks — very subtle */}
      <div className="absolute pointer-events-none" style={{ bottom: "-120px", left: "-120px" }}>
        {[380, 280, 190, 110].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size, height: size,
              border: "28px solid rgba(196,121,90,0.09)",
              top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          />
        ))}
      </div>
      <div className="absolute pointer-events-none" style={{ top: "-100px", right: "-100px" }}>
        {[300, 210, 130].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size, height: size,
              border: "24px solid rgba(74,155,168,0.07)",
              top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          />
        ))}
      </div>

      <div
        className="relative z-10 mx-auto px-8"
        style={{ maxWidth: "820px", paddingTop: "5rem", paddingBottom: "5rem" }}
      >
        {/* decorative eyebrow line */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-14" style={{ background: "linear-gradient(to left, #C4795A, transparent)" }} />
          <span className="text-xs font-bold tracking-[0.3em] uppercase" style={{ color: "#C4795A" }}>
            ✦ MeDay Beauty ✦
          </span>
          <div className="h-px w-14" style={{ background: "linear-gradient(to right, #C4795A, transparent)" }} />
        </div>

        {/* coral heading — large & bold */}
        <h2
          className="font-black leading-snug mb-10"
          style={{
            fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
            color: "#C4795A",
            letterSpacing: "-0.01em",
          }}
        >
          {heading}
          {subheading && (
            <>
              <br />
              {subheading}
            </>
          )}
        </h2>

        {/* thin divider under heading */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="h-px flex-1" style={{ background: "rgba(196,121,90,0.2)" }} />
          <div className="w-2 h-2 rounded-sm rotate-45" style={{ background: "#C4795A", opacity: 0.5 }} />
          <div className="h-px flex-1" style={{ background: "rgba(196,121,90,0.2)" }} />
        </div>

        {/* paragraphs */}
        {paragraphs.map((para, i) => (
          <div key={i}>
            <p
              className="leading-loose mx-auto"
              style={{
                fontSize: "clamp(0.95rem, 1.1vw, 1.05rem)",
                color: "#5C3A22",
                maxWidth: "640px",
              }}
            >
              {para}
            </p>
            {i < paragraphs.length - 1 && (
              <div className="my-6 flex items-center justify-center gap-3">
                <div className="h-px w-10" style={{ background: "rgba(196,121,90,0.25)" }} />
                <span style={{ color: "#C4795A", fontSize: "0.9rem" }}>◆</span>
                <div className="h-px w-10" style={{ background: "rgba(196,121,90,0.25)" }} />
              </div>
            )}
          </div>
        ))}

        {/* CTA */}
        <div className="mt-12">
          <a
            href="https://wa.me/972"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-9 py-3.5 font-bold text-white rounded-full transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #4A9BA8, #3A7E8A)", fontSize: "1rem", boxShadow: "0 6px 22px rgba(74,155,168,0.30)" }}
          >
            לתיאום תור
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────── */
export default function ServiceCategoryPage() {
  const { categorySlug } = useParams();
  const { hash } = useLocation();

  // What the admin saved under "ניהול תוכן", if anything. The slug is stored
  // alongside the result so a stale answer for the previous category is never
  // treated as this one's; a null content means the category was never
  // customised and keeps what ships in serviceCatalog.js.
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCategoryContent(categorySlug).then((content) => {
      if (!cancelled) setLoaded({ slug: categorySlug, content });
    });
    return () => { cancelled = true; };
  }, [categorySlug]);

  const contentReady = loaded?.slug === categorySlug;
  const category = applyCategoryContent(
    getCategoryBySlug(categorySlug),
    contentReady ? loaded.content : null
  );

  useEffect(() => {
    if (!hash || !contentReady) return;
    const targetId = decodeURIComponent(hash.slice(1));
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [categorySlug, hash, contentReady]);

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
  const shouldOpenSingleTreatment = contentReady && !hasSectionLayout && treatments.length === 1;

  if (shouldOpenSingleTreatment) {
    return <Navigate to={`/categories/${category.slug}/${treatments[0].slug}`} replace />;
  }

  const { Icon, gradient, accent, light } = getMeta(categorySlug);
  const totalCount = treatments.length;

  return (
    <div className="min-h-screen bg-[#FAF7F2]" dir="rtl">

      {/* ══ HERO HEADER ══ */}
      <section className="relative overflow-hidden" style={{ minHeight: "52vh" }}>

        {/* full-bleed category photo */}
        <img
          src={(() => { const p = CATEGORY_PHOTOS[categorySlug] || "photo-1570172619644-dfd03ed5d881"; return p.startsWith?.("photo-") ? `https://images.unsplash.com/${p}?auto=format&fit=crop&w=1400&q=85` : p; })()}
          alt={category.name}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* warm light overlay — keeps image visible but brightens for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(253,248,244,0.22) 0%, rgba(253,248,244,0.52) 55%, rgba(253,248,244,0.88) 100%)",
          }}
        />

        {/* centred content */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center px-6"
          style={{ minHeight: "52vh", paddingTop: "5rem" }}
        >
          {/* breadcrumb */}
          <Link
            to="/categories"
            className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-opacity hover:opacity-70"
            style={{ color: "#9B5C38" }}
          >
            <ArrowRight size={15} />
            כל הקטגוריות
          </Link>

          {/* English name — coral watermark style */}
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="font-black uppercase tracking-[0.18em] mb-1"
            style={{ fontSize: "clamp(1.3rem, 3.2vw, 2.8rem)", color: "#E8825A" }}
          >
            {CATEGORY_EN[categorySlug] || category.name.toUpperCase()}
            <span className="ml-3" style={{ color: "#C4795A" }}>✦✦</span>
          </motion.p>

          {/* Hebrew title — large dark teal */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="font-black leading-tight"
            style={{
              fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
              color: "#3A7E8A",
              textShadow: "0 2px 28px rgba(253,248,244,0.80)",
            }}
          >
            {category.name}
          </motion.h1>
        </div>
      </section>


      {/* ══ TREATMENTS ══ */}
      <section className={category.promoHeading ? "" : "pb-24"}>

        {!contentReady ? (
          /* Nothing until the override lookup settles — otherwise the built-in
             content paints first and visibly swaps for the admin's version. */
          <div className="py-24 text-center text-sm font-semibold" style={{ color: "#9B5C38" }}>
            טוען…
          </div>

        ) : category.promoHeading ? (
          <PromoDescriptionBlock
            heading={category.promoHeading}
            subheading={category.promoSubheading}
            paragraphs={category.promoParagraphs || []}
          />
        ) : hasSectionLayout ? (
          <div className="space-y-6">
            {category.sections.map((section) => (
              <CosmeticSectionBlock
                key={section.slug}
                section={section}
              />
            ))}
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
