import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics } from "../api/medayApi";
import {
  BarChart2, TrendingUp, Calendar, Clock, Sparkles, Users, Download,
  RefreshCw, Bell, Search, Settings, Activity, ChevronRight, ChevronLeft,
  Zap, ArrowUpRight, Home, Menu, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NEON = ["#8b5cf6", "#06b6d4", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#f43f5e"];

const MONTH_HE = ["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
function formatMonth(yyyyMm) {
  if (!yyyyMm) return "";
  const [, mm] = yyyyMm.split("-");
  return MONTH_HE[parseInt(mm, 10) - 1] ?? yyyyMm;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

const RANGES = [
  { key: "today", label: "היום",   getDates: () => ({ fromDate: todayStr(), toDate: todayStr() }) },
  { key: "7",     label: "7 ימים", getDates: () => ({ fromDate: daysAgo(6), toDate: todayStr() }) },
  { key: "30",    label: "30 יום", getDates: () => ({ fromDate: daysAgo(29), toDate: todayStr() }) },
  { key: "all",   label: "הכל",    getDates: () => ({}) },
];

const NAV_ITEMS = [
  { icon: Home,      label: "דשבורד",  active: true },
  { icon: Calendar,  label: "תורים",   active: false },
  { icon: Sparkles,  label: "טיפולים", active: false },
  { icon: Activity,  label: "ניתוח",   active: false },
  { icon: Settings,  label: "הגדרות",  active: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// SVG Donut chart
function DonutChart({ segments, total }) {
  const r = 54;
  const cx = 70, cy = 70;
  const circumference = 2 * Math.PI * r;
  const sum = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = 0;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
      {segments.map((seg, i) => {
        const segLen = (seg.value / sum) * circumference;
        const offset = -cumulative;
        cumulative += segLen;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${segLen} ${circumference}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 8px ${seg.color}99)`, transition: "stroke-dasharray 0.7s ease" }}
          />
        );
      })}
      {/* Center */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="Heebo, sans-serif">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="Heebo, sans-serif">סה״כ</text>
    </svg>
  );
}

// Horizontal neon bar
function NeonBar({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 group">
      <span className="w-32 text-right text-xs text-slate-400 truncate group-hover:text-slate-200 transition-colors">{label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 8px ${color}66` }}
        />
      </div>
      <span className="w-7 text-xs font-bold text-right" style={{ color }}>{count}</span>
    </div>
  );
}

// Vertical bar (monthly trend)
function NeonVBar({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0 group">
      <span className="text-xs font-bold" style={{ color: pct > 0 ? color : "transparent" }}>{count || ""}</span>
      <div className="w-full flex items-end rounded overflow-hidden" style={{ height: 72 }}>
        <div
          className="w-full rounded-t transition-all duration-700"
          style={{
            height: `${pct}%`,
            minHeight: count > 0 ? 4 : 0,
            background: `linear-gradient(180deg, ${color}, ${color}55)`,
            boxShadow: pct > 0 ? `0 0 12px ${color}55` : "none",
          }}
        />
      </div>
      <span className="text-xs text-slate-500 text-center">{label}</span>
    </div>
  );
}

// KPI card (dark glass + neon top border)
function KpiCard({ icon: Icon, label, value, color, subtext }) {
  return (
    <div
      className="glass-dark rounded-2xl p-5 hover-neon-violet cursor-default relative overflow-hidden"
      style={{ borderTop: `2px solid ${color}`, boxShadow: `0 4px 24px rgba(0,0,0,0.3)` }}
    >
      {/* glow blob */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20" style={{ background: color }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
          {subtext && <p className="text-xs mt-1.5 font-medium" style={{ color }}>{subtext}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

// AI Insights panel
function AiInsights({ data }) {
  const insights = [];
  if (data.by_day?.length) {
    const top = [...data.by_day].sort((a, b) => b.count - a.count)[0];
    if (top?.count > 0) insights.push({ text: `יום ${top.day} הוא היום העמוס ביותר עם ${top.count} תורים`, color: "#8b5cf6" });
  }
  if (data.by_hour?.length) {
    const top = [...data.by_hour].sort((a, b) => b.count - a.count)[0];
    if (top?.count > 0) insights.push({ text: `פיק הפעילות בשעה ${top.hour} — מומלץ לשריין עוד מטפלות`, color: "#06b6d4" });
  }
  if (data.by_treatment?.length) {
    insights.push({ text: `הטיפול המבוקש ביותר: ${data.by_treatment[0].name} (${data.by_treatment[0].count} הזמנות)`, color: "#ec4899" });
  }
  if (data.by_category?.length) {
    insights.push({ text: `${data.by_category[0].category} מובילה עם ${data.by_category[0].count} תורים השבוע`, color: "#10b981" });
  }
  if (data.monthly_trend?.length >= 2) {
    const last = data.monthly_trend.at(-1)?.count ?? 0;
    const prev = data.monthly_trend.at(-2)?.count ?? 0;
    if (prev > 0) {
      const pct = Math.round(((last - prev) / prev) * 100);
      const up = pct >= 0;
      insights.push({ text: `חודש זה ${up ? "↑" : "↓"} ${Math.abs(pct)}% לעומת החודש הקודם`, color: up ? "#10b981" : "#f43f5e" });
    }
  }

  return (
    <div className="glass-dark rounded-2xl p-5 h-full" style={{ borderTop: "2px solid #8b5cf6" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Zap size={14} className="text-violet-400" />
        </div>
        <h3 className="text-sm font-bold text-white">תובנות AI</h3>
        <span className="mr-auto text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">חי</span>
      </div>

      {insights.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-6">אין מספיק נתונים עדיין</p>
      ) : (
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 p-3 rounded-xl animate-fade-in"
              style={{ background: `${ins.color}11`, border: `1px solid ${ins.color}22`, animationDelay: `${i * 80}ms` }}
            >
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 animate-pulse-soft" style={{ background: ins.color }} />
              <p className="text-xs text-slate-300 leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Activity feed
function ActivityFeed({ recent }) {
  return (
    <div className="glass-dark rounded-2xl p-5" style={{ borderTop: "2px solid #06b6d4" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Activity size={14} className="text-cyan-400" />
        </div>
        <h3 className="text-sm font-bold text-white">פעילות אחרונה</h3>
        <div className="mr-auto w-2 h-2 rounded-full bg-cyan-400 animate-pulse-soft" />
      </div>

      {recent.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-6">אין פעילות עדיין</p>
      ) : (
        <div className="space-y-2 dark-scroll overflow-y-auto" style={{ maxHeight: 280 }}>
          {recent.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors animate-fade-in cursor-default"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
                style={{ background: `${NEON[i % NEON.length]}33`, border: `1px solid ${NEON[i % NEON.length]}55` }}
              >
                {a.client_name?.charAt(0) ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{a.client_name}</p>
                <p className="text-xs text-slate-500 truncate">{a.treatment_name}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs text-slate-400">{a.date}</p>
                <p className="text-xs text-slate-600">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Collapsible sidebar
function Sidebar({ collapsed, onToggle }) {
  return (
    <div
      className="glass-sidebar flex flex-col h-full shrink-0 transition-all duration-300 overflow-hidden relative z-20"
      style={{ width: collapsed ? 64 : 220 }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-neon-violet-grad flex items-center justify-center shrink-0" style={{ boxShadow: "0 0 16px rgba(139,92,246,0.5)" }}>
          <BarChart2 size={15} className="text-white" />
        </div>
        {!collapsed && <span className="text-sm font-bold gradient-text-neon whitespace-nowrap">MeDay Admin</span>}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all duration-200 group
                ${item.active
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/5"}`}
              style={item.active ? { boxShadow: "inset 0 0 20px rgba(139,92,246,0.1)" } : {}}
            >
              <Icon size={17} className={`shrink-0 transition-colors ${item.active ? "text-violet-400" : "group-hover:text-slate-300"}`} />
              {!collapsed && (
                <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
              )}
              {!collapsed && item.active && (
                <div className="mr-auto w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse-soft" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="m-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all flex items-center justify-center"
      >
        {collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
    </div>
  );
}

// Top nav
function TopNav({ onRefresh, refreshing }) {
  return (
    <div className="glass-dark border-b border-white/6 px-6 py-3 flex items-center gap-4 shrink-0 z-10">
      {/* Search */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 flex-1 max-w-xs">
        <Search size={13} className="text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="חיפוש..."
          className="bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none w-full text-right"
          dir="rtl"
        />
      </div>

      <div className="flex items-center gap-2 mr-auto">
        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-violet-400 transition-all"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-violet-400" : ""} />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse-soft" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-xl bg-neon-violet-grad flex items-center justify-center text-white text-xs font-bold cursor-pointer" style={{ boxShadow: "0 0 12px rgba(139,92,246,0.4)" }}>
          מ
        </div>
      </div>
    </div>
  );
}

// CSV export
function exportCsv(recent) {
  const header = "שם לקוח,טלפון,טיפול,קטגוריה,תאריך,שעה\n";
  const rows = recent.map((a) =>
    [a.client_name, a.client_phone ?? "", a.treatment_name, a.treatment_category ?? "", a.date, a.time]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob(["\uFEFF" + header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meday-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRange, setActiveRange] = useState("all");
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const range = RANGES.find((r) => r.key === activeRange);
      const result = await fetchAnalytics(range ? range.getDates() : {});
      setData(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeRange]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Page background style ───────────────────────────────────────────────
  const pageBg = {
    background: "radial-gradient(ellipse at 15% 5%, rgba(139,92,246,0.18) 0%, transparent 45%), radial-gradient(ellipse at 85% 95%, rgba(6,182,212,0.12) 0%, transparent 45%), #07070f",
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden" style={pageBg}>
        <div className="glass-sidebar w-[220px] shrink-0" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="glass-dark border-b border-white/6 h-14 shrink-0" />
          <div className="flex-1 p-6 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 rounded-2xl opacity-20" />)}
            </div>
            <div className="shimmer h-44 rounded-2xl opacity-20" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-48 rounded-2xl opacity-20" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center" style={pageBg}>
        <p className="text-red-400 text-sm">שגיאה בטעינת הנתונים</p>
      </div>
    );
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const maxTreatment = Math.max(...data.by_treatment.map((t) => t.count), 1);
  const maxDay       = Math.max(...data.by_day.map((d) => d.count), 1);
  const maxHour      = Math.max(...data.by_hour.map((h) => h.count), 1);
  const maxCategory  = Math.max(...(data.by_category?.map((c) => c.count) ?? [1]), 1);
  const maxMonthly   = Math.max(...(data.monthly_trend?.map((m) => m.count) ?? [1]), 1);

  const donutSegments = (data.by_category ?? []).slice(0, 6).map((c, i) => ({
    label: c.category, value: c.count, color: NEON[i % NEON.length],
  }));

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl" style={pageBg}>

      {/* ── Sidebar ── */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav onRefresh={() => load(true)} refreshing={refreshing} />

        <main className="flex-1 overflow-y-auto dark-scroll p-6 space-y-6">

          {/* ── Toolbar: date tabs + export ── */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveRange(r.key)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    activeRange === r.key
                      ? "text-white"
                      : "text-slate-500 bg-white/4 hover:text-slate-300 hover:bg-white/8"
                  }`}
                  style={activeRange === r.key
                    ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 16px rgba(139,92,246,0.4)" }
                    : {}}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportCsv(data.recent)}
              className="flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-3 py-1.5 rounded-xl transition-all"
            >
              <Download size={12} />
              ייצוא CSV
            </button>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Users}      label="סה״כ תורים"    value={data.total}              color="#8b5cf6" subtext={data.total > 0 ? "כולל כל הזמנים" : null} />
            <KpiCard icon={Calendar}   label="תורים היום"    value={data.today ?? 0}         color="#06b6d4" />
            <KpiCard icon={TrendingUp} label="תורים השבוע"   value={data.this_week ?? 0}     color="#ec4899" />
            <KpiCard icon={Sparkles}   label="סוגי טיפולים"  value={data.by_treatment.length} color="#10b981" />
          </div>

          {/* ── Monthly trend + AI insights ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Trend (2/3 width) */}
            <div className="glass-dark rounded-2xl p-5 lg:col-span-2" style={{ borderTop: "2px solid #7c3aed" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <TrendingUp size={13} className="text-violet-400" />
                </div>
                <h3 className="text-sm font-bold text-white">מגמה חודשית</h3>
                <span className="mr-auto text-xs text-slate-500">6 חודשים אחרונים</span>
              </div>
              {data.monthly_trend?.length > 0 ? (
                <div className="flex items-end gap-2 px-2">
                  {data.monthly_trend.map((m) => (
                    <NeonVBar key={m.month} label={formatMonth(m.month)} count={m.count} max={maxMonthly} color="#8b5cf6" />
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
              )}
            </div>

            {/* AI Insights (1/3 width) */}
            <AiInsights data={data} />
          </div>

          {/* ── Treatment bars + Category donut ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Treatment bars */}
            <div className="glass-dark rounded-2xl p-5" style={{ borderTop: "2px solid #ec4899" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <TrendingUp size={13} className="text-pink-400" />
                </div>
                <h3 className="text-sm font-bold text-white">טיפולים מבוקשים</h3>
              </div>
              {data.by_treatment.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
              ) : (
                <div className="space-y-3">
                  {data.by_treatment.map((t, i) => (
                    <NeonBar key={t.name} label={t.name} count={t.count} max={maxTreatment} color={NEON[i % NEON.length]} />
                  ))}
                </div>
              )}
            </div>

            {/* Category donut + legend */}
            <div className="glass-dark rounded-2xl p-5" style={{ borderTop: "2px solid #10b981" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Sparkles size={13} className="text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">תורים לפי קטגוריה</h3>
              </div>
              {donutSegments.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
              ) : (
                <div className="flex items-center gap-4">
                  <DonutChart segments={donutSegments} total={data.total} />
                  <div className="flex-1 space-y-2">
                    {donutSegments.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color, boxShadow: `0 0 6px ${seg.color}` }} />
                        <span className="text-xs text-slate-400 truncate flex-1">{seg.label}</span>
                        <span className="text-xs font-bold" style={{ color: seg.color }}>{seg.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Day bars + Hour bars ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <div className="glass-dark rounded-2xl p-5" style={{ borderTop: "2px solid #7c3aed" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Calendar size={13} className="text-violet-400" />
                </div>
                <h3 className="text-sm font-bold text-white">תורים לפי יום</h3>
              </div>
              {data.by_day.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
              ) : (
                <div className="space-y-3">
                  {data.by_day.map((d) => (
                    <NeonBar key={d.day} label={d.day} count={d.count} max={maxDay} color="#8b5cf6" />
                  ))}
                </div>
              )}
            </div>

            <div className="glass-dark rounded-2xl p-5" style={{ borderTop: "2px solid #06b6d4" }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Clock size={13} className="text-cyan-400" />
                </div>
                <h3 className="text-sm font-bold text-white">שעות עמוסות</h3>
              </div>
              {data.by_hour.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-10">אין נתונים עדיין</p>
              ) : (
                <div className="space-y-3">
                  {data.by_hour.map((h) => (
                    <NeonBar key={h.hour} label={h.hour} count={h.count} max={maxHour} color="#06b6d4" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Activity feed (full width) ── */}
          <ActivityFeed recent={data.recent} />

        </main>
      </div>
    </div>
  );
}
