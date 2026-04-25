import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import CountUp from "react-countup";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { fetchAnalytics } from "../api/medayApi";
import {
  BarChart2, TrendingUp, Calendar, Clock, Sparkles, Users, Download,
  RefreshCw, Bell, Search, Settings, Activity, ChevronRight, Zap, Home,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const NEON = ["#8b5cf6","#06b6d4","#ec4899","#f59e0b","#10b981","#3b82f6","#f43f5e"];
const MONTH_HE = ["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
const formatMonth = (s) => { const [,m] = (s||"").split("-"); return MONTH_HE[parseInt(m,10)-1] ?? s; };
const daysAgo = (n) => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
const todayStr = () => new Date().toISOString().slice(0,10);

const RANGES = [
  { key:"today", label:"היום",   getDates:()=>({ fromDate:todayStr(), toDate:todayStr() }) },
  { key:"7",     label:"7 ימים", getDates:()=>({ fromDate:daysAgo(6),  toDate:todayStr() }) },
  { key:"30",    label:"30 יום", getDates:()=>({ fromDate:daysAgo(29), toDate:todayStr() }) },
  { key:"all",   label:"הכל",    getDates:()=>({}) },
];

const NAV_ITEMS = [
  { icon: Home,     label:"דשבורד",  active:true  },
  { icon: Calendar, label:"תורים",   active:false },
  { icon: Sparkles, label:"טיפולים", active:false },
  { icon: Activity, label:"ניתוח",   active:false },
  { icon: Settings, label:"הגדרות",  active:false },
];

// ─────────────────────────────────────────────────────────────────────────────
// 🌌 SPACE BACKGROUND COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Animated star canvas — twinkling stars with coloured variants
function StarCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Generate stars with different layers (depth simulation)
    const stars = Array.from({ length: 220 }, (_, i) => ({
      x:     Math.random(),
      y:     Math.random(),
      r:     Math.random() * 1.4 + 0.15,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.6 + 0.2,
      hue:   Math.random() > 0.88 ? (Math.random() > 0.5 ? 270 : 200) : null, // some violet/blue tinted
    }));

    let raf, t = 0;
    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width, h = canvas.height;

      stars.forEach(s => {
        const twinkle = (Math.sin(t * s.speed + s.phase) + 1) / 2 * 0.65 + 0.35;
        const alpha = twinkle * (s.r > 1 ? 0.95 : 0.75);

        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue
          ? `hsla(${s.hue}, 70%, 85%, ${alpha})`
          : `rgba(255,255,255,${alpha})`;
        ctx.fill();

        // Glow halo for brighter stars
        if (s.r > 1) {
          const grad = ctx.createRadialGradient(s.x*w, s.y*h, 0, s.x*w, s.y*h, s.r*5);
          grad.addColorStop(0, s.hue ? `hsla(${s.hue},60%,85%,${twinkle*0.18})` : `rgba(255,255,255,${twinkle*0.14})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.r * 5, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }} />;
}

// Parallax nebula blobs — move at different speeds relative to scroll
function NebulaBg({ scrollYProgress }) {
  const y1 = useTransform(scrollYProgress, [0, 1], ["0%",  "-35%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0%",  "-18%"]);
  const y3 = useTransform(scrollYProgress, [0, 1], ["0%",  "-55%"]);
  const y4 = useTransform(scrollYProgress, [0, 1], ["0%",  "-10%"]);
  const s1 = useTransform(scrollYProgress, [0, 1], [1,      1.15]);
  const s2 = useTransform(scrollYProgress, [0, 1], [1,      0.88]);

  const blob = (style, y, scale, animDelay) => (
    <motion.div
      style={{
        position:"fixed", pointerEvents:"none",
        borderRadius:"50%", filter:"blur(80px)",
        y, scale,
        ...style,
      }}
      animate={{ opacity: [style.opacity*0.7, style.opacity, style.opacity*0.8, style.opacity] }}
      transition={{ duration: 8 + animDelay, repeat: Infinity, ease: "easeInOut", delay: animDelay }}
    />
  );

  return (
    <>
      {/* Deep violet — top left */}
      {blob({ width:600, height:500, left:"-10%",  top:"5%",   background:"radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)", opacity:0.9, zIndex:0 }, y1, s1, 0)}
      {/* Cyan — bottom right */}
      {blob({ width:700, height:550, right:"-15%", bottom:"0%", background:"radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 70%)",  opacity:0.8, zIndex:0 }, y2, s2, 3)}
      {/* Pink — center-right */}
      {blob({ width:400, height:400, right:"20%",  top:"30%",  background:"radial-gradient(circle, rgba(219,39,119,0.18) 0%, transparent 70%)",  opacity:0.7, zIndex:0 }, y3, 1, 5)}
      {/* Indigo — left mid */}
      {blob({ width:500, height:400, left:"5%",    top:"55%",  background:"radial-gradient(circle, rgba(79,70,229,0.20) 0%, transparent 70%)",   opacity:0.7, zIndex:0 }, y4, 1, 2)}
    </>
  );
}

// Shooting stars — streak across the screen periodically
function ShootingStar({ left, top, angle, delay, repeatDelay }) {
  return (
    <motion.div
      style={{
        position:"fixed", left, top,
        width: 90, height: 1.5,
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.2) 100%)",
        borderRadius: 2,
        transformOrigin: "left center",
        rotate: angle,
        zIndex: 1, pointerEvents: "none",
      }}
      initial={{ scaleX:0, opacity:0 }}
      animate={{ scaleX:[0, 1, 0], opacity:[0, 0.9, 0], x:[0, 140], y:[0, 140] }}
      transition={{ duration:0.75, delay, repeat:Infinity, repeatDelay, ease:"easeOut" }}
    />
  );
}

// Floating micro-particles — tiny specks drifting upward
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left:     `${Math.random() * 100}%`,
      size:     Math.random() * 2.5 + 0.8,
      duration: Math.random() * 22 + 14,
      delay:    -(Math.random() * 22),
      opacity:  Math.random() * 0.35 + 0.08,
      color:    NEON[Math.floor(Math.random() * NEON.length)],
      glow:     Math.random() > 0.7,
    })), []);

  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1, overflow:"hidden" }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          style={{
            position:"absolute", left:p.left, bottom:-12,
            width:p.size, height:p.size, borderRadius:"50%",
            background: p.glow ? p.color : "rgba(255,255,255,0.6)",
            boxShadow: p.glow ? `0 0 6px ${p.color}` : "none",
          }}
          animate={{ y: [0, -(window.innerHeight + 30)], opacity:[0, p.opacity, p.opacity, 0] }}
          transition={{ duration:p.duration, delay:p.delay, repeat:Infinity, ease:"linear" }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Framer variants
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp  = { hidden:{opacity:0,y:36}, show:{opacity:1,y:0,transition:{duration:0.55,ease:[0.25,0.46,0.45,0.94]}} };
const stagger = { hidden:{},              show:{transition:{staggerChildren:0.10}} };
const cardV   = { hidden:{opacity:0,y:28,scale:0.96}, show:{opacity:1,y:0,scale:1,transition:{duration:0.5,ease:[0.25,0.46,0.45,0.94]}} };

// Helper for scroll-triggered sections
const inView = (mainRef) => ({ initial:"hidden", whileInView:"show", viewport:{ root:mainRef, once:true, margin:"-60px" } });

// ─────────────────────────────────────────────────────────────────────────────
// Chart components
// ─────────────────────────────────────────────────────────────────────────────

function NeonBar({ label, count, max, color, index=0, mainRef }) {
  const pct = max > 0 ? Math.round((count/max)*100) : 0;
  return (
    <motion.div
      className="flex items-center gap-3 group"
      initial={{ opacity:0, x:24 }}
      whileInView={{ opacity:1, x:0 }}
      viewport={{ root:mainRef, once:true }}
      transition={{ duration:0.4, delay:index*0.06, ease:"easeOut" }}
    >
      <span className="w-32 text-right text-xs text-slate-400 truncate group-hover:text-slate-200 transition-colors">{label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-2 rounded-full"
          initial={{ width:0 }}
          whileInView={{ width:`${pct}%` }}
          viewport={{ root:mainRef, once:true }}
          transition={{ duration:1, delay:index*0.06+0.2, ease:[0.25,0.46,0.45,0.94] }}
          style={{ background:`linear-gradient(90deg, ${color}77, ${color})`, boxShadow:`0 0 8px ${color}55` }}
        />
      </div>
      <span className="w-7 text-xs font-bold text-right" style={{ color }}>{count}</span>
    </motion.div>
  );
}

function NeonVBar({ label, count, max, color, index=0 }) {
  const pct = max > 0 ? Math.round((count/max)*100) : 0;
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <motion.span className="text-xs font-bold"
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:index*0.08+0.7 }}
        style={{ color:pct>0?color:"transparent" }}
      >{count||""}</motion.span>
      <div className="w-full flex items-end rounded overflow-hidden" style={{ height:72 }}>
        <motion.div
          className="w-full rounded-t"
          initial={{ height:0 }}
          animate={{ height:`${pct}%` }}
          transition={{ duration:0.85, delay:index*0.08+0.1, ease:[0.34,1.56,0.64,1] }}
          style={{
            minHeight: count>0?4:0,
            background:`linear-gradient(180deg, ${color}, ${color}44)`,
            boxShadow: pct>0?`0 0 18px ${color}55`:"none",
          }}
        />
      </div>
      <span className="text-xs text-slate-500 text-center">{label}</span>
    </div>
  );
}

function DonutChart({ segments, total }) {
  const r=54, cx=70, cy=70;
  const circ = 2*Math.PI*r;
  const sum  = segments.reduce((s,g)=>s+g.value,0)||1;
  let cum = 0;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16"/>
      {segments.map((seg,i)=>{
        const len = (seg.value/sum)*circ;
        const off = -cum;
        cum += len;
        return (
          <motion.circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth="16" strokeDashoffset={off}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDasharray:`0 ${circ}` }}
            animate={{ strokeDasharray:`${len} ${circ}` }}
            transition={{ duration:1.1, delay:i*0.18+0.3, ease:"easeOut" }}
            style={{ filter:`drop-shadow(0 0 8px ${seg.color}99)` }}
          />
        );
      })}
      <motion.text x={cx} y={cy-6} textAnchor="middle" fill="white" fontSize="20" fontWeight="700"
        fontFamily="Heebo,sans-serif"
        initial={{ opacity:0, scale:0.4 }} animate={{ opacity:1, scale:1 }}
        transition={{ delay:1.3, type:"spring", stiffness:220 }}
      >{total}</motion.text>
      <text x={cx} y={cy+12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="Heebo,sans-serif">סה״כ</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ icon:Icon, label, value, color, index=0, mainRef }) {
  return (
    <motion.div
      variants={cardV}
      initial="hidden" whileInView="show"
      viewport={{ root:mainRef, once:true }}
      whileHover={{ y:-6, boxShadow:`0 16px 48px ${color}33`, transition:{duration:0.2} }}
      whileTap={{ scale:0.96 }}
      className="glass-dark rounded-2xl p-5 cursor-default relative overflow-hidden"
      style={{ borderTop:`2px solid ${color}` }}
    >
      <motion.div
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl"
        style={{ background:color, opacity:0.12 }}
        animate={{ opacity:[0.08,0.20,0.08], scale:[1,1.15,1] }}
        transition={{ duration:4+index, repeat:Infinity, ease:"easeInOut", delay:index*0.5 }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-white mb-0.5">
            <CountUp end={value} duration={1.8} delay={0.3+index*0.12} separator="," />
          </p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
        <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:`${color}22` }}
          whileHover={{ rotate:[0,-12,12,0], transition:{duration:0.4} }}
        >
          <Icon size={18} style={{ color }}/>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI insights
// ─────────────────────────────────────────────────────────────────────────────
function AiInsights({ data, mainRef }) {
  const items = [];
  if (data.by_day?.length) {
    const top=[...data.by_day].sort((a,b)=>b.count-a.count)[0];
    if(top?.count>0) items.push({ text:`יום ${top.day} הוא היום העמוס ביותר עם ${top.count} תורים`, color:"#8b5cf6" });
  }
  if (data.by_hour?.length) {
    const top=[...data.by_hour].sort((a,b)=>b.count-a.count)[0];
    if(top?.count>0) items.push({ text:`פיק פעילות בשעה ${top.hour} — מומלץ לשריין עוד מטפלות`, color:"#06b6d4" });
  }
  if (data.by_treatment?.length) items.push({ text:`הטיפול המבוקש ביותר: ${data.by_treatment[0].name} (${data.by_treatment[0].count} הזמנות)`, color:"#ec4899" });
  if (data.by_category?.length) items.push({ text:`${data.by_category[0].category} מובילה עם ${data.by_category[0].count} תורים`, color:"#10b981" });
  if (data.monthly_trend?.length>=2) {
    const last=data.monthly_trend.at(-1)?.count??0, prev=data.monthly_trend.at(-2)?.count??0;
    if(prev>0){ const p=Math.round(((last-prev)/prev)*100), up=p>=0;
      items.push({ text:`חודש זה ${up?"↑":"↓"} ${Math.abs(p)}% לעומת החודש הקודם`, color:up?"#10b981":"#f43f5e" });
    }
  }

  return (
    <motion.div variants={fadeUp} {...inView(mainRef)} className="glass-dark rounded-2xl p-5 h-full" style={{ borderTop:"2px solid #8b5cf6" }}>
      <div className="flex items-center gap-2 mb-4">
        <motion.div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center"
          animate={{ boxShadow:["0 0 0px #8b5cf600","0 0 18px #8b5cf677","0 0 0px #8b5cf600"] }}
          transition={{ duration:2.5, repeat:Infinity }}
        ><Zap size={14} className="text-violet-400"/></motion.div>
        <h3 className="text-sm font-bold text-white">תובנות AI</h3>
        <motion.span className="mr-auto text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full"
          animate={{ opacity:[1,0.4,1] }} transition={{ duration:2, repeat:Infinity }}>חי</motion.span>
      </div>
      <motion.div className="space-y-3" variants={stagger} initial="hidden" animate="show">
        {items.length===0
          ? <p className="text-slate-600 text-xs text-center py-6">אין מספיק נתונים</p>
          : items.map((ins,i)=>(
            <motion.div key={i} variants={fadeUp}
              whileHover={{ x:-4, transition:{duration:0.18} }}
              className="flex items-start gap-2.5 p-3 rounded-xl cursor-default"
              style={{ background:`${ins.color}10`, border:`1px solid ${ins.color}22` }}
            >
              <motion.div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background:ins.color }}
                animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.8, repeat:Infinity, delay:i*0.4 }}
              />
              <p className="text-xs text-slate-300 leading-relaxed">{ins.text}</p>
            </motion.div>
          ))
        }
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity feed
// ─────────────────────────────────────────────────────────────────────────────
function ActivityFeed({ recent, mainRef }) {
  const [listRef] = useAutoAnimate();
  return (
    <motion.div variants={fadeUp} {...inView(mainRef)} className="glass-dark rounded-2xl p-5" style={{ borderTop:"2px solid #06b6d4" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Activity size={14} className="text-cyan-400"/>
        </div>
        <h3 className="text-sm font-bold text-white">פעילות אחרונה</h3>
        <motion.div className="mr-auto w-2 h-2 rounded-full bg-cyan-400"
          animate={{ scale:[1,1.7,1], opacity:[1,0.3,1] }} transition={{ duration:1.8, repeat:Infinity }}
        />
      </div>
      <div ref={listRef} className="space-y-1.5 dark-scroll overflow-y-auto" style={{ maxHeight:260 }}>
        {recent.length===0
          ? <p className="text-slate-600 text-xs text-center py-6">אין פעילות עדיין</p>
          : recent.map((a,i)=>(
            <motion.div key={a.id}
              initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }}
              transition={{ delay:i*0.05, duration:0.35 }}
              whileHover={{ x:-4, backgroundColor:"rgba(255,255,255,0.04)" }}
              className="flex items-center gap-3 p-2.5 rounded-xl cursor-default"
            >
              <motion.div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
                style={{ background:`${NEON[i%NEON.length]}2a`, border:`1px solid ${NEON[i%NEON.length]}44` }}
                whileHover={{ scale:1.18, boxShadow:`0 0 14px ${NEON[i%NEON.length]}66` }}
              >{a.client_name?.charAt(0)??"?"}</motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{a.client_name}</p>
                <p className="text-xs text-slate-500 truncate">{a.treatment_name}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs text-slate-400">{a.date}</p>
                <p className="text-xs text-slate-600">{a.time}</p>
              </div>
            </motion.div>
          ))
        }
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onToggle }) {
  return (
    <motion.div className="glass-sidebar flex flex-col h-full shrink-0 overflow-hidden relative z-20"
      animate={{ width: collapsed?64:220 }}
      transition={{ type:"spring", stiffness:300, damping:30 }}
    >
      <div className="px-4 py-5 flex items-center gap-3 border-b border-white/5 overflow-hidden">
        <motion.div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow:"0 0 18px rgba(139,92,246,0.55)" }}
          whileHover={{ rotate:180, scale:1.1 }} transition={{ duration:0.4 }}
          animate={{ boxShadow:["0 0 12px rgba(139,92,246,0.4)","0 0 24px rgba(139,92,246,0.7)","0 0 12px rgba(139,92,246,0.4)"] }}
        ><BarChart2 size={15} className="text-white"/></motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span className="text-sm font-bold gradient-text-neon whitespace-nowrap"
              initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-10 }}
              transition={{ duration:0.2 }}
            >MeDay Admin</motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map((item,i)=>{
          const Icon=item.icon;
          return (
            <motion.button key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl overflow-hidden
                ${item.active?"bg-violet-500/20 text-violet-300":"text-slate-500 hover:text-slate-200"}`}
              style={item.active?{ boxShadow:"inset 0 0 24px rgba(139,92,246,0.1)" }:{}}
              whileHover={{ backgroundColor:item.active?undefined:"rgba(255,255,255,0.05)", x:-2 }}
              whileTap={{ scale:0.95 }}
              initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.07+0.2 }}
            >
              <Icon size={17} className={`shrink-0 ${item.active?"text-violet-400":""}`}/>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span className="text-xs font-medium whitespace-nowrap"
                    initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }}
                    transition={{ duration:0.18 }}
                  >{item.label}</motion.span>
                )}
              </AnimatePresence>
              {!collapsed && item.active && (
                <motion.div className="mr-auto w-1.5 h-1.5 rounded-full bg-violet-400"
                  animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.5, repeat:Infinity }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      <motion.button onClick={onToggle}
        className="m-3 p-2.5 rounded-xl bg-white/5 text-slate-500 flex items-center justify-center"
        whileHover={{ backgroundColor:"rgba(255,255,255,0.1)", color:"#c4b5fd" }}
        whileTap={{ scale:0.9 }}
      >
        <motion.div animate={{ rotate:collapsed?180:0 }} transition={{ type:"spring", stiffness:280, damping:24 }}>
          <ChevronRight size={15}/>
        </motion.div>
      </motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top nav
// ─────────────────────────────────────────────────────────────────────────────
function TopNav({ onRefresh, refreshing }) {
  return (
    <div className="glass-dark border-b border-white/6 px-6 py-3 flex items-center gap-4 shrink-0 z-10">
      <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 flex-1 max-w-xs">
        <Search size={13} className="text-slate-500 shrink-0"/>
        <input type="text" placeholder="חיפוש..." dir="rtl"
          className="bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none w-full text-right"/>
      </div>
      <div className="flex items-center gap-2 mr-auto">
        <motion.button onClick={onRefresh}
          className="p-2 rounded-xl bg-white/5 text-slate-500"
          whileHover={{ backgroundColor:"rgba(139,92,246,0.2)", color:"#a78bfa" }}
          whileTap={{ scale:0.88 }}
        >
          <motion.div animate={refreshing?{ rotate:360 }:{}} transition={{ duration:0.8, repeat:refreshing?Infinity:0, ease:"linear" }}>
            <RefreshCw size={14}/>
          </motion.div>
        </motion.button>
        <motion.button className="relative p-2 rounded-xl bg-white/5 text-slate-500"
          whileHover={{ backgroundColor:"rgba(255,255,255,0.08)", color:"#e2e8f0" }} whileTap={{ scale:0.88 }}
        >
          <Bell size={15}/>
          <motion.span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500"
            animate={{ scale:[1,1.6,1] }} transition={{ duration:1.5, repeat:Infinity }}
          />
        </motion.button>
        <motion.div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold cursor-pointer"
          style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow:"0 0 14px rgba(139,92,246,0.45)" }}
          whileHover={{ scale:1.1, boxShadow:"0 0 24px rgba(139,92,246,0.65)" }} whileTap={{ scale:0.92 }}
        >מ</motion.div>
      </div>
    </div>
  );
}

// CSV export
function exportCsv(recent) {
  const header = "שם לקוח,טלפון,טיפול,קטגוריה,תאריך,שעה\n";
  const rows = recent.map(a=>
    [a.client_name,a.client_phone??"",a.treatment_name,a.treatment_category??"",a.date,a.time]
      .map(v=>`"${String(v).replace(/"/g,'""')}"`)
      .join(",")
  );
  const blob = new Blob(["\uFEFF"+header+rows.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`meday-${todayStr()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 Main dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [data,       setData]        = useState(null);
  const [loading,    setLoading]     = useState(true);
  const [refreshing, setRefreshing]  = useState(false);
  const [activeRange,setActiveRange] = useState("all");
  const [collapsed,  setCollapsed]   = useState(false);

  // Scroll ref for parallax
  const mainRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: mainRef });

  // Card depth on scroll — subtle forward-drift
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.985]);

  const load = useCallback(async (silent=false) => {
    if(!silent) setLoading(true); else setRefreshing(true);
    try {
      const range = RANGES.find(r=>r.key===activeRange);
      const result = await fetchAnalytics(range?range.getDates():{});
      setData(result);
    } catch(e){ console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  },[activeRange]);

  useEffect(()=>{ load(false); },[load]);
  useEffect(()=>{ const id=setInterval(()=>load(true),60_000); return ()=>clearInterval(id); },[load]);

  const pageBg = { background:"#020209" };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen overflow-hidden" style={pageBg}>
      <StarCanvas/>
      <FloatingParticles/>
      <div className="glass-sidebar w-[220px] shrink-0" style={{ zIndex:10 }}/>
      <div className="flex-1 flex flex-col overflow-hidden" style={{ zIndex:10 }}>
        <div className="glass-dark border-b border-white/6 h-14 shrink-0"/>
        <div className="flex-1 p-6 space-y-6 overflow-hidden">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_,i)=>(
              <motion.div key={i} className="h-24 rounded-2xl" style={{ background:"rgba(255,255,255,0.04)" }}
                animate={{ opacity:[0.08,0.2,0.08] }} transition={{ duration:1.5, repeat:Infinity, delay:i*0.2 }}
              />
            ))}
          </div>
          {[...Array(3)].map((_,i)=>(
            <motion.div key={i} className="rounded-2xl" style={{ height:i===0?176:136, background:"rgba(255,255,255,0.04)" }}
              animate={{ opacity:[0.06,0.16,0.06] }} transition={{ duration:1.8, repeat:Infinity, delay:i*0.3+0.4 }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex h-screen items-center justify-center" style={pageBg}>
      <StarCanvas/>
      <p className="text-red-400 text-sm" style={{ zIndex:10, position:"relative" }}>שגיאה בטעינת הנתונים</p>
    </div>
  );

  const maxTreatment = Math.max(...data.by_treatment.map(t=>t.count),1);
  const maxDay       = Math.max(...data.by_day.map(d=>d.count),1);
  const maxHour      = Math.max(...data.by_hour.map(h=>h.count),1);
  const maxMonthly   = Math.max(...(data.monthly_trend?.map(m=>m.count)??[1]),1);
  const donutSegs    = (data.by_category??[]).slice(0,6).map((c,i)=>({ label:c.category, value:c.count, color:NEON[i%NEON.length] }));

  const sectionProps = { variants:fadeUp, ...inView(mainRef) };

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl" style={pageBg}>

      {/* ── Space layers (z-0) ── */}
      <StarCanvas/>
      <NebulaBg scrollYProgress={scrollYProgress}/>
      <FloatingParticles/>

      {/* Shooting stars */}
      <ShootingStar left="20%"  top="8%"  angle={35}  delay={2}  repeatDelay={11}/>
      <ShootingStar left="65%"  top="18%" angle={30}  delay={7}  repeatDelay={16}/>
      <ShootingStar left="40%"  top="40%" angle={40}  delay={13} repeatDelay={20}/>
      <ShootingStar left="80%"  top="5%"  angle={28}  delay={4}  repeatDelay={14}/>

      {/* ── Sidebar ── */}
      <div style={{ zIndex:20, position:"relative" }}>
        <Sidebar collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)}/>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ zIndex:10, position:"relative" }}>
        <TopNav onRefresh={()=>load(true)} refreshing={refreshing}/>

        <motion.main
          ref={mainRef}
          className="flex-1 overflow-y-auto space-scroll p-6 space-y-6"
          style={{ scale:contentScale }}
        >
          {/* ── Toolbar ── */}
          <motion.div variants={fadeUp} {...inView(mainRef)} className="flex items-center justify-between">
            <div className="flex gap-2">
              {RANGES.map(r=>(
                <motion.button key={r.key} onClick={()=>setActiveRange(r.key)}
                  className="px-4 py-1.5 rounded-xl text-xs font-medium relative overflow-hidden"
                  whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
                  style={activeRange===r.key
                    ?{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow:"0 0 20px rgba(139,92,246,0.5)", color:"white" }
                    :{ background:"rgba(255,255,255,0.04)", color:"#64748b", border:"1px solid rgba(255,255,255,0.07)" }}
                >
                  {r.label}
                  {activeRange===r.key && (
                    <motion.div className="absolute inset-0 rounded-xl"
                      style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.18),transparent)" }}
                      animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2.5, repeat:Infinity }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
            <motion.button onClick={()=>exportCsv(data.recent)}
              className="flex items-center gap-1.5 text-xs text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-xl"
              style={{ background:"rgba(139,92,246,0.1)" }}
              whileHover={{ scale:1.05, boxShadow:"0 0 16px rgba(139,92,246,0.35)" }} whileTap={{ scale:0.95 }}
            ><Download size={12}/>ייצוא CSV</motion.button>
          </motion.div>

          {/* ── KPI cards ── */}
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ root:mainRef, once:true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <KpiCard index={0} icon={Users}      label="סה״כ תורים"    value={data.total}               color="#8b5cf6" mainRef={mainRef}/>
            <KpiCard index={1} icon={Calendar}   label="תורים היום"    value={data.today??0}            color="#06b6d4" mainRef={mainRef}/>
            <KpiCard index={2} icon={TrendingUp} label="תורים השבוע"   value={data.this_week??0}        color="#ec4899" mainRef={mainRef}/>
            <KpiCard index={3} icon={Sparkles}   label="סוגי טיפולים"  value={data.by_treatment.length} color="#10b981" mainRef={mainRef}/>
          </motion.div>

          {/* ── Monthly trend + AI insights ── */}
          <motion.div {...sectionProps} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <motion.div className="glass-dark rounded-2xl p-5 lg:col-span-2" style={{ borderTop:"2px solid #7c3aed" }}
              whileHover={{ boxShadow:"0 8px 50px rgba(124,58,237,0.18)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <TrendingUp size={13} className="text-violet-400"/>
                </div>
                <h3 className="text-sm font-bold text-white">מגמה חודשית</h3>
                <span className="mr-auto text-xs text-slate-500">6 חודשים אחרונים</span>
              </div>
              {data.monthly_trend?.length>0
                ? <div className="flex items-end gap-2 px-2">
                    {data.monthly_trend.map((m,i)=><NeonVBar key={m.month} label={formatMonth(m.month)} count={m.count} max={maxMonthly} color="#8b5cf6" index={i}/>)}
                  </div>
                : <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
              }
            </motion.div>
            <AiInsights data={data} mainRef={mainRef}/>
          </motion.div>

          {/* ── Treatment bars + Donut ── */}
          <motion.div {...sectionProps} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div className="glass-dark rounded-2xl p-5" style={{ borderTop:"2px solid #ec4899" }}
              whileHover={{ boxShadow:"0 8px 50px rgba(236,72,153,0.14)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <TrendingUp size={13} className="text-pink-400"/>
                </div>
                <h3 className="text-sm font-bold text-white">טיפולים מבוקשים</h3>
              </div>
              {data.by_treatment.length===0
                ? <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
                : <div className="space-y-3">{data.by_treatment.map((t,i)=><NeonBar key={t.name} label={t.name} count={t.count} max={maxTreatment} color={NEON[i%NEON.length]} index={i} mainRef={mainRef}/>)}</div>
              }
            </motion.div>

            <motion.div className="glass-dark rounded-2xl p-5" style={{ borderTop:"2px solid #10b981" }}
              whileHover={{ boxShadow:"0 8px 50px rgba(16,185,129,0.14)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Sparkles size={13} className="text-emerald-400"/>
                </div>
                <h3 className="text-sm font-bold text-white">תורים לפי קטגוריה</h3>
              </div>
              {donutSegs.length===0
                ? <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
                : <div className="flex items-center gap-4">
                    <DonutChart segments={donutSegs} total={data.total}/>
                    <motion.div className="flex-1 space-y-2" variants={stagger} initial="hidden" animate="show">
                      {donutSegs.map((seg,i)=>(
                        <motion.div key={seg.label} variants={fadeUp} whileHover={{ x:-4 }} className="flex items-center gap-2 cursor-default">
                          <motion.div className="w-2 h-2 rounded-full shrink-0" style={{ background:seg.color }}
                            animate={{ boxShadow:[`0 0 3px ${seg.color}33`,`0 0 10px ${seg.color}aa`,`0 0 3px ${seg.color}33`] }}
                            transition={{ duration:2.5, repeat:Infinity, delay:i*0.35 }}
                          />
                          <span className="text-xs text-slate-400 truncate flex-1">{seg.label}</span>
                          <span className="text-xs font-bold" style={{ color:seg.color }}>{seg.value}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
              }
            </motion.div>
          </motion.div>

          {/* ── Day + Hour bars ── */}
          <motion.div {...sectionProps} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div className="glass-dark rounded-2xl p-5" style={{ borderTop:"2px solid #7c3aed" }}
              whileHover={{ boxShadow:"0 8px 50px rgba(124,58,237,0.14)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center"><Calendar size={13} className="text-violet-400"/></div>
                <h3 className="text-sm font-bold text-white">תורים לפי יום</h3>
              </div>
              {data.by_day.length===0
                ? <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
                : <div className="space-y-3">{data.by_day.map((d,i)=><NeonBar key={d.day} label={d.day} count={d.count} max={maxDay} color="#8b5cf6" index={i} mainRef={mainRef}/>)}</div>
              }
            </motion.div>

            <motion.div className="glass-dark rounded-2xl p-5" style={{ borderTop:"2px solid #06b6d4" }}
              whileHover={{ boxShadow:"0 8px 50px rgba(6,182,212,0.14)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center"><Clock size={13} className="text-cyan-400"/></div>
                <h3 className="text-sm font-bold text-white">שעות עמוסות</h3>
              </div>
              {data.by_hour.length===0
                ? <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
                : <div className="space-y-3">{data.by_hour.map((h,i)=><NeonBar key={h.hour} label={h.hour} count={h.count} max={maxHour} color="#06b6d4" index={i} mainRef={mainRef}/>)}</div>
              }
            </motion.div>
          </motion.div>

          {/* ── Activity feed ── */}
          <ActivityFeed recent={data.recent} mainRef={mainRef}/>

          {/* Bottom spacer so last card isn't flush */}
          <div style={{ height:32 }}/>
        </motion.main>
      </div>
    </div>
  );
}
