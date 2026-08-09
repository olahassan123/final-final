import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createElement } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { CONTACT_INQUIRIES_STORAGE_KEY, CONTACT_INQUIRY_EVENT, addContactInquiryFeedback, getContactInquiries, updateContactInquiryStatus } from "../api/contactApi";
import { JOB_APPLICATION_EVENT, JOB_APPLICATIONS_STORAGE_KEY, getJobApplications, updateJobApplicationStatus, addJobApplicationFeedback } from "../api/jobsApi";
import { fetchAnalytics, getExcelInfo, getExcelPreview, uploadExcel, getExcelDownloadUrl } from "../api/medayApi";
import { getSettings, updateSettingsAccount, updateSettingsPassword, updateSystemSettings, getAiSettings, updateAiSettings } from "../api/settingsApi";
import {
  Activity,
  AlertCircle,
  BarChart2,
  Bell,
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Database,
  Download,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Home,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

const CHART_COLORS = ["#C4795A", "#4A9BA8", "#D4A256", "#C67C8B", "#9B5C38", "#2E7A87"];

const STAT_THEMES = [
  {
    gradient: "linear-gradient(135deg, #C4795A 0%, #9B5C38 100%)",
    glow: "rgba(196,121,90,0.40)",
    shimmer: "rgba(255,255,255,0.15)",
    icon: "rgba(255,255,255,0.20)",
  },
  {
    gradient: "linear-gradient(135deg, #4A9BA8 0%, #2E7A87 100%)",
    glow: "rgba(74,155,168,0.40)",
    shimmer: "rgba(255,255,255,0.15)",
    icon: "rgba(255,255,255,0.20)",
  },
  {
    gradient: "linear-gradient(135deg, #D4A256 0%, #9B6E24 100%)",
    glow: "rgba(212,162,86,0.40)",
    shimmer: "rgba(255,255,255,0.15)",
    icon: "rgba(255,255,255,0.20)",
  },
  {
    gradient: "linear-gradient(135deg, #C67C8B 0%, #9B4E68 100%)",
    glow: "rgba(198,124,139,0.40)",
    shimmer: "rgba(255,255,255,0.15)",
    icon: "rgba(255,255,255,0.20)",
  },
];
const MONTH_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const formatMonth = (s) => {
  const [, month] = (s || "").split("-");
  return MONTH_HE[parseInt(month, 10) - 1] ?? s;
};
const MONTH_HE_CLEAN = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const formatMonthHe = (s) => {
  const [, month] = (s || "").split("-");
  return MONTH_HE_CLEAN[parseInt(month, 10) - 1] ?? s;
};
const formatCurrency = (value) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value || 0);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const formatDateTime = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const RANGES = [
  { key: "today", label: "היום", getDates: () => ({ fromDate: todayStr(), toDate: todayStr() }) },
  { key: "7", label: "7 ימים", getDates: () => ({ fromDate: daysAgo(6), toDate: todayStr() }) },
  { key: "30", label: "30 יום", getDates: () => ({ fromDate: daysAgo(29), toDate: todayStr() }) },
  { key: "all", label: "הכל", getDates: () => ({}) },
];

const NAV_ITEMS = [
  { key: "dashboard", icon: Home, label: "דשבורד" },
  { key: "appointments", icon: Calendar, label: "תורים" },
  { key: "inquiries", icon: MessageCircle, label: "פניות" },
  { key: "jobs", icon: Briefcase, label: "דרושים" },
  { key: "analytics", icon: Activity, label: "ניתוח" },
  { key: "settings", icon: Settings, label: "הגדרות" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const inView = (mainRef) => ({ initial: "hidden", whileInView: "show", viewport: { root: mainRef, once: true, margin: "-50px" } });

function PageGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-24 -top-16 h-[32rem] w-[32rem] rounded-full bg-[#C4795A]/20 blur-3xl" />
      <div className="absolute -left-20 top-48 h-[38rem] w-[38rem] rounded-full bg-[#4A9BA8]/12 blur-3xl" />
      <div className="absolute bottom-[-4rem] right-1/3 h-[28rem] w-[28rem] rounded-full bg-[#E8C4A0]/28 blur-3xl" />
      <div className="absolute bottom-20 left-8 h-56 w-56 rounded-full bg-[#C4795A]/10 blur-2xl" />
      <div className="absolute top-1/2 right-1/2 h-48 w-48 rounded-full bg-[#D4A256]/08 blur-2xl" />
    </div>
  );
}

function LogoMark({ size = "md" }) {
  const isLg = size === "lg";
  const wordSize = isLg ? "2.1rem" : "1.55rem";
  const tagSize = isLg ? "0.44rem" : "0.33rem";
  return (
    <div style={{ direction: "ltr", display: "inline-flex", flexDirection: "column", alignItems: "center", userSelect: "none", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <div style={{ width: 18, height: "0.5px", background: "linear-gradient(to right, transparent, #C4795A)" }} />
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
          <polygon points="3,0 6,3 3,6 0,3" fill="#C4795A" opacity="0.85" />
          <polygon points="3,1.4 4.6,3 3,4.6 1.4,3" fill="#1C0C04" />
        </svg>
        <div style={{ width: 18, height: "0.5px", background: "linear-gradient(to left, transparent, #C4795A)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
        <span style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: wordSize, fontWeight: 700, fontStyle: "italic", color: "#C4795A", lineHeight: 1 }}>Me</span>
        <span style={{ fontFamily: '"Abril Fatface", Georgia, serif', fontSize: wordSize, fontWeight: 400, color: "#E8C4A0", lineHeight: 1 }}>Day</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, width: "100%" }}>
        <div style={{ flex: 1, height: "0.5px", background: "linear-gradient(to right, transparent, #C4795A)", opacity: 0.5 }} />
        <svg width="4" height="4" viewBox="0 0 4 4"><polygon points="2,0 4,2 2,4 0,2" fill="#C4795A" opacity="0.7" /></svg>
        <div style={{ flex: 1, height: "0.5px", background: "linear-gradient(to left, transparent, #C4795A)", opacity: 0.5 }} />
      </div>
      <div style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: tagSize, fontWeight: 300, color: "#E8C4A0", letterSpacing: "0.5em", opacity: 0.55, textTransform: "uppercase", marginTop: 2 }}>beauty center</div>
    </div>
  );
}

function EmptyState({ icon: Icon = Sparkles, title = "אין נתונים עדיין", text = "ברגע שיתווספו נתונים הם יופיעו כאן." }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-[#E8C4A0]/60 bg-white/55 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C4795A]/10 text-[#C4795A]">
        {createElement(Icon, { size: 22 })}
      </div>
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-gray-500">{text}</p>
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children, className = "" }) {
  return (
    <Motion.section
      variants={fadeUp}
      className={`overflow-hidden rounded-3xl border border-white/70 bg-white/78 shadow-xl shadow-[#9B5C38]/8 backdrop-blur-xl ${className}`}
      whileHover={{ y: -4, boxShadow: "0 22px 56px rgba(155,92,56,0.13)" }}
    >
      {/* gradient accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #4A9BA8 0%, #C4795A 50%, #E8C4A0 100%)" }} />
      <div className="p-5">
        <div className="mb-5 flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              background: "linear-gradient(135deg, #C4795A 0%, #9B5C38 100%)",
              boxShadow: "0 6px 20px rgba(196,121,90,0.35)",
            }}
          >
            {createElement(Icon, { size: 19 })}
          </div>
          <div className="min-w-0 text-right">
            <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs leading-5 text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </Motion.section>
  );
}

function StatCard({ icon: Icon, label, value, helper, index = 0 }) {
  const theme = STAT_THEMES[index % STAT_THEMES.length];
  return (
    <Motion.article
      variants={fadeUp}
      whileHover={{ y: -7, boxShadow: `0 22px 56px ${theme.glow}` }}
      className="group relative overflow-hidden rounded-3xl p-5 shadow-xl"
      style={{ background: theme.gradient, boxShadow: `0 8px 28px ${theme.glow}` }}
    >
      {/* shimmer bubble */}
      <div
        className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full blur-2xl transition-opacity group-hover:opacity-60"
        style={{ background: theme.shimmer }}
      />
      {/* sparkle corner */}
      <div
        className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-28 rounded-full blur-2xl"
        style={{ background: theme.shimmer }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="text-right">
          <p className="text-3xl font-black tabular-nums text-white drop-shadow-sm">
            <CountUp end={value || 0} duration={1.7} delay={0.15 + index * 0.08} separator="," />
          </p>
          <p className="mt-1 text-sm font-bold text-white/85">{label}</p>
          {helper ? <p className="mt-1 text-xs text-white/55">{helper}</p> : null}
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: theme.icon, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          {createElement(Icon, { size: 22 })}
        </div>
      </div>
    </Motion.article>
  );
}

function WarmBar({ label, count, max, color, index = 0, mainRef }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <Motion.div
      className="group grid grid-cols-[7rem_1fr_2.25rem] items-center gap-3"
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ root: mainRef, once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <span className="truncate text-right text-xs font-semibold text-gray-500 group-hover:text-gray-800 transition-colors">{label}</span>
      <div className="h-3 overflow-hidden rounded-full" style={{ background: `${color}18` }}>
        <Motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ root: mainRef, once: true }}
          transition={{ duration: 0.9, delay: index * 0.04 + 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: count > 0 ? `0 0 10px ${color}60, 0 2px 6px ${color}40` : "none",
          }}
        />
      </div>
      <span className="text-left text-xs font-black tabular-nums" style={{ color, textShadow: `0 0 8px ${color}50` }}>{count}</span>
    </Motion.div>
  );
}

function MonthBar({ label, count, max, index = 0 }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <Motion.span
        className="text-xs font-black"
        style={{ color: count > 0 ? "#C4795A" : "#9CA3AF", textShadow: count > 0 ? "0 0 10px rgba(196,121,90,0.5)" : "none" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.08 + 0.35 }}
      >
        {count || ""}
      </Motion.span>
      <div className="flex h-24 w-full items-end overflow-hidden rounded-t-2xl" style={{ background: "rgba(196,121,90,0.08)" }}>
        <Motion.div
          className="w-full rounded-t-2xl"
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 0.85, delay: index * 0.08 + 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            minHeight: count > 0 ? 5 : 0,
            background: "linear-gradient(to top, #9B5C38, #C4795A, #E8C4A0)",
            boxShadow: count > 0 ? "0 -4px 16px rgba(196,121,90,0.45), 0 0 8px rgba(196,121,90,0.3)" : "none",
          }}
        />
      </div>
      <span className="text-center text-xs font-semibold text-gray-400">{label}</span>
    </div>
  );
}

function DonutChart({ segments, total }) {
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;
  const sum = segments.reduce((acc, seg) => acc + seg.value, 0) || 1;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F5EDE3" strokeWidth="16" />
      {segments.map((seg, index) => {
        const len = (seg.value / sum) * circ;
        const offset = -segments.slice(0, index).reduce((acc, item) => acc + (item.value / sum) * circ, 0);
        return (
          <Motion.circle
            key={seg.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${len} ${circ}` }}
            transition={{ duration: 1, delay: index * 0.12 + 0.2, ease: "easeOut" }}
          />
        );
      })}
      <Motion.text x={cx} y={cy - 5} textAnchor="middle" fill="#1f2937" fontSize="20" fontWeight="800" fontFamily="Heebo,sans-serif" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, type: "spring" }}>
        {total}
      </Motion.text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="Heebo,sans-serif">סה״כ</text>
    </svg>
  );
}

function AnalyticsMiniStat({ label, value, tone = "warm" }) {
  const colors = tone === "cool"
    ? { bg: "rgba(74,155,168,0.10)", text: "#2E7A87" }
    : tone === "good"
      ? { bg: "rgba(34,197,94,0.10)", text: "#15803D" }
      : tone === "bad"
        ? { bg: "rgba(220,38,38,0.10)", text: "#B91C1C" }
        : { bg: "rgba(196,121,90,0.10)", text: "#9B5C38" };
  return (
    <div className="rounded-2xl px-4 py-3 text-right" style={{ background: colors.bg }}>
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums" style={{ color: colors.text }}>{value}</p>
    </div>
  );
}

function MonthlyTrendWidget({ trend = [], total = 0, totalRevenue = 0, hasRevenue = false, growthPct = 0 }) {
  const hasData = trend.some((month) => month.count > 0 || month.revenue > 0);
  const maxCount = Math.max(...trend.map((month) => month.count), 1);
  const maxRevenue = Math.max(...trend.map((month) => month.revenue || 0), 1);
  const trendTone = growthPct >= 0 ? "good" : "bad";
  const trendText = `${growthPct >= 0 ? "+" : ""}${growthPct}%`;

  if (!hasData) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No appointments have been created yet."
        text="לאחר יצירת תורים ראשונים תופיע כאן מגמה חודשית אמיתית."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AnalyticsMiniStat label="סה״כ תורים" value={total} />
        <AnalyticsMiniStat label="סה״כ הכנסות" value={hasRevenue ? formatCurrency(totalRevenue) : "אין נתוני הכנסה"} tone="cool" />
        <AnalyticsMiniStat label="שינוי מחודש קודם" value={trendText} tone={trendTone} />
      </div>

      <div className="flex items-end gap-3 rounded-3xl bg-[#FAF6F1] px-4 pb-4 pt-5">
        {trend.map((month, index) => {
          const countPct = Math.max(4, Math.round((month.count / maxCount) * 100));
          const revenuePct = hasRevenue ? Math.max(0, Math.round(((month.revenue || 0) / maxRevenue) * 100)) : 0;
          return (
            <div key={month.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="text-center">
                <p className="text-xs font-black text-[#9B5C38]">{month.count}</p>
                {hasRevenue ? <p className="text-[10px] font-bold text-[#2E7A87]">{formatCurrency(month.revenue)}</p> : null}
              </div>
              <div className="relative flex h-32 w-full items-end overflow-hidden rounded-t-2xl bg-white">
                {hasRevenue ? (
                  <Motion.div
                    className="absolute bottom-0 left-0 w-1/2 rounded-tl-xl"
                    initial={{ height: 0 }}
                    animate={{ height: `${revenuePct}%` }}
                    transition={{ duration: 0.8, delay: index * 0.06 }}
                    style={{ background: "linear-gradient(to top, #2E7A87, #4A9BA8)" }}
                    title="הכנסה חודשית"
                  />
                ) : null}
                <Motion.div
                  className={hasRevenue ? "mr-auto w-1/2 rounded-tr-xl" : "w-full rounded-t-2xl"}
                  initial={{ height: 0 }}
                  animate={{ height: `${countPct}%` }}
                  transition={{ duration: 0.85, delay: index * 0.07, ease: [0.34, 1.56, 0.64, 1] }}
                  style={{
                    minHeight: month.count > 0 ? 6 : 0,
                    background: "linear-gradient(to top, #9B5C38, #C4795A, #E8C4A0)",
                    boxShadow: month.count > 0 ? "0 -4px 16px rgba(196,121,90,0.35)" : "none",
                  }}
                  title="מספר תורים"
                />
              </div>
              <span className="text-center text-xs font-bold text-gray-500">{formatMonthHe(month.month)}</span>
            </div>
          );
        })}
      </div>

      {hasRevenue ? (
        <div className="flex flex-wrap gap-3 text-xs font-bold text-gray-500">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#C4795A]" /> תורים</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#4A9BA8]" /> הכנסות</span>
        </div>
      ) : null}
    </div>
  );
}

function CategoryAnalyticsWidget({ categories = [], total = 0, topCategory, leastCategory }) {
  if (!categories.length) {
    return (
      <EmptyState
        icon={BarChart2}
        title="No appointments have been created yet."
        text="לאחר יצירת תורים תופיע כאן חלוקה לפי קטגוריות טיפול."
      />
    );
  }

  const max = Math.max(...categories.map((category) => category.count), 1);
  const segments = categories.slice(0, 6).map((category, index) => ({
    label: category.category,
    value: category.count,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AnalyticsMiniStat label="הקטגוריה הפופולרית ביותר" value={topCategory?.category || "-"} />
        <AnalyticsMiniStat label="הקטגוריה הכי פחות פופולרית" value={leastCategory?.category || "-"} tone="cool" />
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <DonutChart segments={segments} total={total} />
        <div className="w-full flex-1 space-y-3">
          {categories.map((category, index) => (
            <div key={category.category} className="space-y-1 rounded-2xl bg-[#FAF6F1] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-700">{category.category}</span>
                <span className="text-xs font-black text-[#9B5C38]">{category.count}</span>
                <span className="text-xs font-bold text-gray-400">{category.percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <Motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((category.count / max) * 100)}%` }}
                  transition={{ duration: 0.7, delay: index * 0.05 }}
                  style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiInsights({ data, mainRef }) {
  const items = [];
  if (data.by_day?.length) {
    const top = [...data.by_day].sort((a, b) => b.count - a.count)[0];
    if (top?.count > 0) items.push(`יום ${top.day} הוא היום העמוס ביותר עם ${top.count} תורים.`);
  }
  if (data.by_hour?.length) {
    const top = [...data.by_hour].sort((a, b) => b.count - a.count)[0];
    if (top?.count > 0) items.push(`פיק פעילות בשעה ${top.hour}. כדאי לוודא זמינות צוות בשעה הזו.`);
  }
  if (data.by_treatment?.length) items.push(`הטיפול המבוקש ביותר: ${data.by_treatment[0].name} (${data.by_treatment[0].count} הזמנות).`);
  if (data.by_category?.length) items.push(`${data.by_category[0].category} מובילה עם ${data.by_category[0].count} תורים.`);
  if (data.monthly_trend?.length >= 2) {
    const last = data.monthly_trend.at(-1)?.count ?? 0;
    const prev = data.monthly_trend.at(-2)?.count ?? 0;
    if (prev > 0) {
      const pct = Math.round(((last - prev) / prev) * 100);
      items.push(`החודש ${pct >= 0 ? "עלה" : "ירד"} ב-${Math.abs(pct)}% לעומת החודש הקודם.`);
    }
  }

  return (
    <SectionCard icon={MessageCircle} title="תובנות וצ׳אטבוט" subtitle="נקודות שמומלץ לבדוק מתוך הנתונים">
      <Motion.div className="space-y-3" variants={stagger} initial="hidden" whileInView="show" viewport={{ root: mainRef, once: true }}>
        {items.length === 0 ? (
          <EmptyState icon={MessageCircle} title="אין מספיק נתונים לתובנות" text="לאחר שיצטברו תורים ושאלות, התובנות יוצגו כאן." />
        ) : (
          items.map((text) => (
            <Motion.div key={text} variants={fadeUp} className="flex items-start gap-3 rounded-2xl bg-[#FAF6F1] p-4">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C4795A]" />
              <p className="text-sm leading-6 text-gray-600">{text}</p>
            </Motion.div>
          ))
        )}
      </Motion.div>
    </SectionCard>
  );
}

function ContactInquiriesSection({ inquiries, onStatusChange, onFeedbackAdd, mainRef }) {
  const [listRef] = useAutoAnimate();
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const newCount = inquiries.filter((inquiry) => inquiry.status === "new").length;
  const handledCount = inquiries.filter((inquiry) => inquiry.status === "handled").length;

  const updateFeedbackDraft = (id, value) => {
    setFeedbackDrafts((drafts) => ({ ...drafts, [id]: value }));
  };

  const saveFeedbackDraft = (id) => {
    const text = String(feedbackDrafts[id] || "").trim();
    if (!text) return;
    onFeedbackAdd(id, text);
    setFeedbackDrafts((drafts) => ({ ...drafts, [id]: "" }));
  };

  return (
    <SectionCard
      icon={MessageCircle}
      title="פניות"
      subtitle={`${newCount} חדשות · ${handledCount} טופלו · ${inquiries.length} סה״כ`}
      className="lg:col-span-3"
    >
      <div ref={listRef} className="space-y-3">
        {inquiries.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="אין פניות צור קשר עדיין"
            text="פניות שיישלחו מהטופס באתר יופיעו כאן עם שם, טלפון והודעה."
          />
        ) : (
          inquiries.map((inquiry, index) => {
            const isHandled = inquiry.status === "handled";
            return (
              <Motion.article
                key={inquiry.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ root: mainRef, once: true }}
                transition={{ delay: index * 0.04 }}
                className="rounded-3xl border border-white/75 bg-white/70 p-4 shadow-sm transition hover:bg-[#FAF6F1]"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_2fr_auto_auto] lg:items-start">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400">שם</p>
                  <p className="text-sm font-extrabold text-gray-900">{inquiry.fullName}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400">טלפון</p>
                  <a href={`tel:${inquiry.phone}`} className="text-sm font-bold text-[#8B5030] hover:text-[#C4795A]">
                    {inquiry.phone}
                  </a>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400">הודעה</p>
                  <p className="text-sm leading-6 text-gray-600">{inquiry.message}</p>
                </div>

                <div className="text-right lg:text-left">
                  <p className="text-xs font-bold text-gray-400">תאריך</p>
                  <p className="text-xs font-semibold text-gray-500">{formatDateTime(inquiry.createdAt)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={isHandled
                      ? { background: "linear-gradient(135deg, #10B981, #059669)", boxShadow: "0 3px 10px rgba(16,185,129,0.35)" }
                      : { background: "linear-gradient(135deg, #4A9BA8, #2E7A87)", boxShadow: "0 3px 10px rgba(74,155,168,0.40)" }
                    }
                  >
                    {isHandled ? "טופל" : "חדש"}
                  </span>
                  {isHandled ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(inquiry.id, "new")}
                      className="rounded-full border border-[#4A9BA8]/30 bg-white/80 px-4 py-2 text-xs font-bold text-[#2E7A87] transition hover:bg-[#EBF8FA]"
                    >
                      החזר לחדש
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStatusChange(inquiry.id, "handled")}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition"
                      style={{ background: "linear-gradient(135deg, #10B981, #059669)", boxShadow: "0 4px 14px rgba(16,185,129,0.35)" }}
                    >
                      <CheckCircle2 size={14} />
                      טופל
                    </button>
                  )}
                </div>
                </div>

                <div className="mt-4 rounded-3xl bg-[#FAF6F1] p-4 text-right">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-gray-400">הערת צוות</span>
                    <textarea
                      rows={2}
                      value={feedbackDrafts[inquiry.id] || ""}
                      onChange={(event) => updateFeedbackDraft(inquiry.id, event.target.value)}
                      placeholder="כתבי כאן הערה פנימית לצוות..."
                      className="w-full resize-none rounded-2xl border border-[#E8C4A0]/50 bg-white/80 px-4 py-3 text-right text-sm text-gray-700 outline-none transition focus:border-[#C4795A] focus:ring-2 focus:ring-[#C4795A]/15"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => saveFeedbackDraft(inquiry.id)}
                    className="mt-3 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#C4795A]/20 transition hover:shadow-[#C4795A]/30"
                  >
                    שמור הערה
                  </button>

                  {(inquiry.feedbackNotes || []).length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {(inquiry.feedbackNotes || []).map((note) => (
                        <div key={note.id} className="rounded-2xl bg-white/75 p-3">
                          <div className="mb-1 text-[11px] font-bold text-gray-400">{formatDateTime(note.createdAt)}</div>
                          <p className="text-sm leading-6 text-gray-700">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-400">אין הערות צוות עדיין.</p>
                  )}
                </div>
              </Motion.article>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function ContactInquiriesShortcut({ inquiries, onOpen }) {
  const newCount = inquiries.filter((inquiry) => inquiry.status === "new").length;

  return (
    <SectionCard icon={MessageCircle} title="פניות" subtitle="מעקב אחר פניות צור קשר" className="lg:col-span-3">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#FAF6F1] p-5 text-right sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-3xl font-black text-gray-900">{newCount}</p>
          <p className="mt-1 text-sm font-bold text-[#8B5030]">פניות חדשות ממתינות לטיפול</p>
          <p className="mt-1 text-xs text-gray-500">{inquiries.length} פניות בסך הכל</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/25"
        >
          <MessageCircle size={17} />
          פתיחת פניות
        </button>
      </div>
    </SectionCard>
  );
}

function ActivityFeed({ recent, mainRef }) {
  const [listRef] = useAutoAnimate();
  return (
    <SectionCard icon={Activity} title="פעילות אחרונה" subtitle="התורים האחרונים שנכנסו למערכת" className="lg:col-span-2">
      <div ref={listRef} className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {recent.length === 0 ? (
          <EmptyState icon={Activity} title="אין פעילות אחרונה" text="כשתורים חדשים ייקלטו, הם יופיעו ברשימה הזו." />
        ) : (
          recent.map((appointment, index) => (
            <Motion.div
              key={appointment.id}
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ root: mainRef, once: true }}
              transition={{ delay: index * 0.04 }}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white/70 p-3 transition hover:bg-[#FAF6F1]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C4795A]/10 text-sm font-black text-[#8B5030]">
                {appointment.client_name?.charAt(0) ?? "?"}
              </div>
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-bold text-gray-900">{appointment.client_name}</p>
                <p className="truncate text-xs text-gray-500">{appointment.treatment_name}</p>
              </div>
              <div className="shrink-0 text-left">
                <p className="text-xs font-semibold text-gray-500">{appointment.date}</p>
                <p className="text-xs text-gray-400">{appointment.time}</p>
              </div>
            </Motion.div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

const TREATMENT_FIELDS = [
  { key: "name",                    label: "שם הטיפול",           required: true,  type: "text",     placeholder: "לדוגמה: ניקוי פנים עמוק" },
  { key: "class_name",              label: "קטגוריה ראשית",       required: false, type: "text",     placeholder: "לדוגמה: טיפולי קוסמטיקה" },
  { key: "category",                label: "תת-קטגוריה",          required: false, type: "text",     placeholder: "לדוגמה: טיפולי פנים" },
  { key: "aftercare",               label: "תיאור הטיפול",        required: false, type: "textarea", placeholder: "מה קורה בטיפול, כמה זמן נמשך..." },
  { key: "suitable_for_all_skins",  label: "למי מתאים",           required: false, type: "textarea", placeholder: "עור שמן, עור מעורב, גיל 25+..." },
  { key: "medical_limitations",     label: "למי לא מתאים",        required: false, type: "textarea", placeholder: "הריון, אקנה פעיל, עור רגיש מאוד..." },
  { key: "pregnancy_breastfeeding", label: "הריון והנקה",         required: false, type: "text",     placeholder: "לא מומלץ בהריון / בטוח בהריון" },
  { key: "results_timing",          label: "תוצאות ומתי רואים",   required: false, type: "text",     placeholder: "שיפור מיידי / לאחר 3 טיפולים..." },
  { key: "recommended_frequency",   label: "תדירות מומלצת",       required: false, type: "text",     placeholder: "סדרה של 6 טיפולים, פעם בשבועיים" },
  { key: "keywords",                label: "מילות מפתח / הערות",  required: false, type: "text",     placeholder: "אנטי-אייג'ינג, עדין, ללא כאב..." },
];

const EMPTY_TREATMENT = Object.fromEntries(TREATMENT_FIELDS.map((f) => [f.key, ""]));

function TreatmentForm({ initial = EMPTY_TREATMENT, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="rounded-2xl border border-[#E8C4A0]/60 bg-white p-5 shadow-sm" dir="rtl">
      <div className="grid gap-4 sm:grid-cols-2">
        {TREATMENT_FIELDS.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              {f.label}
              {f.required && <span className="mr-1 text-red-500">*</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                rows={2}
                value={form[f.key] || ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full resize-none rounded-xl border border-[#E8C4A0]/50 bg-[#FAF6F1] px-3 py-2 text-right text-sm text-gray-700 outline-none transition focus:border-[#C4795A] focus:ring-2 focus:ring-[#C4795A]/15"
              />
            ) : (
              <input
                type="text"
                value={form[f.key] || ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-[#E8C4A0]/50 bg-[#FAF6F1] px-3 py-2 text-right text-sm text-gray-700 outline-none transition focus:border-[#C4795A] focus:ring-2 focus:ring-[#C4795A]/15"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-start gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
        >
          ביטול
        </button>
        <button
          type="button"
          disabled={saving || !form.name?.trim()}
          onClick={() => onSave(form)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-2 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/20 disabled:opacity-50"
        >
          {saving ? createElement(RefreshCw, { size: 14, className: "animate-spin" }) : createElement(CheckCircle2, { size: 14 })}
          {saving ? "שומר..." : "שמור טיפול"}
        </button>
      </div>
    </div>
  );
}

function TreatmentsManagerPanel({ mainRef }) {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTreatments(await listTreatmentsDB()); } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (form) => {
    setSaving(true);
    try { await createTreatmentDB(form); await load(); setAdding(false); } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id, form) => {
    setSaving(true);
    try { await updateTreatmentDB(id, form); await load(); setEditingId(null); } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try { await deleteTreatmentDB(id); await load(); } catch { /* silent */ }
    finally { setDeletingId(null); setConfirmDelete(null); }
  };

  const filtered = treatments.filter((t) =>
    !search || t.name?.includes(search) || t.class_name?.includes(search) || t.category?.includes(search)
  );

  const grouped = filtered.reduce((acc, t) => {
    const cat = t.class_name || "ללא קטגוריה";
    (acc[cat] = acc[cat] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-4" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#E8C4A0]/50 bg-white px-3 py-2 shadow-sm">
          {createElement(Search, { size: 15, className: "shrink-0 text-[#C4795A]" })}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, קטגוריה..."
            className="w-full bg-transparent text-right text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
        </div>
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/20"
        >
          + הוסף טיפול
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <TreatmentForm
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          saving={saving}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/70" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Sparkles} title="לא נמצאו טיפולים" text="הוסיפי טיפול חדש או עדכני את Treatments.xlsx." />
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="overflow-hidden rounded-2xl border border-[#E8C4A0]/60 bg-[#FAF6F1]">
            <div className="border-b border-[#E8C4A0]/40 px-4 py-2 text-right">
              <span className="text-xs font-extrabold text-[#8B5030]">{cat}</span>
              <span className="mr-2 text-xs text-gray-400">{items.length} טיפולים</span>
            </div>
            <div className="divide-y divide-[#E8C4A0]/20">
              {items.map((t) => (
                <div key={t.id}>
                  {editingId === t.id ? (
                    <div className="p-3">
                      <TreatmentForm
                        initial={t}
                        onSave={(form) => handleUpdate(t.id, form)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/60">
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Source badge */}
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${t.source === "admin" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-gray-100 text-gray-400"}`}>
                          {t.source === "admin" ? "ידני" : "Excel"}
                        </span>
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => { setEditingId(t.id); setAdding(false); }}
                          className="rounded-lg border border-[#C4795A]/25 bg-white px-3 py-1 text-xs font-bold text-[#8B5030] transition hover:bg-[#F5EDE3]"
                        >
                          עריכה
                        </button>
                        {/* Delete */}
                        {confirmDelete === t.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(t.id)}
                              disabled={deletingId === t.id}
                              className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                            >
                              {deletingId === t.id ? "מוחק..." : "אשר מחיקה"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500"
                            >
                              ביטול
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(t.id)}
                            className="rounded-lg border border-red-100 bg-white px-3 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50"
                          >
                            מחיקה
                          </button>
                        )}
                      </div>
                      {/* Name + sub-category */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{t.name}</p>
                        {t.category && <p className="text-xs text-gray-400">{t.category}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="flex justify-end">
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#C4795A]">
          {createElement(RefreshCw, { size: 12 })} רענן רשימה
        </button>
      </div>
    </div>
  );
}

const KB_FILES = [
  {
    type: "treatments",
    label: "טיפולים",
    filename: "Treatments.xlsx",
    description: "מידע על הטיפולים, קטגוריות, התוויות נגד ותשובות לשאלות נפוצות",
  },
  {
    type: "questions",
    label: "שאלות ותשובות",
    filename: "questions.xlsx",
    description: "שאלות ותשובות ספציפיות לכל טיפול שהצ'אטבוט משתמש בהן",
  },
  {
    type: "category_questions",
    label: "שאלות לפי קטגוריה",
    filename: "category_questions.xlsx",
    description: "אילו שאלות הצ'אטבוט שואל לכל קטגוריה, באיזה סדר, עם אילו אפשרויות, ואיזה שדות נדרשים לפני המלצה",
  },
  {
    type: "chatbot_settings",
    label: "נושאים חסומים",
    filename: "chatbot_settings.xlsx",
    description: "נושאים שהצ'אטבוט לא יענה עליהם ויפנה לצוות — מחירים, זמינות, עובדות ועוד. הוסיפי שורות להוספת נושאים חדשים.",
  },
];

function KnowledgeBasePanel({ mainRef }) {
  const [info, setInfo] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadMsg, setUploadMsg] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRefs = useRef({});

  const loadInfo = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getExcelInfo();
      setInfo(data);
    } catch {
      // silently ignore on initial load failure
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadInfo(); }, [loadInfo]);

  const handleUpload = useCallback(async (fileType, file) => {
    setUploading(fileType);
    setUploadMsg((prev) => ({ ...prev, [fileType]: null }));
    try {
      const result = await uploadExcel(fileType, file);
      setUploadMsg((prev) => ({
        ...prev,
        [fileType]: { ok: true, text: `הועלה בהצלחה — ${result.rows} שורות` },
      }));
      await loadInfo();
      if (preview?.file_type === fileType) setPreview(null);
    } catch (e) {
      setUploadMsg((prev) => ({
        ...prev,
        [fileType]: { ok: false, text: e.message },
      }));
    } finally {
      setUploading(null);
      if (fileInputRefs.current[fileType]) fileInputRefs.current[fileType].value = "";
    }
  }, [loadInfo, preview]);

  const togglePreview = useCallback(async (fileType) => {
    if (preview?.file_type === fileType) { setPreview(null); return; }
    setLoadingPreview(fileType);
    try {
      const data = await getExcelPreview(fileType);
      setPreview({ file_type: fileType, ...data });
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(null);
    }
  }, [preview]);

  const infoByType = useMemo(() =>
    Object.fromEntries((info || []).map((i) => [i.file_type, i])), [info]);

  return (
    <SectionCard
      icon={Database}
      title="בסיס הידע של הצ'אטבוט"
      subtitle="ניהול קובצי Excel שהצ'אטבוט מסתמך עליהם למתן תשובות"
      className="lg:col-span-3"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {KB_FILES.map((cfg) => {
          const meta = infoByType[cfg.type];
          const msg = uploadMsg[cfg.type];
          const isUploading = uploading === cfg.type;
          const isPreviewing = preview?.file_type === cfg.type;
          const isLoadingPreview = loadingPreview === cfg.type;

          return (
            <div
              key={cfg.type}
              className="rounded-2xl border border-[#E8C4A0]/60 bg-[#FAF6F1] p-4 text-right"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-right">
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">{cfg.label}</p>
                    <p className="text-xs text-gray-500">{cfg.filename}</p>
                  </div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C4795A]/10 text-[#C4795A]">
                  {createElement(FileText, { size: 18 })}
                </div>
              </div>

              {/* Meta info */}
              <p className="mb-3 text-xs leading-5 text-gray-500">{cfg.description}</p>
              {meta && (
                <div className="mb-3 flex flex-wrap gap-2 text-right">
                  <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                    {meta.rows} שורות
                  </span>
                  {meta.last_modified && (
                    <span className="rounded-lg bg-white px-2 py-1 text-xs text-gray-400 shadow-sm">
                      עודכן {new Date(meta.last_modified).toLocaleDateString("he-IL")}
                    </span>
                  )}
                  <span className="rounded-lg bg-white px-2 py-1 text-xs text-gray-400 shadow-sm">
                    {meta.size_kb} KB
                  </span>
                </div>
              )}

              {/* Feedback message */}
              {msg && (
                <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {createElement(msg.ok ? CheckCircle2 : AlertCircle, { size: 14 })}
                  <span>{msg.text}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Upload */}
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-all ${
                    isUploading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-[#C4795A] text-white hover:bg-[#9B5C38]"
                  }`}
                >
                  {createElement(isUploading ? RefreshCw : Upload, {
                    size: 13,
                    className: isUploading ? "animate-spin" : "",
                  })}
                  {isUploading ? "מעלה..." : "העלאת קובץ"}
                  <input
                    ref={(el) => { fileInputRefs.current[cfg.type] = el; }}
                    type="file"
                    accept=".xlsx"
                    className="sr-only"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(cfg.type, file);
                    }}
                  />
                </label>

                {/* Preview toggle */}
                <button
                  onClick={() => togglePreview(cfg.type)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#C4795A]/30 bg-white px-3 py-2 text-xs font-bold text-[#C4795A] shadow-sm transition-all hover:bg-[#FDF3ED]"
                  disabled={isLoadingPreview}
                >
                  {createElement(isLoadingPreview ? RefreshCw : isPreviewing ? EyeOff : Eye, {
                    size: 13,
                    className: isLoadingPreview ? "animate-spin" : "",
                  })}
                  {isPreviewing ? "סגור תצוגה" : "תצוגה מקדימה"}
                </button>

                {/* Download */}
                {meta?.rows > 0 && (
                  <a
                    href={getExcelDownloadUrl(cfg.type)}
                    download={cfg.filename}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm transition-all hover:bg-gray-50"
                  >
                    {createElement(Download, { size: 13 })}
                    הורדה
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview table */}
      {preview && (
        <Motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-5 overflow-hidden rounded-2xl border border-[#E8C4A0]/60"
        >
          <div className="flex items-center justify-between bg-[#FAF6F1] px-4 py-3 text-right">
            <button
              onClick={() => setPreview(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {createElement(ChevronUp, { size: 14 })}
            </button>
            <p className="text-xs font-bold text-gray-600">
              {KB_FILES.find((f) => f.type === preview.file_type)?.label} — מציג {preview.rows.length} מתוך {preview.total_rows} שורות
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs" dir="rtl">
              <thead>
                <tr className="border-b border-[#E8C4A0]/40 bg-[#FDF3ED]">
                  {preview.columns.map((col) => (
                    <th key={col} className="whitespace-nowrap px-3 py-2 font-bold text-[#8B5030]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className={`border-b border-[#E8C4A0]/20 ${i % 2 === 0 ? "bg-white" : "bg-[#FAF6F1]"}`}>
                    {preview.columns.map((col) => (
                      <td key={col} className="max-w-[180px] truncate px-3 py-2 text-gray-600">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Motion.div>
      )}

      {/* Reload button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={loadInfo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#C4795A]"
        >
          {createElement(RefreshCw, { size: 13, className: refreshing ? "animate-spin" : "" })}
          רענן מידע
        </button>
      </div>
    </SectionCard>
  );
}

const PRIORITY_STYLE = {
  critical: { label: "קריטי", cls: "bg-red-50 text-red-700 border border-red-200" },
  high:     { label: "גבוה",  cls: "bg-orange-50 text-orange-700 border border-orange-200" },
  medium:   { label: "בינוני", cls: "bg-gray-100 text-gray-600 border border-gray-200" },
};

function ChatbotConfigPanel({ mainRef }) {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    getChatbotConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoadingConfig(false));
  }, []);

  const toggle = (cat) => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  if (loadingConfig) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/70" />
        ))}
      </div>
    );
  }

  if (!config || !config.categories?.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="לא נמצאו הגדרות קטגוריות"
        text="העלי קובץ category_questions.xlsx כדי להגדיר את שאלות הצ'אטבוט לפי קטגוריה."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* How the chatbot uses this legend */}
      <div className="rounded-2xl bg-gradient-to-l from-[#FAF6F1] to-[#F5EDE3] p-4 text-right">
        <p className="mb-2 text-sm font-extrabold text-gray-800">איך הצ׳אטבוט משתמש בהגדרות אלה?</p>
        <div className="grid gap-3 text-xs leading-6 text-gray-600 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span><span className="font-bold text-red-700">קריטי</span> — נשאל ראשון, חובה לפני כל שאלה אחרת</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
            <span><span className="font-bold text-orange-700">גבוה</span> — נשאל מיד אחרי קריטי, משפיע מאוד על ההמלצה</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
            <span><span className="font-bold text-gray-700">בינוני</span> — משפר את ההמלצה אם הלקוחה עונה</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          שדות <span className="font-bold text-[#C4795A]">מינימום נדרש</span> חייבים להיות מלאים לפני שהצ׳אטבוט יציע המלצה.
          הלקוחה יכולה גם לבקש "תמליצי לי עכשיו" אחרי שמולא לפחות שדה אחד.
        </p>
      </div>

      {/* Mode flow diagram */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-[#E8C4A0]/60 bg-white/80 px-4 py-3">
        {[
          { label: "idle", desc: "שאלות כלליות" },
          { label: "→" },
          { label: "questioning", desc: "אוסף מידע" },
          { label: "→" },
          { label: "sub_discovery", desc: "עוזרת להבין" },
          { label: "→" },
          { label: "recommending", desc: "ממליצה" },
        ].map((step, i) =>
          step.label === "→" ? (
            <ChevronRight key={i} size={14} className="shrink-0 text-gray-300" />
          ) : (
            <div key={i} className="shrink-0 text-center">
              <span className="block rounded-lg bg-[#C4795A]/10 px-2 py-1 text-xs font-bold text-[#8B5030]">{step.label}</span>
              <span className="mt-1 block text-[10px] text-gray-400">{step.desc}</span>
            </div>
          )
        )}
      </div>

      {/* Blocked topics live view */}
      {config.blocked_topics?.length > 0 && (
        <div className="rounded-2xl border border-[#E8C4A0]/60 bg-[#FAF6F1] p-4">
          <p className="mb-3 text-right text-sm font-extrabold text-gray-800">
            נושאים חסומים — הצ׳אטבוט יפנה לצוות במקום לענות
          </p>
          <div className="flex flex-wrap gap-2">
            {config.blocked_topics.map((t) => (
              <div
                key={t.topic}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  t.active
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-gray-100 text-gray-400 border border-gray-200 line-through"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.active ? "bg-red-500" : "bg-gray-300"}`} />
                {t.topic}
              </div>
            ))}
          </div>
          <p className="mt-3 text-right text-xs text-gray-400">
            לשינוי — ערכי את <span className="font-bold">chatbot_settings.xlsx</span> והעלי מחדש
          </p>
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-2">
        {config.categories.map((cat) => (
          <div key={cat.category} className="overflow-hidden rounded-2xl border border-[#E8C4A0]/60 bg-[#FAF6F1]">
            <button
              type="button"
              onClick={() => toggle(cat.category)}
              className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-[#F5EDE3]"
            >
              <div className="flex shrink-0 items-center gap-2">
                {createElement(expanded[cat.category] ? ChevronUp : ChevronDown, { size: 15, className: "text-gray-400" })}
                <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 shadow-sm">
                  {cat.total_fields} שאלות
                </span>
                <span className="rounded-lg bg-[#C4795A]/10 px-2 py-0.5 text-xs font-bold text-[#8B5030]">
                  מינימום {cat.can_recommend_after} שדות
                </span>
              </div>
              <span className="text-sm font-extrabold text-gray-900">{cat.category}</span>
            </button>

            {expanded[cat.category] && (
              <div className="space-y-2 border-t border-[#E8C4A0]/40 p-4">
                {cat.fields.map((field) => {
                  const pStyle = PRIORITY_STYLE[field.priority] ?? PRIORITY_STYLE.medium;
                  return (
                    <div
                      key={field.field}
                      className={`rounded-xl p-3 text-right ${field.is_minimum ? "border border-[#C4795A]/30 bg-white" : "border border-gray-100 bg-white/60"}`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${pStyle.cls}`}>
                            {pStyle.label}
                          </span>
                          {field.is_minimum && (
                            <span className="rounded-lg border border-[#C4795A]/25 bg-[#C4795A]/8 px-2 py-0.5 text-[11px] font-bold text-[#C4795A]">
                              מינימום
                            </span>
                          )}
                          {field.has_guidance && (
                            <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                              כולל הנחיה
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{field.question}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{field.field}</p>
                        </div>
                      </div>
                      {field.options?.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {field.options.map((opt) => (
                            <span key={opt} className="rounded-full bg-[#F5EDE3] px-2.5 py-0.5 text-xs font-semibold text-[#8B5030]">
                              {opt}
                            </span>
                          ))}
                          {field.has_guidance && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                              + לא יודעת
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPanel({ icon: Icon, title, text, actionLabel, onAction }) {
  return (
    <SectionCard icon={Icon} title={title} subtitle="אזור ניהול עתידי" className="lg:col-span-3">
      <div className="rounded-3xl bg-[#FAF6F1] p-8 text-right">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C4795A]/10 text-[#C4795A]">
          {createElement(Icon, { size: 26 })}
        </div>
        <h2 className="text-2xl font-black text-gray-900">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">{text}</p>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/25"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
}

function AppointmentsPanel({ recent, mainRef }) {
  return (
    <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <SectionCard icon={CalendarDays} title="ניהול תורים" subtitle="מעבר מהיר ליומן הקליניקה" className="lg:col-span-1">
        <div className="rounded-3xl bg-[#FAF6F1] p-5 text-right">
          <p className="text-sm leading-7 text-gray-600">
            מסך היומן הקיים כולל ניהול תורים, זמינות צוות, עדכון שעות ופעולות מזכירות.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign("/secretary")}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/25"
          >
            <CalendarDays size={17} />
            פתיחת יומן
          </button>
        </div>
      </SectionCard>
      <ActivityFeed recent={recent} mainRef={mainRef} />
    </Motion.div>
  );
}

function JobApplicationsSection({ applications, onStatusChange, onFeedbackAdd, mainRef }) {
  const [listRef] = useAutoAnimate();
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const newCount = applications.filter((app) => app.status === "חדש").length;
  const handledCount = applications.filter((app) => app.status === "טופל").length;

  const updateFeedbackDraft = (id, value) => {
    setFeedbackDrafts((drafts) => ({ ...drafts, [id]: value }));
  };

  const saveFeedbackDraft = (id) => {
    const text = String(feedbackDrafts[id] || "").trim();
    if (!text) return;
    onFeedbackAdd(id, text);
    setFeedbackDrafts((drafts) => ({ ...drafts, [id]: "" }));
  };

  return (
    <SectionCard
      icon={Briefcase}
      title="דרושים"
      subtitle={`${newCount} חדשות · ${handledCount} טופלו · ${applications.length} סה״כ`}
      className="lg:col-span-3"
    >
      <div ref={listRef} className="space-y-3">
        {applications.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="אין בקשות לעבודה עדיין"
            text="בקשות שיישלחו מעמוד הדרושים יופיעו כאן עם פרטים מלאים."
          />
        ) : (
          applications.map((app, index) => {
            const isHandled = app.status === "טופל";
            return (
              <Motion.article
                key={app.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ root: mainRef, once: true }}
                transition={{ delay: index * 0.04 }}
                className="rounded-3xl border border-white/75 bg-white/70 p-4 shadow-sm transition hover:bg-[#FAF6F1]"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-start">
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400">שם מלא</p>
                    <p className="text-sm font-extrabold text-gray-900">{app.fullName}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400">מייל</p>
                    <a href={`mailto:${app.email}`} className="text-sm font-bold text-[#8B5030] hover:text-[#C4795A]">
                      {app.email}
                    </a>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400">תחום</p>
                    <p className="text-sm font-bold text-gray-900">{app.field}</p>
                  </div>

                  <div className="text-right lg:text-left">
                    <p className="text-xs font-bold text-gray-400">תאריך</p>
                    <p className="text-xs font-semibold text-gray-500">{formatDateTime(app.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold text-white"
                      style={isHandled
                        ? { background: "linear-gradient(135deg, #10B981, #059669)", boxShadow: "0 3px 10px rgba(16,185,129,0.35)" }
                        : { background: "linear-gradient(135deg, #4A9BA8, #2E7A87)", boxShadow: "0 3px 10px rgba(74,155,168,0.40)" }
                      }
                    >
                      {isHandled ? "טופל" : "חדש"}
                    </span>
                    {isHandled ? (
                      <button
                        type="button"
                        onClick={() => onStatusChange(app.id, "חדש")}
                        className="rounded-full border border-[#4A9BA8]/30 bg-white/80 px-4 py-2 text-xs font-bold text-[#2E7A87] transition hover:bg-[#EBF8FA]"
                      >
                        החזר לחדש
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStatusChange(app.id, "טופל")}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition"
                        style={{ background: "linear-gradient(135deg, #10B981, #059669)", boxShadow: "0 4px 14px rgba(16,185,129,0.35)" }}
                      >
                        <CheckCircle2 size={14} />
                        טופל
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 mb-1">טלפון</p>
                    <a href={`tel:${app.phone}`} className="text-sm font-bold text-[#8B5030] hover:text-[#C4795A]">
                      {app.phone}
                    </a>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 mb-1">תיק עבודות / רשת חברתית</p>
                    <a href={app.portfolioLink} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#8B5030] hover:text-[#C4795A] break-all">
                      {app.portfolioLink}
                    </a>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl bg-[#FAF6F1] p-4 text-right">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-gray-400">הערת צוות</span>
                    <textarea
                      rows={2}
                      value={feedbackDrafts[app.id] || ""}
                      onChange={(event) => updateFeedbackDraft(app.id, event.target.value)}
                      placeholder="כתבי כאן הערה פנימית לצוות..."
                      className="w-full resize-none rounded-2xl border border-[#E8C4A0]/50 bg-white/80 px-4 py-3 text-right text-sm text-gray-700 outline-none transition focus:border-[#C4795A] focus:ring-2 focus:ring-[#C4795A]/15"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => saveFeedbackDraft(app.id)}
                    className="mt-3 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#C4795A]/20 transition hover:shadow-[#C4795A]/30"
                  >
                    שמור הערה
                  </button>

                  {(app.feedbackNotes || []).length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {(app.feedbackNotes || []).map((note) => (
                        <div key={note.id} className="rounded-2xl bg-white/75 p-3">
                          <div className="mb-1 text-[11px] font-bold text-gray-400">{formatDateTime(note.createdAt)}</div>
                          <p className="text-sm leading-6 text-gray-700">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-400">אין הערות צוות עדיין.</p>
                  )}
                </div>
              </Motion.article>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

const EMPTY_SYSTEM_SETTINGS = {
  business_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  opening_hours: "",
};

function SettingsInput({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <label className="block text-sm font-bold text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-[#E8C4A0]/70 bg-white px-4 py-3 text-right text-sm outline-none transition focus:border-[#C4795A] focus:ring-4 focus:ring-[#C4795A]/10"
      />
    </label>
  );
}

function SettingsTextarea({ label, value, onChange, required = false, placeholder = "" }) {
  return (
    <label className="block text-sm font-bold text-gray-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        rows={3}
        className="mt-1 w-full resize-none rounded-2xl border border-[#E8C4A0]/70 bg-white px-4 py-3 text-right text-sm outline-none transition focus:border-[#C4795A] focus:ring-4 focus:ring-[#C4795A]/10"
      />
    </label>
  );
}

function SettingsMessage({ type, children }) {
  if (!children) return null;
  const isError = type === "error";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
      isError
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700"
    }`}>
      {children}
    </div>
  );
}

function AiAssistantPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(null);
  const [keyInput, setKeyInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInfo(await getAiSettings());
    } catch (err) {
      setError(err.message || "שגיאה בטעינת הגדרות ה-AI");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveKey = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!keyInput.trim()) {
      setError("יש להדביק מפתח API");
      return;
    }
    setSaving(true);
    try {
      const res = await updateAiSettings({ api_key: keyInput.trim() });
      setKeyInput("");
      setMessage(res?.warning || "המפתח נשמר ואומת בהצלחה ✓");
      await load();
    } catch (err) {
      setError(err.message || "שמירת המפתח נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    setError("");
    setMessage("");
    try {
      await updateAiSettings({ enabled: !info?.enabled });
      await load();
    } catch (err) {
      setError(err.message || "עדכון נכשל");
    }
  };

  const status = info?.status;
  const STATUS_UI = {
    active: { label: "פעיל", color: "#3F9E6A" },
    off: { label: "כבוי", color: "#9AA0A6" },
    no_key: { label: "ללא מפתח", color: "#D9822B" },
    limited: { label: "המכסה נוצלה", color: "#D9822B" },
    invalid: { label: "מפתח לא תקין", color: "#C4544E" },
    error: { label: "תקלה זמנית", color: "#9AA0A6" },
  };
  const statusLabel = (STATUS_UI[status] || STATUS_UI.no_key).label;
  const statusColor = (STATUS_UI[status] || STATUS_UI.no_key).color;

  const ALERTS = {
    no_key: {
      bg: "#EEF5F6", border: "#9BC7CE", icon: "💡",
      title: "עדיין ללא מפתח AI",
      body: "הצ׳אט עובד מצוין עם מאגר הידע 💛 להוספת ניסוח חכם בשאלות חופשיות — צרו מפתח חינמי (בקישור למטה) והדביקו אותו כאן. אפשר גם להשאיר כך.",
    },
    limited: {
      bg: "#FDF3E7", border: "#E7B36E", icon: "🕒",
      title: "המכסה החינמית של היום נוצלה",
      body: "הצ׳אט ממשיך לעבוד כרגיל עם מאגר הידע 💛 המכסה מתאפסת אוטומטית מדי יום — או שאפשר ליצור מפתח חדש (חינם) ולהדביק אותו כאן כדי לחדש עכשיו.",
    },
    invalid: {
      bg: "#FBECEB", border: "#D98B86", icon: "⚠️",
      title: "המפתח כבר לא תקין",
      body: "הצ׳אט ממשיך לעבוד כרגיל. כדי להחזיר את העוזר החכם — צרו מפתח חדש (חינם) בקישור למטה והדביקו אותו כאן.",
    },
    error: {
      bg: "#F3F1EE", border: "#C9C3BB", icon: "🔌",
      title: "תקלת חיבור זמנית",
      body: "יש תקלה זמנית בחיבור ל-AI. הצ׳אט ממשיך לעבוד כרגיל — בדרך כלל זה מסתדר מעצמו.",
    },
  };
  const alert = ALERTS[status];

  return (
    <SectionCard
      icon={Sparkles}
      title="עוזר ה-AI של הצ׳אט"
      subtitle="שכבת בינה אופציונלית — הצ׳אט עובד מצוין גם בלעדיה"
      className="lg:col-span-3"
    >
      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-[#FAF6F1]" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF6F1] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: statusColor }} />
              <span className="text-sm font-black text-gray-800">מצב: {statusLabel}</span>
              {info?.key_masked ? <span className="text-xs text-gray-500">({info.key_masked})</span> : null}
            </div>
            <button
              onClick={toggle}
              className="rounded-full border border-[#C4795A]/40 px-4 py-1.5 text-xs font-black text-[#9B5C38] transition hover:bg-[#C4795A] hover:text-white"
            >
              {info?.enabled ? "כבה את ה-AI" : "הפעל את ה-AI"}
            </button>
          </div>

          {alert ? (
            <div
              className="flex items-start gap-3 rounded-2xl border px-4 py-3"
              style={{ background: alert.bg, borderColor: alert.border }}
            >
              <span className="text-xl leading-none">{alert.icon}</span>
              <div>
                <p className="text-sm font-black text-gray-800">{alert.title}</p>
                <p className="mt-1 text-sm leading-6 text-gray-600">{alert.body}</p>
              </div>
            </div>
          ) : null}

          <p className="text-sm leading-7 text-gray-600">
            העוזר החכם משפר את הניסוח בשאלות חופשיות. הוא חינמי לגמרי (Google Gemini) — ואם המפתח ייגמר או יפסיק לעבוד, הצ׳אט ימשיך לעבוד כרגיל עם מאגר הידע. כדי לחדש, צרו מפתח חינמי חדש והדביקו אותו כאן.
          </p>

          <ol className="space-y-2 rounded-2xl border border-[#C4795A]/15 bg-white px-4 py-3 text-sm leading-7 text-gray-700">
            <li>
              1. פתחו את דף המפתחות של Google:{" "}
              <a href={info?.get_key_url} target="_blank" rel="noreferrer" className="font-black text-[#4A9BA8] underline">
                יצירת מפתח חינמי ↗
              </a>
            </li>
            <li>2. התחברו עם חשבון Google ולחצו על "Create API key".</li>
            <li>3. העתיקו את המפתח, הדביקו אותו למטה ולחצו "שמירת מפתח".</li>
          </ol>

          <form onSubmit={saveKey} className="space-y-3">
            <SettingsInput label="מפתח API חדש" value={keyInput} onChange={setKeyInput} type="password" placeholder="הדביקי כאן את המפתח" />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C4795A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#C4795A]/20 transition hover:bg-[#9B5C38] disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "מאמת ושומר..." : "שמירת מפתח"}
            </button>
          </form>

          <SettingsMessage type="error">{error}</SettingsMessage>
          <SettingsMessage type="success">{message}</SettingsMessage>
        </div>
      )}
    </SectionCard>
  );
}


function AdminSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [savingSystem, setSavingSystem] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [canUpdateSystem, setCanUpdateSystem] = useState(false);
  const [account, setAccount] = useState({ username: "", email: "", role: "" });
  const [systemForm, setSystemForm] = useState(EMPTY_SYSTEM_SETTINGS);
  const [passwordForm, setPasswordForm] = useState({ old_password: "", password: "" });

  const setSystemField = (field, value) => {
    setSystemForm((current) => ({ ...current, [field]: value }));
  };

  const setAccountField = (field, value) => {
    setAccount((current) => ({ ...current, [field]: value }));
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSettings();
      setSystemForm({ ...EMPTY_SYSTEM_SETTINGS, ...(data.settings || {}) });
      setAccount({
        username: data.user?.username || "",
        email: data.user?.email || "",
        role: data.user?.role || "",
      });
      setCanUpdateSystem(Boolean(data.can_update_system));
    } catch (err) {
      setError(err.message || "שגיאה בטעינת הגדרות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const validateEmail = (value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  const validatePhone = (value) => !value || /^\+?[0-9*][0-9*\s-]{2,18}$/.test(value);

  const saveAccount = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!account.username.trim()) {
      setError("שם משתמש הוא שדה חובה");
      return;
    }
    if (!validateEmail(account.email)) {
      setError("כתובת האימייל אינה תקינה");
      return;
    }
    setSavingAccount(true);
    try {
      const result = await updateSettingsAccount({
        username: account.username.trim(),
        email: account.email.trim(),
      });
      setAccount({
        username: result.user?.username || account.username,
        email: result.user?.email || account.email,
        role: result.user?.role || account.role,
      });
      setMessage("פרטי החשבון נשמרו בהצלחה");
    } catch (err) {
      setError(err.message || "שמירת פרטי החשבון נכשלה");
    } finally {
      setSavingAccount(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!passwordForm.old_password) {
      setError("יש להזין סיסמה נוכחית");
      return;
    }
    if (!passwordForm.password || passwordForm.password.length < 8) {
      setError("הסיסמה החדשה חייבת להכיל לפחות 8 תווים");
      return;
    }
    setSavingPassword(true);
    try {
      await updateSettingsPassword(passwordForm);
      setPasswordForm({ old_password: "", password: "" });
      setMessage("הסיסמה עודכנה בהצלחה");
    } catch (err) {
      setError(err.message || "עדכון הסיסמה נכשל");
    } finally {
      setSavingPassword(false);
    }
  };

  const saveSystem = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!systemForm.business_name.trim() || !systemForm.phone.trim() || !systemForm.email.trim() || !systemForm.address.trim() || !systemForm.opening_hours.trim()) {
      setError("יש למלא את כל שדות החובה בהגדרות העסק");
      return;
    }
    if (!validatePhone(systemForm.phone) || !validatePhone(systemForm.whatsapp)) {
      setError("מספר הטלפון אינו תקין");
      return;
    }
    if (!validateEmail(systemForm.email)) {
      setError("כתובת האימייל אינה תקינה");
      return;
    }
    setSavingSystem(true);
    try {
      const result = await updateSystemSettings(systemForm);
      setSystemForm({ ...EMPTY_SYSTEM_SETTINGS, ...(result.settings || {}) });
      setMessage("הגדרות העסק נשמרו בהצלחה");
    } catch (err) {
      setError(err.message || "שמירת הגדרות העסק נכשלה");
    } finally {
      setSavingSystem(false);
    }
  };

  if (loading) {
    return (
      <SectionCard icon={Settings} title="הגדרות מערכת" subtitle="טוען הגדרות..." className="lg:col-span-3">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl bg-[#FAF6F1]" />
          <div className="h-48 animate-pulse rounded-3xl bg-[#FAF6F1]" />
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:col-span-3 lg:grid-cols-3">
      <SectionCard icon={ShieldCheck} title="הגדרות חשבון" subtitle="פרטי המשתמש המחובר" className="lg:col-span-1">
        <form onSubmit={saveAccount} className="space-y-4">
          <div className="rounded-2xl bg-[#FAF6F1] px-4 py-3">
            <p className="text-xs font-bold text-gray-500">תפקיד</p>
            <p className="mt-1 text-sm font-black text-[#9B5C38]">{account.role || "-"}</p>
          </div>
          <SettingsInput label="שם משתמש" value={account.username} onChange={(value) => setAccountField("username", value)} required />
          <SettingsInput label="אימייל" value={account.email} onChange={(value) => setAccountField("email", value)} type="email" />
          <button type="submit" disabled={savingAccount} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C4795A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#C4795A]/20 transition hover:bg-[#9B5C38] disabled:opacity-60">
            <Save size={16} />
            {savingAccount ? "שומר..." : "שמירת פרטי חשבון"}
          </button>
        </form>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="שינוי סיסמה" subtitle="נדרשת סיסמה נוכחית לאימות" className="lg:col-span-1">
        <form onSubmit={savePassword} className="space-y-4">
          <SettingsInput label="סיסמה נוכחית" value={passwordForm.old_password} onChange={(value) => setPasswordForm((current) => ({ ...current, old_password: value }))} type="password" required />
          <SettingsInput label="סיסמה חדשה" value={passwordForm.password} onChange={(value) => setPasswordForm((current) => ({ ...current, password: value }))} type="password" required />
          <button type="submit" disabled={savingPassword} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#4A9BA8] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#4A9BA8]/20 transition hover:bg-[#2E7A87] disabled:opacity-60">
            <Save size={16} />
            {savingPassword ? "מעדכן..." : "עדכון סיסמה"}
          </button>
        </form>
      </SectionCard>

      <div className="space-y-4 lg:col-span-1">
        <SettingsMessage type="error">{error}</SettingsMessage>
        <SettingsMessage type="success">{message}</SettingsMessage>
        <SectionCard icon={Settings} title="גישה והרשאות" subtitle="ניהול הגדרות עסק">
          <p className="text-sm leading-7 text-gray-600">
            {canUpdateSystem
              ? "למשתמש זה יש הרשאת מנהל לעדכון פרטי העסק."
              : "רק מנהל/ת יכול/ה לעדכן את פרטי העסק. ניתן לעדכן כאן רק את פרטי החשבון האישיים."}
          </p>
        </SectionCard>
      </div>

      <SectionCard icon={Settings} title="הגדרות עסק" subtitle="פרטי הקליניקה שמורים בשרת" className="lg:col-span-3">
        <form onSubmit={saveSystem} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SettingsInput label="שם העסק" value={systemForm.business_name} onChange={(value) => setSystemField("business_name", value)} required />
            <SettingsInput label="טלפון" value={systemForm.phone} onChange={(value) => setSystemField("phone", value)} required placeholder="*3691" />
            <SettingsInput label="WhatsApp" value={systemForm.whatsapp} onChange={(value) => setSystemField("whatsapp", value)} placeholder="0500000000" />
            <SettingsInput label="אימייל עסקי" value={systemForm.email} onChange={(value) => setSystemField("email", value)} type="email" required />
            <SettingsInput label="כתובת" value={systemForm.address} onChange={(value) => setSystemField("address", value)} required />
            <SettingsTextarea label="שעות פתיחה" value={systemForm.opening_hours} onChange={(value) => setSystemField("opening_hours", value)} required placeholder="א׳-ה׳ 09:00-18:00" />
          </div>
          <button type="submit" disabled={!canUpdateSystem || savingSystem} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#C4795A]/20 transition hover:shadow-[#C4795A]/30 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto">
            <Save size={16} />
            {savingSystem ? "שומר..." : "שמירת הגדרות עסק"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}

function Sidebar({ collapsed, onToggle, activeTab, onTabChange }) {
  return (
    <Motion.aside
      className="hidden h-full shrink-0 flex-col overflow-hidden lg:flex"
      style={{
        background: "linear-gradient(180deg, #160804 0%, #2C1A0A 45%, #3D2418 100%)",
        borderLeft: "1px solid rgba(196,121,90,0.18)",
        boxShadow: "-4px 0 32px rgba(0,0,0,0.25), inset -1px 0 0 rgba(196,121,90,0.08)",
      }}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Logo zone */}
      <div
        className="flex items-center justify-center border-b px-4 py-5"
        style={{ borderColor: "rgba(196,121,90,0.18)", minHeight: 84 }}
      >
        <AnimatePresence mode="wait">
          {collapsed ? (
            <Motion.div key="collapsed-logo" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <polygon points="11,0 22,11 11,22 0,11" fill="#C4795A" opacity="0.9" />
                <polygon points="11,5 17,11 11,17 5,11" fill="#2C1A0A" />
              </svg>
            </Motion.div>
          ) : (
            <Motion.div key="full-logo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LogoMark size="sm" />
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2.5 py-4">
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <Motion.button
              key={item.label}
              type="button"
              onClick={() => onTabChange(item.key)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition-all duration-200"
              style={
                isActive
                  ? {
                      background: "linear-gradient(90deg, rgba(196,121,90,0.22) 0%, rgba(196,121,90,0.06) 100%)",
                      boxShadow: "inset 2px 0 0 #C4795A, 0 0 20px rgba(196,121,90,0.08)",
                      color: "#E8C4A0",
                    }
                  : { color: "rgba(232,196,160,0.40)" }
              }
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 + 0.1 }}
              whileHover={!isActive ? { color: "rgba(232,196,160,0.80)", backgroundColor: "rgba(255,255,255,0.04)" } : {}}
              whileTap={{ scale: 0.96 }}
            >
              <Icon size={18} className="shrink-0" style={{ filter: isActive ? "drop-shadow(0 0 6px rgba(196,121,90,0.6))" : "none" }} />
              <AnimatePresence>
                {!collapsed && (
                  <Motion.span
                    className="whitespace-nowrap text-sm font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {item.label}
                  </Motion.span>
                )}
              </AnimatePresence>
            </Motion.button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="m-3 flex items-center justify-center rounded-2xl p-3 transition-all duration-200"
        style={{ background: "rgba(196,121,90,0.10)", color: "#C4795A" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(196,121,90,0.20)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(196,121,90,0.10)"; }}
      >
        <Motion.div animate={{ rotate: collapsed ? 180 : 0 }}>
          <ChevronRight size={16} />
        </Motion.div>
      </button>
    </Motion.aside>
  );
}

function MobileTabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-3xl border border-white/60 bg-white/55 p-2 shadow-md backdrop-blur-xl lg:hidden">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200"
            style={
              isActive
                ? {
                    background: "linear-gradient(135deg, #C4795A, #9B5C38)",
                    color: "white",
                    boxShadow: "0 4px 16px rgba(196,121,90,0.40)",
                  }
                : { background: "rgba(255,255,255,0.75)", color: "#8B5030" }
            }
          >
            <Icon size={15} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ onRefresh, refreshing, unreadCount = 0, currentTab }) {
  const tabLabel = NAV_ITEMS.find(i => i.key === currentTab)?.label ?? "";
  return (
    <div
      className="sticky top-0 z-20 px-4 py-3 sm:px-6"
      style={{
        background: "rgba(250,247,242,0.82)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(196,121,90,0.12)",
        boxShadow: "0 1px 20px rgba(155,92,56,0.06)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        {/* breadcrumb */}
        {tabLabel && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs font-bold text-[#C4795A]">Admin</span>
            <ChevronRight size={12} className="text-[#C4795A]/40" />
            <span className="text-xs font-bold text-gray-700">{tabLabel}</span>
          </div>
        )}
        <div
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-4 py-2"
          style={{ background: "rgba(255,255,255,0.80)", border: "1px solid rgba(196,121,90,0.18)", boxShadow: "0 2px 8px rgba(155,92,56,0.06)" }}
        >
          <Search size={15} className="shrink-0 text-[#C4795A]" />
          <input type="text" placeholder="חיפוש..." dir="rtl" className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.80)", color: "#8B5030", border: "1px solid rgba(196,121,90,0.15)" }}
        >
          <Motion.span animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: "linear" }}>
            <RefreshCw size={17} />
          </Motion.span>
        </button>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.80)", color: "#8B5030", border: "1px solid rgba(196,121,90,0.15)" }}
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-black text-white"
              style={{ background: "linear-gradient(135deg, #C4795A, #9B5C38)", boxShadow: "0 2px 8px rgba(196,121,90,0.5)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function exportCsv(recent) {
  const header = "שם לקוח,טלפון,טיפול,קטגוריה,תאריך,שעה\n";
  const rows = recent.map((appointment) =>
    [appointment.client_name, appointment.client_phone ?? "", appointment.treatment_name, appointment.treatment_category ?? "", appointment.date, appointment.time]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
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

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRange, setActiveRange] = useState("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [contactInquiries, setContactInquiries] = useState(() => getContactInquiries());
  const [jobApplications, setJobApplications] = useState(() => getJobApplications());
  const mainRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const range = RANGES.find((item) => item.key === activeRange);
      const result = await fetchAnalytics(range ? range.getDates() : {});
      setData(result);
    } catch (error) {
      console.error(error);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRange]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const refreshContactInquiries = () => setContactInquiries(getContactInquiries());
    const handleStorage = (event) => {
      if (event.key === CONTACT_INQUIRIES_STORAGE_KEY) refreshContactInquiries();
    };

    window.addEventListener(CONTACT_INQUIRY_EVENT, refreshContactInquiries);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CONTACT_INQUIRY_EVENT, refreshContactInquiries);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const changeContactInquiryStatus = useCallback((id, status) => {
    updateContactInquiryStatus(id, status);
    setContactInquiries(getContactInquiries());
  }, []);

  const addContactInquiryNote = useCallback((id, noteText) => {
    addContactInquiryFeedback(id, noteText);
    setContactInquiries(getContactInquiries());
  }, []);

  useEffect(() => {
    const refreshJobApplications = () => setJobApplications(getJobApplications());
    const handleStorage = (event) => {
      if (event.key === JOB_APPLICATIONS_STORAGE_KEY) refreshJobApplications();
    };

    window.addEventListener(JOB_APPLICATION_EVENT, refreshJobApplications);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(JOB_APPLICATION_EVENT, refreshJobApplications);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const changeJobApplicationStatus = useCallback((id, status) => {
    updateJobApplicationStatus(id, status);
    setJobApplications(getJobApplications());
  }, []);

  const addJobApplicationNote = useCallback((id, noteText) => {
    addJobApplicationFeedback(id, noteText);
    setJobApplications(getJobApplications());
  }, []);

  const analytics = useMemo(() => ({
    byTreatment: data?.by_treatment ?? [],
    byCategory: data?.by_category ?? [],
    topCategory: data?.top_category ?? null,
    leastCategory: data?.least_category ?? null,
    byDay: data?.by_day ?? [],
    byHour: data?.by_hour ?? [],
    monthlyTrend: data?.monthly_trend ?? [],
    totalRevenue: data?.total_revenue ?? 0,
    hasRevenue: Boolean(data?.has_revenue),
    monthlyGrowthPct: data?.monthly_growth_pct ?? 0,
    recent: data?.recent ?? [],
  }), [data]);

  if (loading) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[#FAF6F1]" dir="rtl">
        <PageGlow />
        <div className="relative w-full max-w-4xl space-y-5 p-6">
          <div className="h-36 animate-pulse rounded-3xl bg-white/65 shadow-xl" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-white/70 shadow-lg" />)}
          </div>
          <div className="h-48 animate-pulse rounded-3xl bg-white/65 shadow-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[#FAF6F1] px-6" dir="rtl">
        <PageGlow />
        <div className="relative max-w-md rounded-3xl border border-white/75 bg-white/80 p-8 text-center shadow-xl">
          <EmptyState icon={RefreshCw} title="שגיאה בטעינת הנתונים" text="לא הצלחנו לקבל את נתוני הדשבורד. נסי לרענן שוב בעוד רגע." />
          <button type="button" onClick={() => load(false)} className="mt-5 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/25">
            טעינה מחדש
          </button>
        </div>
      </div>
    );
  }

  const maxTreatment = Math.max(...analytics.byTreatment.map((item) => item.count), 1);
  const maxDay = Math.max(...analytics.byDay.map((item) => item.count), 1);
  const maxHour = Math.max(...analytics.byHour.map((item) => item.count), 1);
  const maxMonthly = Math.max(...analytics.monthlyTrend.map((item) => item.count), 1);
  const donutSegs = analytics.byCategory.slice(0, 6).map((category, index) => ({
    label: category.category,
    value: category.count,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#FAF6F1] text-gray-900" dir="rtl">
      <PageGlow />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          onRefresh={() => load(true)}
          refreshing={refreshing}
          unreadCount={contactInquiries.filter(i => i.status === "new").length + jobApplications.filter(a => a.status === "חדש").length}
          currentTab={activeTab}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pb-10 pt-5 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <Motion.header
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="relative overflow-hidden rounded-[2rem] text-white shadow-2xl shadow-[#9B5C38]/25"
              style={{
                background: "linear-gradient(135deg, #160804 0%, #2C1A0A 30%, #5E3420 70%, #C4795A 100%)",
                boxShadow: "0 20px 60px rgba(22,8,4,0.45), 0 0 0 1px rgba(196,121,90,0.20)",
              }}
            >
              {/* multi-layer glow overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: [
                    "radial-gradient(circle at 10% 10%, rgba(232,196,160,0.30) 0%, transparent 40%)",
                    "radial-gradient(circle at 90% 0%, rgba(255,255,255,0.12) 0%, transparent 30%)",
                    "radial-gradient(circle at 50% 100%, rgba(196,121,90,0.20) 0%, transparent 50%)",
                  ].join(", "),
                }}
              />
              <div className="relative p-6 sm:p-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="text-right">
                    {/* eyebrow badge */}
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur">
                      <Sparkles size={13} style={{ color: "#E8C4A0" }} />
                      <span style={{ color: "#E8C4A0" }}>MeDay Beauty Center</span>
                    </div>
                    {/* title with gradient text */}
                    <h1
                      className="text-4xl font-black leading-tight sm:text-5xl"
                      style={{
                        background: "linear-gradient(135deg, #FFFFFF 30%, #E8C4A0 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        filter: "drop-shadow(0 2px 12px rgba(232,196,160,0.30))",
                      }}
                    >
                      אזור ניהול
                    </h1>
                    {/* diamond divider */}
                    <div className="my-4 flex items-center gap-4">
                      <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, rgba(232,196,160,0.40), transparent)", maxWidth: 120 }} />
                      <svg width="8" height="8" viewBox="0 0 8 8">
                        <polygon points="4,0 8,4 4,8 0,4" fill="#E8C4A0" opacity="0.75" />
                        <polygon points="4,2 6,4 4,6 2,4" fill="#2C1A0A" />
                      </svg>
                      <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(232,196,160,0.40), transparent)", maxWidth: 120 }} />
                    </div>
                    <p className="max-w-xl text-sm leading-7" style={{ color: "rgba(255,255,255,0.60)" }}>
                      {new Intl.DateTimeFormat("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date())}
                      {" · "}
                      מבט מקצועי על הפעילות של הקליניקה
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
                    <button
                      type="button"
                      onClick={() => window.location.assign("/")}
                      className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition"
                      style={{ borderColor: "rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.08)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    >
                      <Home size={16} />
                      חזרה לאתר
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/admin/staff-management")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#8B5030", boxShadow: "0 4px 16px rgba(0,0,0,0.20)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAF6F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
                    >
                      <Users size={16} />
                      ניהול מזכירות
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/admin/employees")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#8B5030", boxShadow: "0 4px 16px rgba(0,0,0,0.20)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAF6F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
                    >
                      <Users size={16} />
                      ניהול עובדים
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/admin/customers")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#8B5030", boxShadow: "0 4px 16px rgba(0,0,0,0.20)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAF6F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
                    >
                      <Users size={16} />
                      ניהול לקוחות
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/admin/audit-log")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#8B5030", boxShadow: "0 4px 16px rgba(0,0,0,0.20)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAF6F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
                    >
                      <FileText size={16} />
                      Audit log
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/admin/employee-shifts")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#8B5030", boxShadow: "0 4px 16px rgba(0,0,0,0.20)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAF6F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
                    >
                      <CalendarDays size={16} />
                      ניהול משמרות עובדים
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.assign("/secretary")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#8B5030", boxShadow: "0 4px 16px rgba(0,0,0,0.20)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAF6F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
                    >
                      <CalendarDays size={16} />
                      יומן תורים
                    </button>
                  </div>
                </div>
              </div>
            </Motion.header>

            <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "dashboard" ? (
              <>
            {/* KPI cards */}
            <Motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ root: mainRef, once: true }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard index={0} icon={Users} label="סה״כ תורים" value={data.total ?? 0} helper="כלל ההזמנות" />
              <StatCard index={1} icon={Calendar} label="תורים היום" value={data.today ?? 0} helper="פעילות יומית" />
              <StatCard index={2} icon={TrendingUp} label="תורים השבוע" value={data.this_week ?? 0} helper="מומנטום שבועי" />
              <StatCard index={3} icon={Sparkles} label="סוגי טיפולים" value={analytics.byTreatment.length} helper="טיפולים עם ביקוש" />
            </Motion.div>

            {/* Monthly trend + AI insights */}
            <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <SectionCard icon={TrendingUp} title="מגמה חודשית" subtitle="6 חודשים אחרונים" className="lg:col-span-2">
                <MonthlyTrendWidget
                  trend={analytics.monthlyTrend}
                  total={data.total ?? 0}
                  totalRevenue={analytics.totalRevenue}
                  hasRevenue={analytics.hasRevenue}
                  growthPct={analytics.monthlyGrowthPct}
                />
              </SectionCard>
              <AiInsights data={data} mainRef={mainRef} />
            </Motion.div>

            {/* Contact shortcut */}
            <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <ContactInquiriesShortcut inquiries={contactInquiries} onOpen={() => setActiveTab("inquiries")} />
            </Motion.div>

            {/* Activity + calendar shortcut */}
            <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <ActivityFeed recent={analytics.recent} mainRef={mainRef} />
              <SectionCard icon={CalendarDays} title="קיצור לניהול" subtitle="מעבר מהיר ליומן הקליניקה">
                <div className="rounded-2xl p-5 text-right" style={{ background: "linear-gradient(135deg, rgba(196,121,90,0.06), rgba(74,155,168,0.04))" }}>
                  <p className="text-sm leading-7 text-gray-600">
                    ניהול תורים, זמינות צוות ועדכון שעות מתבצעים במסך היומן.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.assign("/secretary")}
                    className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #C4795A, #9B5C38)", boxShadow: "0 6px 20px rgba(196,121,90,0.35)" }}
                  >
                    <CalendarDays size={17} />
                    פתיחת יומן
                  </button>
                </div>
              </SectionCard>
            </Motion.div>
              </>
            ) : null}

            {activeTab === "appointments" ? (
              <AppointmentsPanel recent={analytics.recent} mainRef={mainRef} />
            ) : null}

            {activeTab === "inquiries" ? (
              <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <ContactInquiriesSection
                  inquiries={contactInquiries}
                  onStatusChange={changeContactInquiryStatus}
                  onFeedbackAdd={addContactInquiryNote}
                  mainRef={mainRef}
                />
              </Motion.div>
            ) : null}

            {activeTab === "jobs" ? (
              <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <JobApplicationsSection
                  applications={jobApplications}
                  onStatusChange={changeJobApplicationStatus}
                  onFeedbackAdd={addJobApplicationNote}
                  mainRef={mainRef}
                />
              </Motion.div>
            ) : null}


            {activeTab === "analytics" ? (
              <>
                {/* Range selector + export */}
                <Motion.div
                  variants={fadeUp}
                  {...inView(mainRef)}
                  className="flex flex-col gap-3 overflow-hidden rounded-3xl p-3 shadow-md sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.80) 0%, rgba(242,212,190,0.30) 100%)",
                    border: "1px solid rgba(196,121,90,0.18)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div className="flex flex-wrap gap-2">
                    {RANGES.map((range) => (
                      <button
                        key={range.key}
                        type="button"
                        onClick={() => setActiveRange(range.key)}
                        className="rounded-full px-4 py-2 text-xs font-bold transition-all duration-200"
                        style={activeRange === range.key
                          ? { background: "linear-gradient(135deg, #C4795A, #9B5C38)", color: "white", boxShadow: "0 4px 14px rgba(196,121,90,0.35)" }
                          : { background: "rgba(255,255,255,0.75)", color: "#8B5030" }
                        }
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="px-2 text-xs text-gray-400">מתעדכן אוטומטית כל דקה</p>
                    <button
                      type="button"
                      onClick={() => exportCsv(analytics.recent)}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition"
                      style={{ background: "linear-gradient(135deg, #4A9BA8, #2E7A87)", boxShadow: "0 3px 12px rgba(74,155,168,0.35)" }}
                    >
                      <Download size={13} />
                      ייצוא CSV
                    </button>
                  </div>
                </Motion.div>

                {/* KPIs */}
                <Motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ root: mainRef, once: true }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard index={0} icon={Users} label="סה״כ תורים" value={data.total ?? 0} helper="בטווח שנבחר" />
                  <StatCard index={1} icon={Calendar} label="תורים היום" value={data.today ?? 0} helper="פעילות יומית" />
                  <StatCard index={2} icon={TrendingUp} label="תורים השבוע" value={data.this_week ?? 0} helper="מומנטום שבועי" />
                  <StatCard index={3} icon={Sparkles} label="סוגי טיפולים" value={analytics.byTreatment.length} helper="טיפולים עם ביקוש" />
                </Motion.div>

                {/* Treatment demand + donut */}
                <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <SectionCard icon={Sparkles} title="טיפולים מבוקשים" subtitle="עניין לקוחות לפי סוג טיפול">
                    {analytics.byTreatment.length === 0 ? (
                      <EmptyState icon={Sparkles} title="אין עדיין עניין בטיפולים" text="לאחר הזמנות ראשונות נראה כאן את הטיפולים המובילים." />
                    ) : (
                      <div className="space-y-3">
                        {analytics.byTreatment.map((treatment, index) => <WarmBar key={treatment.name} label={treatment.name} count={treatment.count} max={maxTreatment} color={CHART_COLORS[index % CHART_COLORS.length]} index={index} mainRef={mainRef} />)}
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard icon={BarChart2} title="תורים לפי קטגוריה" subtitle="חלוקה בין תחומי הטיפול">
                    <CategoryAnalyticsWidget
                      categories={analytics.byCategory}
                      total={data.total ?? 0}
                      topCategory={analytics.topCategory}
                      leastCategory={analytics.leastCategory}
                    />
                  </SectionCard>
                </Motion.div>

                {/* Day + hour heatmaps */}
                <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <SectionCard icon={Calendar} title="תורים לפי יום" subtitle="ימים עמוסים יותר ביומן">
                    {analytics.byDay.length === 0 ? (
                      <EmptyState icon={Calendar} />
                    ) : (
                      <div className="space-y-3">
                        {analytics.byDay.map((day, index) => <WarmBar key={day.day} label={day.day} count={day.count} max={maxDay} color="#C4795A" index={index} mainRef={mainRef} />)}
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard icon={Clock} title="שעות עמוסות" subtitle="חלונות זמן שכדאי לעקוב אחריהם">
                    {analytics.byHour.length === 0 ? (
                      <EmptyState icon={Clock} />
                    ) : (
                      <div className="space-y-3">
                        {analytics.byHour.map((hour, index) => <WarmBar key={hour.hour} label={hour.hour} count={hour.count} max={maxHour} color="#4A9BA8" index={index} mainRef={mainRef} />)}
                      </div>
                    )}
                  </SectionCard>
                </Motion.div>
              </>
            ) : null}

            {activeTab === "settings" ? (
              // NOTE: plain div (not the whileInView motion wrapper) on purpose — the
              // account/password/business panels load their data async and mount after
              // the one-time scroll-in animation fires, which left them stuck at opacity:0.
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <AdminSettingsPanel />
                <AiAssistantPanel />
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
