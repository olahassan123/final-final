import { useEffect, useRef, useState } from "react";
import { Lock, LogIn, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ClientRegisterForm from "./ClientRegisterForm";
import { useAuth } from "../context/useAuth";

function destinationForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "employee") return "/secretary";
  return "/client";
}

export default function LoginModal({ onClose }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const bodyRef = useRef(null);
  const { login, registerClient } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
    });
  }, [mode]);

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

  const handleLogin = (event) => {
    event.preventDefault();
    completeAuth(login({ username, password }));
  };

  const handleRegister = (profile) => {
    completeAuth(registerClient(profile));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-secondary shadow-2xl ${
          mode === "login" ? "max-w-md" : "max-w-2xl"
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
            {mode === "login" ? <LogIn size={24} /> : <UserPlus size={24} />}
          </div>
          <h2 className="font-serif text-3xl font-bold">
            {mode === "login" ? "כניסה ל-MeDay" : "הרשמת לקוחה"}
          </h2>
          <p className="mt-2 text-sm text-white/85">
            {mode === "login"
              ? "כניסה זמנית לאדמין, עובד או לקוח רשום."
              : "יצירת פרופיל לקוח עם פרטים אישיים והעדפות טיפול."}
          </p>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {mode === "login" ? (
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
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="rounded-2xl bg-white/70 p-3 text-xs leading-6 text-gray-500">
                זמני לבדיקה: admin / admin123, employee / emp123
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-6 py-3 font-bold text-white shadow-md transition hover:bg-primary-dark hover:shadow-glow-terracotta"
              >
                כניסה
              </button>
            </form>
          ) : (
            <ClientRegisterForm error={error} onSubmit={handleRegister} />
          )}

          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode((current) => (current === "login" ? "register" : "login"));
                requestAnimationFrame(() => {
                  if (bodyRef.current) {
                    bodyRef.current.scrollTop = 0;
                  }
                });
              }}
              className="w-full rounded-full border border-primary/20 px-6 py-3 font-semibold text-primary-dark transition hover:bg-primary/5"
            >
              {mode === "login" ? "לקוחה חדשה? הרשמה" : "כבר יש משתמש? כניסה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
