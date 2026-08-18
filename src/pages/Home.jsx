import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, Star } from 'lucide-react';
import makeupSlide from '../assets/makeup-professional.png';
import manicureSlide from '../assets/slide1.jpg';
import hairSlide from '../assets/slide2.jpg';
import cosmoSlide from '../assets/Como.jpg';
import eyebrowsSlide from '../assets/eyebrows.png';
import hairRemovalSlide from '../assets/hair-removal.png';
import bodySlide from '../assets/body-treatments.png';
import aestheticSlide from '../assets/aesth.png';
import personalStylingSlide from '../assets/personal_styling.png';

/* ─── Treatment categories shown in the home grid ──────────────── */
const CATEGORIES = [
  { slug: 'manicure-pedicure',      name: 'מניקור ופדיקור',         type: 'image', img: manicureSlide },
  { slug: 'hair-design',            name: 'עיצוב שיער',             type: 'image', img: hairSlide  },
  { slug: 'cosmetology',            name: 'טיפולי קוסמטיקה',        type: 'image', img: cosmoSlide },
  { slug: 'body-treatments',        name: 'טיפולי גוף',             type: 'image', img: bodySlide },
  { slug: 'hair-removal',           name: 'הסרת שיעור',             type: 'image', img: hairRemovalSlide },
  { slug: 'professional-makeup',    name: 'איפור מקצועי',           type: 'image', img: makeupSlide },
  { slug: 'permanent-makeup-brows', name: 'איפור קבוע ועיצוב גבות', type: 'image', img: eyebrowsSlide },
  { slug: 'personal-styling',       name: 'סטיילינג אישי',          type: 'image', img: personalStylingSlide },
  { slug: 'aesthetic-treatments',   name: 'טיפולי אסתטיקה',         type: 'image', img: aestheticSlide },
];

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

/* ─── Why Choose Us ───────────────────────────────────────────────── */
function WhyChooseUs() {
  const inView = true;

  const points = [
    { num: '01', text: 'טיפולים משולבים ב-4 ידיים, זמינות של 14 שעות ביום כולל סופי שבוע — אנחנו תמיד כאן בשבילך.' },
    { num: '02', text: 'אנשי מקצוע שנבחרו בקפידה ועברו הכשרות על ידי מאסטרים מובילים בתחומם.' },
    { num: '03', text: 'כל הטיפולים מבוצעים על פי פרוטוקול מקצועי קפדני — בטיחות ואיכות ללא פשרות.' },
    { num: '04', text: 'הטרנדים הכי עדכניים בעולם, מכשור חדשני וחומרים איכותיים ברמה הגבוהה ביותר.' },
    { num: '05', text: 'חוויה אישית, חמה ומזמינה — כי את מגיעה לטוב ביותר.' },
  ];

  const accentSwatches = [
    'linear-gradient(135deg, #4A9BA8, #7dd3d8)',
    'linear-gradient(135deg, #E8825A, #C4795A)',
    'linear-gradient(135deg, #F2D9A0, #E8C97A)',
  ];

  return (
    <section
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #FDF8F4 0%, #F7F0EA 45%, #EDF5F6 100%)' }}
    >
      {/* teal glow — left/image side */}
      <div
        className="absolute top-1/2 -left-32 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(74,155,168,0.12) 0%, transparent 70%)' }}
      />
      {/* coral glow — top right */}
      <div
        className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,130,90,0.10) 0%, transparent 70%)' }}
      />
      {/* watermark — desktop only, very faint */}
      <div
        className="absolute top-0 left-0 right-0 flex items-start justify-center pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
        style={{ paddingTop: '2rem' }}
      >
        <span
          className="font-black uppercase leading-none tracking-widest opacity-[0.05] text-[#1A1A1A]"
          style={{ fontSize: 'clamp(5rem, 14vw, 12rem)', whiteSpace: 'nowrap' }}
        >
          WHY CHOOSE US
        </span>
      </div>

      <div className="container mx-auto px-8 md:px-12 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-20 lg:gap-28">

          {/* ── Text side (right in RTL = first child) ── */}
          <div className="flex-1 text-right">

            {/* eyebrow */}
            <motion.p
              initial={{ opacity: 0, y: -12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="font-bold tracking-[0.3em] uppercase mb-3"
              style={{ fontSize: '0.8rem', color: '#4A9BA8' }}
            >
              ✦ WHY CHOOSE US ✦
            </motion.p>

            {/* main heading */}
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="font-black text-gray-900 leading-tight mb-4"
              style={{ fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)' }}
            >
              למה לבחור ב<span style={{ color: '#4A9BA8' }}>MeDay</span>?
            </motion.h2>

            {/* sub-heading */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="font-semibold mb-10"
              style={{ fontSize: 'clamp(1rem, 1.5vw, 1.25rem)', color: '#E8825A' }}
            >
              מעצבים את חוויית הטיפוח שלך מחדש
            </motion.p>

            {/* numbered points */}
            <ul className="space-y-3 mb-10">
              {points.map(({ num, text }, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 24 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.55, delay: 0.28 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-5 rounded-xl px-4 py-3"
                  style={{
                    background: i % 2 === 0
                      ? 'rgba(74,155,168,0.06)'
                      : 'rgba(237,184,154,0.08)',
                  }}
                >
                  {/* large teal number */}
                  <span
                    className="flex-shrink-0 font-black leading-none select-none"
                    style={{
                      fontSize: 'clamp(1.6rem, 2.2vw, 2rem)',
                      color: i % 2 === 0 ? '#4A9BA8' : '#C4795A',
                      minWidth: '2.8rem',
                      textAlign: 'left',
                    }}
                  >
                    {num}
                  </span>
                  <p
                    className="text-gray-700 leading-relaxed pt-1"
                    style={{ fontSize: 'clamp(0.95rem, 1.15vw, 1.1rem)' }}
                  >
                    {text}
                  </p>
                </motion.li>
              ))}
            </ul>

            {/* closing statement */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.85 }}
              className="rounded-2xl p-5 border-r-4"
              style={{
                background: 'rgba(74,155,168,0.07)',
                borderColor: '#4A9BA8',
              }}
            >
              <p
                className="font-bold text-gray-800 leading-relaxed"
                style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)' }}
              >
                מחכים לך במידיי — מרחב חם ומזמין של יופי ואסתטיקה, פינת אירוח מפנקת, אנשי מקצוע והכי חשוב — אנשים אוהבים אנשים!
              </p>
            </motion.div>

            {/* decorative accent row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="flex gap-4 mt-10 justify-end"
            >
              {accentSwatches.map((gradient, i) => (
                <div
                  key={i}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: gradient, boxShadow: '0 10px 26px rgba(0,0,0,0.08)' }}
                >
                  <div
                    className="w-3 h-3 rounded-[3px]"
                    style={{ background: 'rgba(255,255,255,0.85)', transform: 'rotate(45deg)' }}
                  />
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Image side (left in RTL = second child) ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 relative"
            style={{ width: 'clamp(280px, 32vw, 400px)', height: 'clamp(280px, 32vw, 400px)' }}
          >
            {/* slow-rotating dashed orbit */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 32, ease: 'linear' }}
              className="absolute rounded-full border-2 border-dashed"
              style={{ inset: '-20px', borderColor: 'rgba(74,155,168,0.22)' }}
            />
            {/* static inner ring */}
            <div
              className="absolute rounded-full border"
              style={{ inset: '-8px', borderColor: 'rgba(74,155,168,0.12)' }}
            />
            {/* circular image */}
            <div
              className="w-full h-full rounded-full overflow-hidden border-[6px] border-white"
              style={{ boxShadow: '0 28px 72px rgba(74,155,168,0.20), 0 8px 24px rgba(0,0,0,0.08)' }}
            >
              <img
                src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=85"
                alt="טיפול פנים מקצועי ב-MeDay"
                className="w-full h-full object-cover"
              />
            </div>

            {/* floating teal diamond — top right */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 3.6, ease: 'easeInOut' }}
              style={{
                position: 'absolute', top: '-1.5rem', right: '-1.5rem',
                width: '2.8rem', height: '2.8rem', borderRadius: '6px',
                background: 'linear-gradient(135deg, #4A9BA8, #3A7E8A)',
                transform: 'rotate(45deg)',
                boxShadow: '0 8px 24px rgba(74,155,168,0.38)',
              }}
            />
            {/* floating coral diamond — bottom left */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 4.4, ease: 'easeInOut', delay: 0.7 }}
              style={{
                position: 'absolute', bottom: '-1rem', left: '-1rem',
                width: '1.6rem', height: '1.6rem', borderRadius: '4px',
                background: 'linear-gradient(135deg, #E8825A, #C4795A)',
                transform: 'rotate(45deg)',
                boxShadow: '0 6px 16px rgba(232,130,90,0.35)',
              }}
            />
            {/* small accent dot — top left */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut', delay: 1.2 }}
              style={{
                position: 'absolute', top: '15%', left: '-2rem',
                width: '0.75rem', height: '0.75rem', borderRadius: '50%',
                background: '#4A9BA8', opacity: 0.5,
              }}
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
}


/* ─── Main Page ───────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();

  /* carousel */
  const slides = [
    { src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=900&q=90', alt: 'ניתוח עור AI',       type: 'scan' },
    { src: makeupSlide,                                                                                      alt: 'איפור מקצועי',       type: 'label', badge: 'איפור מקצועי'      },
    { src: manicureSlide,                                                                                    alt: 'מניקור ופדיקור',     type: 'label', badge: 'מניקור ופדיקור'    },
    { src: hairSlide,                                                                                        alt: 'עיצוב שיער',         type: 'label', badge: 'עיצוב שיער'        },
    { src: cosmoSlide,                                                                                       alt: 'טיפולי קוסמטיקה',    type: 'label', badge: 'טיפולי קוסמטיקה'   },
    { src: eyebrowsSlide,                                                                                    alt: 'איפור קבוע ועיצוב גבות', type: 'label', badge: 'איפור קבוע ועיצוב גבות' },
    { src: bodySlide,                                                                                        alt: 'טיפולי גוף',         type: 'label', badge: 'טיפולי גוף'        },
    { src: hairRemovalSlide,                                                                                 alt: 'הסרת שיעור',         type: 'label', badge: 'הסרת שיעור'        },
    { src: aestheticSlide,                                                                                   alt: 'טיפולי אסתטיקה',     type: 'label', badge: 'טיפולי אסתטיקה'    },
    { src: personalStylingSlide,                                                                             alt: 'סטיילינג אישי',       type: 'label', badge: 'סטיילינג אישי'      },
  ];
  const [currentSlide, setCurrentSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCurrentSlide(s => (s + 1) % slides.length), 3500);
    return () => clearInterval(id);
  }, []);


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
            className="absolute inset-0 w-full h-full object-cover object-center"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>

        {/* ── Gradient: subtle bottom fade only ── */}
        {/* bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F2]/40 via-transparent to-transparent pointer-events-none" />

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
                    style={{
                      fontSize: 'clamp(3rem, 5.5vw, 5.5rem)',
                      textShadow: '0 2px 20px rgba(250,247,242,0.70)',
                    }}
                  >
                    הפכי לגרסה
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
                      filter: 'drop-shadow(0 2px 12px rgba(250,247,242,0.60))',
                    }}
                  >
                    שחלמת עליה
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
                  {/* Primary: WhatsApp booking — teal per brand system */}
                  <motion.a
                    href="https://wa.me/972"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05, boxShadow: '0 8px 28px rgba(74,155,168,0.42)' }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-4 rounded-full font-bold text-white text-sm flex items-center gap-2 shadow-md"
                    style={{ background: 'linear-gradient(135deg, #4A9BA8, #3A7E8A)' }}
                  >
                    <span>הזמיני דרך WhatsApp</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </motion.a>

                  {/* Secondary: browse treatments */}
                  <motion.button
                    onClick={() => navigate('/categories')}
                    whileHover={{ scale: 1.05, boxShadow: '0 4px 18px rgba(196,121,90,0.22)' }}
                    whileTap={{ scale: 0.97 }}
                    className="px-7 py-4 rounded-full font-bold text-[#9B5C38] text-sm border border-[#C4795A]/35 bg-white/80 backdrop-blur-sm flex items-center gap-2 shadow-sm"
                  >
                    <span>לכל הטיפולים</span>
                    <ArrowLeft size={16} />
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
                  <span className="text-xs font-bold text-gray-700" dir="rtl">שאלי את ה־AI</span>
                  <span className="text-gray-300 text-xs">|</span>
                  <span className="text-xs text-gray-400" dir="rtl">ייעוץ אישי חינם</span>
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

      {/* ══ WHY CHOOSE US ══ */}
      <WhyChooseUs />

      {/* ══ OUR GOALS ══ */}
      <section className="py-24 relative overflow-hidden" style={{ background: '#EDEAE5' }}>
        {/* warm glow behind image area */}
        <div
          className="absolute top-1/2 left-0 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(237,184,154,0.45) 0%, rgba(232,196,122,0.20) 50%, transparent 72%)' }}
        />

        <div className="container mx-auto px-8 md:px-14">
          <div className="flex flex-col md:flex-row items-center gap-16 lg:gap-24">

            {/* ── Text side (right in RTL — first child) ── */}
            <div className="flex-1 text-right relative">

              {/* watermark + sparkle icons */}
              <div className="relative mb-1 flex items-center justify-end gap-2" aria-hidden="true">
                <span
                  className="font-black uppercase leading-none select-none"
                  style={{ fontSize: 'clamp(2.6rem, 5vw, 4.5rem)', color: 'rgba(80,70,60,0.11)', letterSpacing: '0.05em' }}
                >
                  OUR GOALS
                </span>
                {/* sparkle cluster — matches original screenshot */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <Sparkles size={14} style={{ color: '#E8825A' }} />
                  <Sparkles size={20} style={{ color: '#C4795A' }} />
                </div>
              </div>

              {/* Hebrew heading */}
              <motion.h2
                className="font-black mb-6"
                style={{
                  fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                  background: 'linear-gradient(135deg, #4A9BA8, #3A7E8A)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  marginTop: '-0.5rem',
                }}
              >
                המטרות שלנו
              </motion.h2>

              {/* body text */}
              <motion.p
                className="text-gray-600 leading-relaxed mb-10"
                style={{ fontSize: 'clamp(1rem, 1.2vw, 1.15rem)' }}
              >
                מידיי דוגלת ביצירת חוויה נעימה ומרגשת שבה תוכלו להתרגש ולהתפנק.
                חשוב לנו ליצור מקום שיענה בצורה הטובה ביותר לצרכיכם — כאשר כל
                הטיפולים במקום אחד ולחסוך לכם זמן ומאמץ.
              </motion.p>

              {/* CTA */}
              <motion.a
                href="https://wa.me/972"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.04, boxShadow: '0 8px 28px rgba(74,155,168,0.40)' }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #4A9BA8, #3A7E8A)',
                  fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)',
                  boxShadow: '0 4px 18px rgba(74,155,168,0.30)',
                }}
              >
                לתיאום תור
              </motion.a>
            </div>

            {/* ── Blob image (left in RTL — second child) ── */}
            <div
              className="flex-shrink-0"
              style={{ width: 'clamp(260px, 34vw, 430px)', height: 'clamp(260px, 34vw, 430px)' }}
            >
              {/* outer glow ring behind the blob */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(196,121,90,0.22) 0%, transparent 70%)',
                  transform: 'scale(1.18)',
                }}
              />
              <div
                className="relative w-full h-full overflow-hidden"
                style={{
                  borderRadius: '58% 42% 38% 62% / 52% 44% 56% 48%',
                  boxShadow: '0 28px 72px rgba(0,0,0,0.18), 0 8px 24px rgba(196,121,90,0.15)',
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=85"
                  alt="כלי איפור מקצועיים"
                  className="w-full h-full object-cover grayscale"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ TREATMENT CATEGORIES ══ */}
      <section className="relative overflow-hidden" style={{ background: '#FAF5F0' }}>

        {/* section header */}
        <div className="container mx-auto px-8 pt-20 pb-10 text-center">
          <div>
            <p className="font-bold tracking-[0.3em] uppercase mb-3" style={{ fontSize: '0.78rem', color: '#4A9BA8' }}>
              ✦ TREATMENTS ✦
            </p>
            <h2 className="font-black text-gray-900 mb-4" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)' }}>
              הטיפולים <span style={{ color: '#4A9BA8' }}>שלנו</span>
            </h2>
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="h-px w-16 bg-gradient-to-l from-[#C4795A]/40 to-transparent" />
              <div className="w-2 h-2 rounded-sm rotate-45" style={{ background: '#4A9BA8' }} />
              <div className="h-px w-16 bg-gradient-to-r from-[#C4795A]/40 to-transparent" />
            </div>
            <p className="text-gray-400" style={{ fontSize: 'clamp(0.95rem, 1.2vw, 1.1rem)' }}>
              בחרי את הטיפול המושלם עבורך
            </p>
          </div>
        </div>

        {/* full-bleed tiles grid — no container, edge to edge */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          style={{ gridAutoRows: '200px' }}
        >
          {CATEGORIES.map((cat, i) => (
            <motion.button
              key={cat.slug}
              onClick={() => navigate(`/categories/${cat.slug}`)}
              className="relative overflow-hidden group cursor-pointer text-right"
              style={{ outline: 'none' }}
            >
              {cat.type === 'image' ? (
                <>
                  <img
                    src={cat.img?.startsWith('photo-') ? `https://images.unsplash.com/${cat.img}?auto=format&fit=crop&w=450&q=80` : cat.img}
                    alt={cat.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/85" />
                </>
              ) : (
                <div
                  className="absolute inset-0 transition-all duration-300"
                  style={{ background: cat.bg, filter: 'brightness(1)' }}
                />
              )}

              {/* category name — bottom right in RTL */}
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <h3
                  className="font-black leading-tight"
                  style={{
                    fontSize: 'clamp(0.95rem, 1.3vw, 1.2rem)',
                    color: cat.type === 'image' ? '#fff' : cat.text,
                    textShadow: cat.type === 'image' ? '0 2px 10px rgba(0,0,0,0.6)' : 'none',
                  }}
                >
                  {cat.name}
                </h3>
              </div>

              {/* hover: subtle teal glow border on solid tiles */}
              {cat.type === 'solid' && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 0 3px rgba(74,155,168,0.6)' }} />
              )}

              {/* hover: arrow chip */}
              <div
                className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0"
                style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
              >
                <ArrowLeft size={12} className="text-white" />
                <span className="text-white text-[10px] font-bold">לצפייה</span>
              </div>
            </motion.button>
          ))}
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
          <div>
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <div key={i}>
                  <Star size={24} className="fill-[#C4795A] text-[#C4795A]" />
                </div>
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
          </div>
        </div>
      </section>

    </div>
  );
}
