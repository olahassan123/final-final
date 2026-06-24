import { createElement, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  History,
  MessageCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import ClientProfile from "../components/ClientProfile";
import RecommendationWidget from "../components/RecommendationWidget";
import { useAuth } from "../context/useAuth";
import { getChatSessions } from "../api/medayApi";

function ClientActionButton({ children, icon: Icon, variant = "secondary", ...props }) {
  const className =
    variant === "primary"
      ? "bg-primary text-white shadow-lg shadow-[#C4795A]/20 hover:bg-primary-dark"
      : "border border-primary/20 bg-white/80 text-primary-dark shadow-sm hover:bg-primary/5";

  return (
    <button
      type="button"
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition sm:w-auto ${className}`}
      {...props}
    >
      {createElement(Icon, { size: 18 })}
      {children}
    </button>
  );
}

function ChatHistoryPanel({ sessions, loading }) {
  const [expanded, setExpanded] = useState(null);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-white/75 bg-white/85 p-8 shadow-2xl shadow-[#9B5C38]/10">
        <div className="flex items-center gap-3">
          <History size={22} className="text-primary" />
          <h2 className="font-serif text-2xl font-black text-[#3d2e1a]">היסטוריית שיחות</h2>
        </div>
        <p className="mt-4 text-sm text-gray-500">טוענת שיחות...</p>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="rounded-[2rem] border border-white/75 bg-white/85 p-8 shadow-2xl shadow-[#9B5C38]/10">
        <div className="flex items-center gap-3">
          <History size={22} className="text-primary" />
          <h2 className="font-serif text-2xl font-black text-[#3d2e1a]">היסטוריית שיחות</h2>
        </div>
        <p className="mt-4 text-sm text-gray-500">עדיין לא נוהלה שיחת ייעוץ. אפשר לפתוח את הצ׳אט בעמוד הבית כדי להתחיל.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/85 shadow-2xl shadow-[#9B5C38]/10">
      <div className="bg-gradient-meday px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <History size={22} />
          <h2 className="font-serif text-2xl font-black">היסטוריית שיחות ייעוץ</h2>
        </div>
        <p className="mt-1 text-sm text-white/80">{sessions.length} שיחות נשמרו</p>
      </div>

      <div className="divide-y divide-gray-100">
        {sessions.map((session) => {
          const isOpen = expanded === session.id;
          const date = new Date(session.created_at).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const profileEntries = Object.entries(session.skin_profile || {});
          const botMessages = session.messages.filter((m) => m.from === "bot");
          const preview = botMessages[botMessages.length - 1]?.text?.slice(0, 100) ?? "";

          return (
            <div key={session.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : session.id)}
                className="flex w-full items-start justify-between gap-4 px-6 py-4 text-right transition hover:bg-primary/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {session.category ?? "ייעוץ כללי"}
                    </span>
                    <span className="text-xs text-gray-400">{date}</span>
                  </div>
                  <p className="truncate text-sm text-gray-600">{preview}...</p>
                  {profileEntries.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {profileEntries.map(([key, value]) => (
                        <span key={key} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isOpen ? <ChevronUp size={18} className="mt-1 shrink-0 text-gray-400" /> : <ChevronDown size={18} className="mt-1 shrink-0 text-gray-400" />}
              </button>

              {isOpen && (
                <div className="max-h-80 space-y-3 overflow-y-auto border-t border-gray-100 bg-gray-50/60 px-6 py-4">
                  {session.messages.map((msg, index) => (
                    <div key={`${session.id}-${index}`} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.from === "user"
                            ? "rounded-tl-none bg-primary text-white"
                            : "rounded-tr-none border border-pink-100 bg-white text-gray-800 shadow-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientArea() {
  const {
    user,
    getClientProfile,
    fetchClientProfile,
    fetchClientAppointments,
    updateClientProfile,
  } = useAuth();
  const [profile, setProfile] = useState(() => (user?.isGoogle ? null : getClientProfile(user?.username)));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (user?.role === "customer" && !user?.isGoogle) {
      setProfileLoading(true);
      // Customer profile loading: backend profile is the source of truth after login.
      Promise.all([fetchClientProfile(), fetchClientAppointments()])
        .then(([profileResult, appointmentsResult]) => {
          if (!active) return;
          if (profileResult.ok) {
            setProfile(profileResult.client);
          } else {
            setProfile(getClientProfile(user?.username));
          }
          setAppointments(appointmentsResult.appointments || []);
        })
        .catch(() => {
          if (active) setProfile(getClientProfile(user?.username));
        })
        .finally(() => {
          if (active) setProfileLoading(false);
        });
    }

    if (user?.isGoogle) {
      setSessionsLoading(true);
      getChatSessions()
        .then(setChatSessions)
        .catch(() => {})
        .finally(() => setSessionsLoading(false));
    }

    return () => {
      active = false;
    };
  }, [fetchClientAppointments, fetchClientProfile, getClientProfile, user]);

  const displayName = user?.fullName || profile?.fullName || user?.username || "";

  const saveProfile = async (updates) => {
    setMessage("");
    setError("");
    const result = await updateClientProfile(user.username, updates);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setProfile(result.client);
    const appointmentsResult = await fetchClientAppointments();
    setAppointments(appointmentsResult.appointments || []);
    setMessage("הפרטים עודכנו בהצלחה");
    return result;
  };

  const scrollToAppointments = () => {
    document.getElementById("client-appointments")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const openAiConsultation = () => {
    window.dispatchEvent(
      new CustomEvent("openChatWithQuestion", {
        detail: "אני רוצה ייעוץ AI לגבי טיפול שמתאים לי",
      })
    );
  };

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[#FAF6F1] px-4 pb-14 pt-24 sm:px-6 lg:pt-28"
      dir="rtl"
    >
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#F3C8B7]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-0 h-80 w-80 rounded-full bg-[#E7D1BD]/45 blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/80 shadow-2xl shadow-[#9B5C38]/10 backdrop-blur">
          <div className="relative bg-gradient-meday px-5 py-8 text-white sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_38%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-bold text-white/90">
                  <Sparkles size={16} />
                  MeDay
                </div>
                <h1 className="font-serif text-4xl font-black leading-tight sm:text-5xl">
                  שלום <bdi dir="auto">{displayName}</bdi>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
                  אזור אישי לניהול פרופיל לקוח/ה, העדפות טיפול, תורים והמשך הדרך במרכז.
                </p>
              </div>

              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/18 text-white shadow-lg sm:h-20 sm:w-20">
                <UserRound size={34} />
              </div>
            </div>
          </div>

          {(profile || user?.isGoogle) ? (
            <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:flex-wrap sm:px-8 lg:px-10">
              <ClientActionButton
                icon={CalendarDays}
                variant="primary"
                onClick={scrollToAppointments}
              >
                התורים שלי
              </ClientActionButton>
              <ClientActionButton icon={MessageCircle} onClick={openAiConsultation}>
                ייעוץ AI
              </ClientActionButton>
              {profile && (
                <ClientActionButton
                  icon={Edit3}
                  onClick={() => setIsEditOpen(true)}
                >
                  עדכון פרטים
                </ClientActionButton>
              )}
            </div>
          ) : null}
        </header>

        {message ? (
          <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            <CheckCircle2 size={18} />
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : null}

        {profileLoading ? (
          <div className="rounded-[2rem] border border-white/75 bg-white/85 p-8 text-center text-sm font-bold text-primary-dark shadow-2xl shadow-[#9B5C38]/10">
            טוענת פרופיל אישי...
          </div>
        ) : profile ? (
          <ClientProfile
            profile={profile}
            appointments={appointments}
            onSave={saveProfile}
            isEditOpen={isEditOpen}
            onEditClose={() => setIsEditOpen(false)}
            onCompleteProfile={() => setIsEditOpen(true)}
          />
        ) : !user?.isGoogle ? (
          <div className="rounded-[2rem] border border-white/75 bg-white/85 p-8 text-center shadow-2xl shadow-[#9B5C38]/10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
              <UserRound size={28} />
            </div>
            <p className="text-sm font-bold text-primary-dark">אזור אישי</p>
            <h2 className="mt-2 font-serif text-4xl font-black text-[#3d2e1a]">
              עדיין לא הושלם פרופיל אישי
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-600">
              אפשר להשלים פרטים אישיים כדי לראות העדפות טיפול ותורים במקום אחד.
            </p>
            <button
              type="button"
              onClick={() => {
                setProfile({
                  username: user?.username || "",
                  fullName: user?.fullName || "",
                  email: user?.email || "",
                  phone: user?.phone || "",
                  age: "",
                  gender: "",
                  selectedTreatments: [],
                });
                setIsEditOpen(true);
              }}
              className="mt-5 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark"
            >
              השלמת פרופיל
            </button>
          </div>
        ) : null}

        {user?.isGoogle && (
          <ChatHistoryPanel sessions={chatSessions} loading={sessionsLoading} />
        )}

        {user?.isGoogle && (
          <div className="rounded-[2rem] border border-white/75 bg-white/85 p-8 shadow-2xl shadow-[#9B5C38]/10">
            <RecommendationWidget limit={4} />
          </div>
        )}
      </div>
    </section>
  );
}
