import { createElement, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Edit3,
  MessageCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import ClientProfile from "../components/ClientProfile";
import { useAuth } from "../context/useAuth";

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

export default function ClientArea() {
  const { user, getClientProfile, updateClientProfile } = useAuth();
  const [profile, setProfile] = useState(() => getClientProfile(user?.username));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const displayName = profile?.fullName || user?.fullName || user?.username || "";

  const saveProfile = (updates) => {
    setMessage("");
    setError("");
    const result = updateClientProfile(user.username, updates);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setProfile(result.client);
    setMessage("הפרופיל עודכן בהצלחה");
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
                  אזור אישי לניהול פרטי הלקוחה, העדפות הטיפול ותכנון המשך הדרך בקליניקה.
                </p>
              </div>

              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/18 text-white shadow-lg sm:h-20 sm:w-20">
                <UserRound size={34} />
              </div>
            </div>
          </div>

          {profile ? (
            <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:flex-wrap sm:px-8 lg:px-10">
              <ClientActionButton
                icon={CalendarDays}
                variant="primary"
                onClick={scrollToAppointments}
              >
                תיאום תור
              </ClientActionButton>
              <ClientActionButton icon={MessageCircle} onClick={openAiConsultation}>
                ייעוץ AI
              </ClientActionButton>
              <ClientActionButton
                icon={Edit3}
                onClick={() => setIsEditOpen(true)}
              >
                עריכת פרופיל
              </ClientActionButton>
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

        {profile ? (
          <ClientProfile
            profile={profile}
            onSave={saveProfile}
            isEditOpen={isEditOpen}
            onEditClose={() => setIsEditOpen(false)}
          />
        ) : (
          <div className="rounded-[2rem] border border-white/75 bg-white/85 p-8 text-center shadow-2xl shadow-[#9B5C38]/10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
              <UserRound size={28} />
            </div>
            <p className="text-sm font-bold text-primary-dark">אזור לקוחה</p>
            <h2 className="mt-2 font-serif text-4xl font-black text-[#3d2e1a]">
              לא נמצא פרופיל לקוחה
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-600">
              כדאי להירשם מחדש דרך כפתור הכניסה כדי ליצור פרופיל מלא עם פרטי קשר והעדפות טיפול.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
