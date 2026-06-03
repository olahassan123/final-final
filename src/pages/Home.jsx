import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useInView } from 'framer-motion';
import { Sparkles, ArrowLeft, Heart, ShieldCheck, Zap, Star } from 'lucide-react';

/* ─── Scan Box ─────────────────────────────────────────────────── */
function ScanBox({ x, y, label, delay = 0, size = 52 }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      <motion.div
        style={{ width: size, height: size }}
        className="relative"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 2.6 + delay * 0.3, ease: 'easeInOut' }}
      >
        <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-white/90" />
        <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-white/90" />
        <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white/90" />
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white/90" />
        <motion.div
          className="absolute left-1 right-1 h-px bg-gradient-to-r from-transparent via-[#C4795A] to-transparent"
          animate={{ top: ['12%', '88%', '12%'] }}
          transition={{ repeat: Infinity, duration: 1.8 + delay * 0.5, ease: 'linear' }}
        />
      </motion.div>
      {label && (
        <motion.div
          className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/45 backdrop-blur-sm text-white text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.7, duration: 0.4 }}
        >
          {label}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── 3D Tilt Feature Card ────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, index, gradient }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xS = useSpring(x, { stiffness: 150, damping: 20 });
  const yS = useSpring(y, { stiffness: 150, damping: 20 });
  const rotateX = useTransform(yS, [-0.5, 0.5], ['10deg', '-10deg']);
  const rotateY = useTransform(xS, [-0.5, 0.5], ['-10deg', '10deg']);
  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: '-80px' });

  function handleMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width  / 2) / r.width);
    y.set((e.clientY - r.top  - r.height / 2) / r.height);
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 70 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.75, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="group relative rounded-3xl p-8 text-center cursor-default overflow-hidden"
    >
      <div className="absolute inset-0 rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 shadow-2xl" />
      <motion.div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'linear-gradient(135deg, rgba(196,121,90,0.15) 0%, rgba(232,196,160,0.10) 100%)' }}
      />
      <div style={{ transform: 'translateZ(28px)' }} className="relative z-10">
        <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg ${gradient}`}>
          <Icon size={36} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── Gallery Image ───────────────────────────────────────────────── */
function GalleryImage({ src, alt, caption, delay, tall }) {
  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer ${tall ? 'row-span-2' : ''}`}
      whileHover={{ scale: 1.02 }}
    >
      <img
        src={src} alt={alt}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        style={{ minHeight: tall ? '480px' : '230px' }}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
      <div className="absolute bottom-4 right-4 left-4 text-white text-center font-semibold text-sm opacity-0 group-hover:opacity-100 transition-all duration-400 translate-y-3 group-hover:translate-y-0">
        {caption}
      </div>
    </motion.div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();

  /* carousel */
  const slides = [
    { src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=900&q=90', alt: 'ניתוח עור AI',       type: 'scan' },
    { src: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=90', alt: 'טיפול פנים',         type: 'label', badge: 'טיפול פנים מקצועי' },
    { src: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=900&q=90', alt: 'עיצוב גבות',         type: 'label', badge: 'עיצוב גבות ועיניים' },
    { src: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=90',   alt: 'חוויית ספא',         type: 'label', badge: 'חוויית ספא מפנקת'   },
  ];
  const [currentSlide, setCurrentSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCurrentSlide(s => (s + 1) % slides.length), 3500);
    return () => clearInterval(id);
  }, []);

  const features = [
    { icon: Heart,       title: 'טיפול מותאם אישית', desc: 'אנחנו לא רק מטפלים — אנחנו מאבחנים את הצרכים הייחודיים של העור שלך ובונים תוכנית מושלמת.', gradient: 'bg-gradient-to-br from-[#C4795A] to-[#9B5C38]' },
    { icon: ShieldCheck, title: 'בטיחות ומקצועיות',  desc: 'כל הטיפולים נבדקו ואושרו על פי הסטנדרטים הגבוהים ביותר בעולם הקוסמטיקה.',                    gradient: 'bg-gradient-to-br from-[#E8C4A0] to-[#C4795A]' },
    { icon: Zap,         title: 'טכנולוגיה מתקדמת',  desc: 'שימוש במכשור החדיש ביותר בעולם — לייזר, AI, ומוצרי פרמיום בלבד.',                              gradient: 'bg-gradient-to-br from-[#D4A882] to-[#9B5C38]' },
  ];

  const gallery = [
    { src: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=80', alt: 'טיפול פנים',      caption: 'טיפולי פנים מקצועיים', delay: 0,   tall: true  },
    { src: 'https://images.unsplash.com/photo-1512207736890-6ffed8a84e8d?auto=format&fit=crop&w=700&q=80', alt: 'מוצרי קוסמטיקה', caption: 'מוצרי פרמיום',          delay: 0.1, tall: false },
    { src: 'https://images.unsplash.com/photo-1560066984-138daaa0e035?auto=format&fit=crop&w=700&q=80',   alt: 'סלון יופי',       caption: 'סביבה מפנקת',           delay: 0.2, tall: false },
    { src: 'https://images.unsplash.com/photo-1583416750470-965b2707b355?auto=format&fit=crop&w=700&q=80', alt: 'ניקוי עמוק',      caption: 'ניקוי עמוק וחידוש',    delay: 0.3, tall: false },
    { src: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=700&q=80', alt: 'עיצוב גבות',      caption: 'עיצוב גבות ועיניים',   delay: 0.4, tall: false },
    { src: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=700&q=80',   alt: 'ספא',             caption: 'חוויית ספא מפנקת',      delay: 0.5, tall: true  },
  ];

  const container = { hidden: {}, visible: { transition: { staggerChildren: 0.14 } } };
  const word = {
    hidden:  { opacity: 0, y: 40, rotateX: -80 },
    visible: { opacity: 1, y: 0,  rotateX: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl">

      {/* ══ HERO ══ */}
      <section className="relative min-h-screen overflow-hidden bg-[#FAF7F2]">

        {/* ── Full-bleed carousel images ── */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSlide}
            src={slides[currentSlide].src}
            alt={slides[currentSlide].alt}
            className="absolute inset-0 w-full h-full object-cover object-top"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>

        {/* ── Gradient: image fades to cream on the right (text side in RTL) ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(250,247,242,0) 0%, rgba(250,247,242,0.55) 42%, rgba(250,247,242,0.93) 62%, #FAF7F2 100%)',
          }}
        />
        {/* bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F2]/60 via-transparent to-transparent pointer-events-none" />

        {/* ── Scan boxes (slide 0 only) ── */}
        <AnimatePresence>
          {currentSlide === 0 && (
            <motion.div
              key="scans"
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 5 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ScanBox x={28} y={25} label="קמטים"    delay={0}   size={52} />
              <ScanBox x={40} y={38} label="כתמים"    delay={0.3} size={46} />
              <ScanBox x={30} y={55} label="נקבוביות" delay={0.6} size={44} />
              <ScanBox x={42} y={68} label="לחות"     delay={0.9} size={38} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Text overlay (right side in RTL) ── */}
        <div className="relative z-10 min-h-screen flex items-center" style={{ paddingTop: '5rem' }}>
          <div className="w-full container mx-auto px-6">
            <div className="flex justify-start">
              <div className="w-full md:w-[48%] lg:w-[42%] text-right py-12">

                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#C4795A]/35 text-[#9B5C38] text-xs font-bold mb-8"
                  style={{ background: 'rgba(196,121,90,0.09)' }}
                >
                  <Sparkles size={12} />
                  <span>MeDay Beauty Center</span>
                  <Sparkles size={12} />
                </motion.div>

                {/* Title */}
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="visible"
                  className="mb-6"
                  style={{ perspective: '800px' }}
                >
                  <motion.h1
                    variants={word}
                    className="block font-black text-gray-900 leading-[1.0]"
                    style={{ fontSize: 'clamp(3rem, 5.5vw, 5.5rem)' }}
                  >
                    העור שלך
                  </motion.h1>
                  <motion.h1
                    variants={word}
                    className="block font-black leading-[1.05] mt-1"
                    style={{
                      fontSize: 'clamp(3rem, 5.5vw, 5.5rem)',
                      background: 'linear-gradient(135deg, #C4795A 0%, #9B5C38 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    בידיים מקצועיות
                  </motion.h1>
                </motion.div>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.65 }}
                  className="text-sm text-gray-500 mb-9 leading-relaxed"
                >
                  טכנולוגיה חדישה · AI חכם · ידיים מנוסות = התוצאה המושלמת
                </motion.p>

                {/* Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.85 }}
                  className="flex flex-col sm:flex-row gap-3 justify-end"
                >
                  <motion.button
                    onClick={() => navigate('/categories')}
                    whileHover={{ scale: 1.05, boxShadow: '0 8px 28px rgba(196,121,90,0.40)' }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-4 rounded-full font-bold text-white text-sm flex items-center gap-2 shadow-md"
                    style={{ background: 'linear-gradient(135deg, #C4795A, #9B5C38)' }}
                  >
                    <span>לכל הטיפולים</span>
                    <ArrowLeft size={16} />
                  </motion.button>

                  <motion.button
                    onClick={() => { const b = document.querySelector('button[title="Ask MeDay"]'); if (b) b.click(); }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-4 rounded-full font-bold text-[#9B5C38] text-sm border border-[#C4795A]/35 bg-white/80 backdrop-blur-sm flex items-center gap-2 shadow-sm"
                  >
                    <span>התחילי AI</span>
                    <Sparkles size={16} className="text-[#C4795A]" />
                  </motion.button>
                </motion.div>

              </div>
            </div>
          </div>
        </div>

        {/* ── Slide badge (bottom-center over image) ── */}
        <div className="absolute bottom-16 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={`badge-${currentSlide}`}
              className="bg-white/85 backdrop-blur-md border border-[#E8C4A0]/50 shadow-lg rounded-2xl px-5 py-2.5 flex items-center gap-3 whitespace-nowrap"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
            >
              {currentSlide === 0 ? (
                <>
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                  />
                  <span className="text-xs font-bold text-gray-700" dir="rtl">AI סורק</span>
                  <span className="text-gray-300 text-xs">|</span>
                  <span className="text-xs text-gray-400" dir="rtl">4 אזורים זוהו</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-[#C4795A]" />
                  <span className="text-xs font-bold text-gray-700" dir="rtl">{slides[currentSlide].badge}</span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Navigation dots ── */}
        <div className="absolute bottom-7 left-0 right-0 flex justify-center gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width:      i === currentSlide ? '1.5rem' : '0.5rem',
                height:     '0.5rem',
                background: i === currentSlide ? '#C4795A' : 'rgba(196,121,90,0.35)',
              }}
            />
          ))}
        </div>

        {/* ── Scroll indicator ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="absolute bottom-7 right-8 flex flex-col items-center gap-1.5 z-10"
        >
          <span className="text-[#9B5C38]/40 text-[9px] tracking-[0.3em] uppercase">גלול</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="w-4 h-7 rounded-full border border-[#C4795A]/30 flex items-start justify-center pt-1"
          >
            <div className="w-0.5 h-1.5 bg-[#C4795A]/40 rounded-full" />
          </motion.div>
        </motion.div>

      </section>

      {/* ══ FEATURES ══ */}
      <section className="py-28 bg-gradient-to-b from-[#FAF6F1] via-[#F5EDE3]/30 to-[#FAF6F1]">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              למה לבחור ב
              <span style={{ background: 'linear-gradient(135deg, #C4795A, #9B5C38)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>MeDay</span>
              ?
            </h2>
            <p className="text-lg text-gray-400 max-w-lg mx-auto">כי אנחנו מאמינות שכל אחת מגיעה לטיפול הטוב ביותר</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ perspective: '1200px' }}>
            {features.map((f, i) => <FeatureCard key={i} {...f} index={i} />)}
          </div>
        </div>
      </section>

      {/* ══ GALLERY ══ */}
      <section className="py-28 bg-[#F5EDE3]/40">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              גלריית
              <span style={{ background: 'linear-gradient(135deg, #C4795A, #9B5C38)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}> יופי</span>
            </h2>
            <p className="text-lg text-gray-400">הצצה לעולם הקוסמטיקה שלנו</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" style={{ gridAutoRows: '230px' }}>
            {gallery.map((img, i) => <GalleryImage key={i} {...img} />)}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="py-28 relative overflow-hidden bg-[#1A0E06]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#C4795A]/12 rounded-full blur-[130px]" />
          <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[400px] h-[400px] bg-[#E8C4A0]/08 rounded-full blur-[100px]" />
        </div>
        {[...Array(18)].map((_, i) => (
          <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-white/20"
            style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
            animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.5, 1] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.85 }}>
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1, type: 'spring' }}>
                  <Star size={24} className="fill-[#C4795A] text-[#C4795A]" />
                </motion.div>
              ))}
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              מוכנה להתחיל את<br />
              <span style={{ background: 'linear-gradient(135deg, #C4795A 0%, #E8C4A0 50%, #F2C4A0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                מסע היופי שלך?
              </span>
            </h2>
            <p className="text-lg text-white/50 mb-12 max-w-lg mx-auto leading-relaxed">
              תני לנו לדאוג לעורך — תוצאות ראשונות שתרגישי כבר מהטיפול הראשון.
            </p>
            <motion.button
              onClick={() => navigate('/categories')}
              whileHover={{ scale: 1.06, boxShadow: '0 0 50px rgba(196,121,90,0.45)' }}
              whileTap={{ scale: 0.96 }}
              className="px-12 py-5 rounded-full font-bold text-lg text-white shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #C4795A, #9B5C38)' }}
            >
              גלי את כל הטיפולים ←
            </motion.button>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
