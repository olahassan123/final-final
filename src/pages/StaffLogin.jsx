import { useEffect, useState } from "react";
import { Lock, LogIn, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function destinationForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "secretary") return "/secretary";
  return "/client";
}

export default function StaffLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loginStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && ["secretary", "admin"].includes(user.role)) {
      navigate(destinationForRole(user.role), { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await loginStaff({ username, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate(destinationForRole(result.user.role), { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F1EA] px-4 py-10" dir="rtl">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-[#E8D7C8] bg-white p-6 shadow-xl shadow-[#8B5E3C]/10">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B5E3C] text-white">
              <Lock size={22} />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Staff Login</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Internal access for admins and secretaries only.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-gray-700">Username</span>
              <div className="relative">
                <UserRound className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B5E3C]/60" size={18} />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-[#E8D7C8] bg-white py-3 pl-4 pr-10 text-right outline-none transition focus:border-[#8B5E3C] focus:ring-4 focus:ring-[#8B5E3C]/10"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-gray-700">Password</span>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B5E3C]/60" size={18} />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[#E8D7C8] bg-white py-3 pl-4 pr-10 text-right outline-none transition focus:border-[#8B5E3C] focus:ring-4 focus:ring-[#8B5E3C]/10"
                  required
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-5 py-3 font-black text-white transition hover:bg-[#6F4729] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={18} />
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <Link to="/" className="mt-5 block text-center text-sm font-bold text-[#8B5E3C] hover:underline">
            Back to public website
          </Link>
        </section>
      </div>
    </div>
  );
}
