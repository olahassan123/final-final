import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createElement } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { CONTACT_INQUIRIES_STORAGE_KEY, CONTACT_INQUIRY_EVENT, addContactInquiryFeedback, getContactInquiries, updateContactInquiryStatus } from "../api/contactApi";
import { JOB_APPLICATION_EVENT, JOB_APPLICATIONS_STORAGE_KEY, getJobApplications, updateJobApplicationStatus, addJobApplicationFeedback } from "../api/jobsApi";
import { fetchAnalytics } from "../api/medayApi";
import {
  Activity,
  BarChart2,
  Bell,
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  CheckCircle2,
  Home,
  MessageCircle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const CHART_COLORS = ["#C4795A", "#E8A5B5", "#D4A882", "#9B5C38", "#C67C8B", "#B79A74"];
const MONTH_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const formatMonth = (s) => {
  const [, month] = (s || "").split("-");
  return MONTH_HE[parseInt(month, 10) - 1] ?? s;
};
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
  { key: "treatments", icon: Sparkles, label: "טיפולים" },
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
      <div className="absolute -right-36 top-0 h-96 w-96 rounded-full bg-[#E8C4A0]/35 blur-3xl" />
      <div className="absolute left-[-8rem] top-40 h-[28rem] w-[28rem] rounded-full bg-[#F2D4BE]/45 blur-3xl" />
      <div className="absolute bottom-0 right-1/3 h-80 w-80 rounded-full bg-white/55 blur-3xl" />
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
      className={`rounded-3xl border border-white/75 bg-white/75 p-5 shadow-xl shadow-[#9B5C38]/5 backdrop-blur-xl ${className}`}
      whileHover={{ y: -3, boxShadow: "0 18px 48px rgba(155,92,56,0.10)" }}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C4795A] to-[#9B5C38] text-white shadow-lg shadow-[#C4795A]/25">
          {createElement(Icon, { size: 18 })}
        </div>
        <div className="min-w-0 text-right">
          <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </Motion.section>
  );
}

function StatCard({ icon: Icon, label, value, helper, index = 0 }) {
  return (
    <Motion.article
      variants={fadeUp}
      whileHover={{ y: -6, boxShadow: "0 18px 50px rgba(196,121,90,0.15)" }}
      className="group relative overflow-hidden rounded-3xl border border-white/75 bg-white/80 p-5 shadow-xl shadow-[#9B5C38]/5 backdrop-blur-xl"
    >
      <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-[#F2D4BE]/55 blur-2xl transition-opacity group-hover:opacity-80" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="text-right">
          <p className="text-3xl font-black tabular-nums text-gray-900">
            <CountUp end={value || 0} duration={1.7} delay={0.15 + index * 0.08} separator="," />
          </p>
          <p className="mt-1 text-sm font-bold text-[#8B5030]">{label}</p>
          {helper ? <p className="mt-1 text-xs text-gray-400">{helper}</p> : null}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#C4795A]/10 text-[#C4795A]">
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
      <span className="truncate text-right text-xs font-semibold text-gray-500 group-hover:text-gray-800">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F5EDE3]">
        <Motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ root: mainRef, once: true }}
          transition={{ duration: 0.9, delay: index * 0.04 + 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
      <span className="text-left text-xs font-black tabular-nums" style={{ color }}>{count}</span>
    </Motion.div>
  );
}

function MonthBar({ label, count, max, index = 0 }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <Motion.span className="text-xs font-black text-[#8B5030]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.08 + 0.35 }}>
        {count || ""}
      </Motion.span>
      <div className="flex h-24 w-full items-end overflow-hidden rounded-t-2xl bg-[#F5EDE3]/80">
        <Motion.div
          className="w-full rounded-t-2xl bg-gradient-to-t from-[#C4795A] to-[#E8C4A0]"
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 0.85, delay: index * 0.08 + 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ minHeight: count > 0 ? 5 : 0 }}
        />
      </div>
      <span className="text-center text-xs text-gray-400">{label}</span>
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
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${isHandled ? "bg-emerald-50 text-emerald-700" : "bg-[#C4795A]/10 text-[#8B5030]"}`}>
                    {isHandled ? "טופל" : "חדש"}
                  </span>
                  {isHandled ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(inquiry.id, "new")}
                      className="rounded-full border border-[#C4795A]/25 bg-white/80 px-4 py-2 text-xs font-bold text-[#8B5030] transition hover:bg-[#F5EDE3]"
                    >
                      החזר לחדש
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStatusChange(inquiry.id, "handled")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#C4795A]/20 transition hover:shadow-[#C4795A]/30"
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
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isHandled ? "bg-emerald-50 text-emerald-700" : "bg-[#C4795A]/10 text-[#8B5030]"}`}>
                      {isHandled ? "טופל" : "חדש"}
                    </span>
                    {isHandled ? (
                      <button
                        type="button"
                        onClick={() => onStatusChange(app.id, "חדש")}
                        className="rounded-full border border-[#C4795A]/25 bg-white/80 px-4 py-2 text-xs font-bold text-[#8B5030] transition hover:bg-[#F5EDE3]"
                      >
                        החזר לחדש
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStatusChange(app.id, "טופל")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#C4795A]/20 transition hover:shadow-[#C4795A]/30"
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

function Sidebar({ collapsed, onToggle, activeTab, onTabChange }) {
  return (
    <Motion.aside
      className="hidden h-full shrink-0 flex-col overflow-hidden border-l border-white/75 bg-white/65 shadow-xl shadow-[#9B5C38]/5 backdrop-blur-xl lg:flex"
      animate={{ width: collapsed ? 72 : 236 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center gap-3 border-b border-[#E8C4A0]/35 px-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C4795A] to-[#9B5C38] text-white shadow-lg shadow-[#C4795A]/25">
          <BarChart2 size={18} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <Motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <p className="whitespace-nowrap text-sm font-black text-gray-900">MeDay Admin</p>
              <p className="whitespace-nowrap text-xs text-gray-400">ניהול קליניקה</p>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <Motion.button
              key={item.label}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition ${isActive ? "bg-[#C4795A]/12 text-[#8B5030] shadow-sm" : "text-gray-500 hover:bg-white/70 hover:text-gray-900"}`}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 + 0.1 }}
              whileTap={{ scale: 0.96 }}
            >
              <Icon size={18} className="shrink-0" />
              <AnimatePresence>
                {!collapsed && <Motion.span className="whitespace-nowrap text-sm font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{item.label}</Motion.span>}
              </AnimatePresence>
            </Motion.button>
          );
        })}
      </nav>

      <button type="button" onClick={onToggle} className="m-3 flex items-center justify-center rounded-2xl bg-[#FAF6F1] p-3 text-[#8B5030] transition hover:bg-[#F5EDE3]">
        <Motion.div animate={{ rotate: collapsed ? 180 : 0 }}>
          <ChevronRight size={16} />
        </Motion.div>
      </button>
    </Motion.aside>
  );
}

function MobileTabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-3xl border border-white/70 bg-white/60 p-2 shadow-sm backdrop-blur lg:hidden">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${isActive ? "bg-[#C4795A] text-white shadow-lg shadow-[#C4795A]/20" : "bg-white/75 text-[#8B5030] hover:bg-[#F5EDE3]"}`}
          >
            <Icon size={15} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ onRefresh, refreshing }) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/70 bg-[#FAF6F1]/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/75 bg-white/70 px-4 py-2 shadow-sm">
          <Search size={15} className="shrink-0 text-[#C4795A]" />
          <input type="text" placeholder="חיפוש..." dir="rtl" className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
        </div>
        <button type="button" onClick={onRefresh} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#8B5030] shadow-sm transition hover:bg-[#F5EDE3]">
          <Motion.span animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: "linear" }}>
            <RefreshCw size={17} />
          </Motion.span>
        </button>
        <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#8B5030] shadow-sm transition hover:bg-[#F5EDE3]">
          <Bell size={17} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#C4795A]" />
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
    byDay: data?.by_day ?? [],
    byHour: data?.by_hour ?? [],
    monthlyTrend: data?.monthly_trend ?? [],
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
        <TopBar onRefresh={() => load(true)} refreshing={refreshing} />

        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pb-10 pt-5 sm:px-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <Motion.header variants={fadeUp} initial="hidden" animate="show" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2C1A0A] via-[#5E3420] to-[#C4795A] p-6 text-white shadow-2xl shadow-[#9B5C38]/20 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(232,196,160,0.45),transparent_34%),radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.22),transparent_28%)]" />
              <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="text-right">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur">
                    <Sparkles size={14} className="text-[#E8C4A0]" />
                    MeDay Beauty Center
                  </div>
                  <h1 className="text-4xl font-black leading-tight sm:text-5xl">אזור ניהול</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
                    מבט מקצועי ועדין על התורים, הטיפולים המבוקשים ותובנות הפעילות של הקליניקה.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <button type="button" onClick={() => window.location.assign("/")} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
                    <Home size={17} />
                    חזרה לדף הראשי
                  </button>
                  <button type="button" onClick={() => window.location.assign("/secretary")} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#8B5030] shadow-lg transition hover:bg-[#FAF6F1]">
                    <CalendarDays size={17} />
                    יומן וניהול תורים
                  </button>
                  <button type="button" onClick={() => exportCsv(analytics.recent)} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
                    <Download size={17} />
                    ייצוא CSV
                  </button>
                </div>
              </div>
            </Motion.header>

            <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "dashboard" ? (
              <>
            <Motion.div variants={fadeUp} {...inView(mainRef)} className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/60 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setActiveRange(range.key)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${activeRange === range.key ? "bg-[#C4795A] text-white shadow-lg shadow-[#C4795A]/20" : "bg-white/75 text-[#8B5030] hover:bg-[#F5EDE3]"}`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <p className="px-2 text-xs text-gray-400">מתעדכן אוטומטית כל דקה</p>
            </Motion.div>

            <Motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ root: mainRef, once: true }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard index={0} icon={Users} label="סה״כ תורים" value={data.total ?? 0} helper="כלל ההזמנות בטווח" />
              <StatCard index={1} icon={Calendar} label="תורים היום" value={data.today ?? 0} helper="פעילות יומית" />
              <StatCard index={2} icon={TrendingUp} label="תורים השבוע" value={data.this_week ?? 0} helper="מומנטום שבועי" />
              <StatCard index={3} icon={Sparkles} label="סוגי טיפולים" value={analytics.byTreatment.length} helper="טיפולים עם ביקוש" />
            </Motion.div>

            <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <SectionCard icon={TrendingUp} title="מגמה חודשית" subtitle="6 חודשים אחרונים" className="lg:col-span-2">
                {analytics.monthlyTrend.length > 0 ? (
                  <div className="flex items-end gap-3 px-1">
                    {analytics.monthlyTrend.map((month, index) => <MonthBar key={month.month} label={formatMonth(month.month)} count={month.count} max={maxMonthly} index={index} />)}
                  </div>
                ) : (
                  <EmptyState icon={TrendingUp} />
                )}
              </SectionCard>
              <AiInsights data={data} mainRef={mainRef} />
            </Motion.div>

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
                {donutSegs.length === 0 ? (
                  <EmptyState icon={BarChart2} />
                ) : (
                  <div className="flex flex-col items-center gap-5 sm:flex-row">
                    <DonutChart segments={donutSegs} total={data.total ?? 0} />
                    <div className="w-full flex-1 space-y-2">
                      {donutSegs.map((segment) => (
                        <div key={segment.label} className="flex items-center gap-2 rounded-2xl bg-[#FAF6F1] px-3 py-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-600">{segment.label}</span>
                          <span className="text-xs font-black tabular-nums" style={{ color: segment.color }}>{segment.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </Motion.div>

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
                    {analytics.byHour.map((hour, index) => <WarmBar key={hour.hour} label={hour.hour} count={hour.count} max={maxHour} color="#9B5C38" index={index} mainRef={mainRef} />)}
                  </div>
                )}
              </SectionCard>
            </Motion.div>

            <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <ContactInquiriesShortcut
                inquiries={contactInquiries}
                onOpen={() => setActiveTab("inquiries")}
              />
            </Motion.div>

            <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <ActivityFeed recent={analytics.recent} mainRef={mainRef} />
              <SectionCard icon={CalendarDays} title="קיצור לניהול" subtitle="מעבר מהיר ליומן הקליניקה">
                <div className="rounded-3xl bg-[#FAF6F1] p-5 text-right">
                  <p className="text-sm leading-7 text-gray-600">
                    ניהול תורים, זמינות צוות ועדכון שעות מתבצעים במסך היומן.
                  </p>
                  <button type="button" onClick={() => window.location.assign("/secretary")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[#C4795A] to-[#9B5C38] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#C4795A]/25">
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

            {activeTab === "treatments" ? (
              <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <PlaceholderPanel
                  icon={Sparkles}
                  title="ניהול טיפולים"
                  text="כאן יופיע בהמשך אזור לניהול קטגוריות, טיפולים, תיאורים וזמינות להצגה באתר. בינתיים נתוני הביקוש מוצגים בלשונית ניתוח."
                />
              </Motion.div>
            ) : null}

            {activeTab === "analytics" ? (
              <>
                <Motion.div variants={fadeUp} {...inView(mainRef)} className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/60 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {RANGES.map((range) => (
                      <button
                        key={range.key}
                        type="button"
                        onClick={() => setActiveRange(range.key)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition ${activeRange === range.key ? "bg-[#C4795A] text-white shadow-lg shadow-[#C4795A]/20" : "bg-white/75 text-[#8B5030] hover:bg-[#F5EDE3]"}`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                  <p className="px-2 text-xs text-gray-400">מתעדכן אוטומטית כל דקה</p>
                </Motion.div>

                <Motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ root: mainRef, once: true }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard index={0} icon={Users} label="סה״כ תורים" value={data.total ?? 0} helper="כלל ההזמנות בטווח" />
                  <StatCard index={1} icon={Calendar} label="תורים היום" value={data.today ?? 0} helper="פעילות יומית" />
                  <StatCard index={2} icon={TrendingUp} label="תורים השבוע" value={data.this_week ?? 0} helper="מומנטום שבועי" />
                  <StatCard index={3} icon={Sparkles} label="סוגי טיפולים" value={analytics.byTreatment.length} helper="טיפולים עם ביקוש" />
                </Motion.div>

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
                    {donutSegs.length === 0 ? (
                      <EmptyState icon={BarChart2} />
                    ) : (
                      <div className="flex flex-col items-center gap-5 sm:flex-row">
                        <DonutChart segments={donutSegs} total={data.total ?? 0} />
                        <div className="w-full flex-1 space-y-2">
                          {donutSegs.map((segment) => (
                            <div key={segment.label} className="flex items-center gap-2 rounded-2xl bg-[#FAF6F1] px-3 py-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
                              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-600">{segment.label}</span>
                              <span className="text-xs font-black tabular-nums" style={{ color: segment.color }}>{segment.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </SectionCard>
                </Motion.div>

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
                        {analytics.byHour.map((hour, index) => <WarmBar key={hour.hour} label={hour.hour} count={hour.count} max={maxHour} color="#9B5C38" index={index} mainRef={mainRef} />)}
                      </div>
                    )}
                  </SectionCard>
                </Motion.div>
              </>
            ) : null}

            {activeTab === "settings" ? (
              <Motion.div {...inView(mainRef)} variants={stagger} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <PlaceholderPanel
                  icon={Settings}
                  title="הגדרות מערכת"
                  text="כאן יתווספו בהמשך הגדרות ניהול, הרשאות, פרטי קליניקה והעדפות תצוגה. כרגע הדשבורד משתמש בהגדרות הקיימות של האתר."
                />
              </Motion.div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
