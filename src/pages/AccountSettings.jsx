import { useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function isEmail(value) {
  return !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isPhone(value) {
  return !value || /^\+?[0-9][0-9\s-]{6,18}$/.test(value);
}

export default function AccountSettings() {
  const { user, updateAccountSettings } = useAuth();
  const [form, setForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
    old_password: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.old_password) {
      setError("Old password is required.");
      return;
    }
    if (!isEmail(form.email)) {
      setError("Invalid email format.");
      return;
    }
    if (!isPhone(form.phone)) {
      setError("Invalid phone number.");
      return;
    }
    if (form.password && form.password.length < 8) {
      setError("Weak password: password must contain at least 8 characters.");
      return;
    }
    setSaving(true);
    const payload = {
      username: form.username,
      email: form.email,
      phone: form.phone,
      old_password: form.old_password,
    };
    if (form.password) payload.password = form.password;
    const result = await updateAccountSettings(payload);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm((current) => ({ ...current, old_password: "", password: "" }));
    setMessage("Account settings updated.");
  };

  const backPath = user?.role === "admin" ? "/admin" : user?.role === "secretary" ? "/secretary" : "/client";

  return (
    <div className="min-h-screen bg-[#F7F1EA] px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E8D7C8] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#8B5E3C]/10 px-3 py-1 text-xs font-black text-[#8B5E3C]">
              <ShieldCheck size={14} />
              {user?.role || "account"}
            </div>
            <h1 className="text-2xl font-black text-gray-900">Account Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Change username, email, phone, or password.</p>
          </div>
          <Link to={backPath} className="rounded-xl border border-[#E8D7C8] px-4 py-2 text-sm font-black text-[#8B5E3C] hover:bg-[#8B5E3C]/5">
            Back
          </Link>
        </div>

        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Username" value={form.username} onChange={(e) => updateField("username", e.target.value)} required />
          <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
          <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Old password" type="password" value={form.old_password} onChange={(e) => updateField("old_password", e.target.value)} required />
          <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="New password (optional)" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} />

          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-4 py-3 font-black text-white transition hover:bg-[#6F4729] disabled:opacity-60">
            <Save size={17} />
            {saving ? "Saving..." : "Save account settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
