import { useEffect, useRef, useState } from "react";
import { HelpCircle, Lock, LogIn, Phone, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import ClientRegisterForm from "./ClientRegisterForm";
import { useAuth } from "../context/useAuth";

function destinationForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "secretary") return "/secretary";
  return "/client";
}

export default function LoginModal({ onClose }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);
  const { login, registerClient, googleLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
    });
  }, [mode]);

  const switchMode = (nextMode) => {
    setError("");
    setMode(nextMode);
  };

  const completeAuth = (result) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setUsername("");
    setPassword("");
    onClose();
    navigate(destinationForRole(result.user.role));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    completeAuth(await login({ username, password }));
    setLoading(false);
  };

  const handleRegister = async (profile) => {
    setError("");
    setLoading(true);
    completeAuth(await registerClient(profile));
    setLoading(false);
  };

  const handleGoogleSuccess = async (response) => {
    try {
      setLoading(true);
      const result = await googleLogin(response.credential);
      completeAuth(result);
    } catch {
      setError("שגיאה בכניסה עם גוגל. אנא נסי שוב.");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgotInfo = mode === "forgot-info";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-secondary shadow-2xl ${
          isRegister ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="sticky top-0 z-10 shrink-0 bg-gradient-meday px-6 py-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="סגירה"
          >
            <X size={20} />
          </button>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/18">
            {isLogin ? <LogIn size={24} /> : isRegister ? <UserPlus size={24} /> : <HelpCircle size={24} />}
          </div>
          <h2 className="font-serif text-3xl font-bold">
            {isLogin ? "כניסה ל-MeDay" : isRegister ? "הרשמת לקוח/ה" : "עזרה באיפוס סיסמה"}
          </h2>
          <p className="mt-2 text-sm text-white/85">
            {isLogin
              ? "כניסה ללקוחות רשומים. צוות נכנס דרך ממשק הצוות הנפרד."
              : isRegister
                ? "יצירת פרופיל לקוח/ה עם פרטים אישיים והעדפות טיפול."
                : "צוות הקליניקה יעזור לך להתחבר מחדש לאזור האישי."}
          </p>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isLogin ? (
            <div className="flex flex-col items-center gap-3 px-6 pt-6">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("שגיאה בכניסה עם גוגל")}
                text="signin_with"
                shape="pill"
                locale="he"
                width="320"
              />
              <div className="flex w-full items-center gap-3 text-xs text-gray-400">
                <div className="h-px flex-1 bg-gray-200" />
                <span>או המשך עם שם משתמש</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            </div>
          ) : null}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  שם משתמש
                </label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-accent-light bg-white px-4 py-3 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  סיסמה
                </label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/55" size={18} />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="w-full rounded-2xl border border-accent-light bg-white py-3 pl-4 pr-11 text-right outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => switchMode("forgot-info")}
                className="text-sm font-bold text-primary-dark underline-offset-4 transition hover:text-primary hover:underline"
              >
                שכחתי סיסמה?
              </button>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark hover:shadow-glow-terracotta disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "מתחברת..." : "כניסה"}
              </button>
            </form>
          ) : isRegister ? (
            <ClientRegisterForm error={error} loading={loading} onSubmit={handleRegister} />
          ) : (
            <div className="space-y-5 p-6">
              <div className="rounded-3xl border border-primary/15 bg-white/85 p-5 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                  <Phone size={24} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#3d2e1a]">
                  שכחת את הסיסמה? אין בעיה 😊
                </h3>
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  לאיפוס הסיסמה, ניתן לפנות לקליניקה בטלפון{" "}
                  <a
                    href="tel:*3691"
                    className="font-black text-primary-dark underline-offset-4 hover:text-primary hover:underline"
                    dir="ltr"
                  >
                    *3691
                  </a>
                  .
                </p>
                <p className="mt-2 text-sm leading-7 text-gray-700">
                  צוות MeDay ישמח לעזור לך להתחבר מחדש לאזור האישי.
                </p>
              </div>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark"
              >
                סגור
              </button>
            </div>
          )}

          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="w-full rounded-full border border-primary/20 px-6 py-3 font-semibold text-primary-dark transition hover:bg-primary/5"
            >
              {isLogin ? "לקוח/ה חדש/ה? הרשמה" : "כבר יש משתמש? כניסה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
