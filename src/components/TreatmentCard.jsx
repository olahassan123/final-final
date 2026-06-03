import { useMemo, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export default function TreatmentCard({ t }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xS = useSpring(x, { stiffness: 140, damping: 18 });
  const yS = useSpring(y, { stiffness: 140, damping: 18 });
  const rotateX = useTransform(yS, [-0.5, 0.5], ['8deg', '-8deg']);
  const rotateY = useTransform(xS, [-0.5, 0.5], ['-8deg', '8deg']);

  function handleMouseMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width  / 2) / r.width);
    y.set((e.clientY - r.top  - r.height / 2) / r.height);
  }

  const shownLines = useMemo(() => {
    if (!t?.lines?.length) return [];
    return open ? t.lines : t.lines.slice(0, 2);
  }, [t, open]);

  const hasMore = (t?.lines?.length || 0) > 2;

  return (
    <motion.article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      whileHover={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="group relative rounded-3xl p-7 text-center overflow-hidden cursor-default"
    >
      {/* glass card base */}
      <div className="absolute inset-0 rounded-3xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-xl transition-shadow duration-300 group-hover:shadow-2xl" />

      {/* gradient border glow on hover */}
      <div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, rgba(196,121,90,0.22) 0%, rgba(232,196,160,0.12) 100%)',
        }}
      />

      {/* top-left shine */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(196,121,90,0.28) 0%, transparent 70%)' }}
      />

      {/* content elevated in Z */}
      <div style={{ transform: 'translateZ(20px)' }} className="relative z-10">

        {/* icon accent */}
        <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-gradient-to-br from-[#C4795A] to-[#E8C4A0] flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
          <Sparkles size={18} className="text-white" />
        </div>

        <h3 className="text-xl font-extrabold text-[#8B5030] leading-tight mb-4">
          {t.name}
        </h3>

        <ul className="space-y-2 text-gray-600 leading-7">
          {shownLines.map((line, idx) => (
            <li key={idx} className="text-[14px] leading-6">
              {line}
            </li>
          ))}
        </ul>

        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#8B5030]/70 hover:text-[#8B5030] transition-colors"
          >
            {open ? 'לסגור' : 'לקרוא עוד'}
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
    </motion.article>
  );
}
