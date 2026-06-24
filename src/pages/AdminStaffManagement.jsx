import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  createSecretary,
  deleteSecretary,
  listSecretaries,
  updateSecretary,
} from "../api/medayApi";

const EMPTY_FORM = {
  username: "",
  full_name: "",
  email: "",
  phone: "",
  password: "",
  active: true,
};

export default function AdminStaffManagement() {
  const [secretaries, setSecretaries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isEditing = useMemo(() => editingId !== null, [editingId]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setSecretaries(await listSecretaries());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (secretary) => {
    setEditingId(secretary.id);
    setForm({
      username: secretary.username || "",
      full_name: secretary.full_name || "",
      email: secretary.email || "",
      phone: secretary.phone || "",
      password: "",
      active: Boolean(secretary.active),
    });
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
        setError("invalid email format");
        return;
      }
      if (form.phone && !/^\+?[0-9][0-9\s-]{6,18}$/.test(form.phone)) {
        setError("invalid phone number");
        return;
      }
      if (!isEditing && form.password.length < 8) {
        setError("weak password: password must contain at least 8 characters");
        return;
      }
      if (isEditing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await updateSecretary(editingId, payload);
        setMessage("Secretary updated.");
      } else {
        await createSecretary(form);
        setMessage("Secretary created.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (secretary) => {
    if (!window.confirm(`Delete secretary ${secretary.username}?`)) return;
    setError("");
    setMessage("");
    try {
      await deleteSecretary(secretary.id);
      if (editingId === secretary.id) resetForm();
      setMessage("Secretary deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F1EA] px-4 py-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[#E8D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#8B5E3C]/10 px-3 py-1 text-xs font-black text-[#8B5E3C]">
              <ShieldCheck size={14} />
              Admin only
            </div>
            <h1 className="text-2xl font-black text-gray-900">Secretary Management</h1>
            <p className="mt-1 text-sm text-gray-500">Create, edit, reset passwords, deactivate, and delete secretary accounts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin" className="inline-flex items-center justify-center rounded-xl border border-[#E8D7C8] px-4 py-2 text-sm font-black text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5">
              Back to Admin Dashboard
            </Link>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8D7C8] px-4 py-2 text-sm font-black text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E8D7C8] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">{isEditing ? "Edit secretary" : "Add secretary"}</h2>
              {isEditing ? (
                <button type="button" onClick={resetForm} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Cancel edit">
                  <X size={18} />
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Username" value={form.username} onChange={(e) => updateField("username", e.target.value)} required />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Full name" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder={isEditing ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required={!isEditing} />
              <label className="flex items-center justify-between rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-sm font-bold text-gray-700">
                <span>Active account</span>
                <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} className="h-5 w-5 accent-[#8B5E3C]" />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-4 py-3 font-black text-white transition hover:bg-[#6F4729] disabled:opacity-60"
            >
              {isEditing ? <Save size={17} /> : <Plus size={17} />}
              {saving ? "Saving..." : isEditing ? "Save changes" : "Add secretary"}
            </button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-[#E8D7C8] bg-white shadow-sm">
            <div className="border-b border-[#E8D7C8] px-5 py-4">
              <h2 className="font-black text-gray-900">All secretaries</h2>
              <p className="mt-1 text-xs text-gray-500">{secretaries.length} accounts</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-right text-sm">
                <thead className="bg-[#FAF6F1] text-xs font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Full name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E4D8]">
                  {loading ? (
                    <tr><td colSpan="7" className="px-4 py-8 text-center font-bold text-gray-500">Loading...</td></tr>
                  ) : secretaries.length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-8 text-center font-bold text-gray-500">No secretaries yet.</td></tr>
                  ) : (
                    secretaries.map((secretary) => (
                      <tr key={secretary.id} className="hover:bg-[#FAF6F1]">
                        <td className="px-4 py-3 font-black text-gray-900">{secretary.username}</td>
                        <td className="px-4 py-3 text-gray-700">{secretary.full_name}</td>
                        <td className="px-4 py-3 text-gray-500">{secretary.email || "-"}</td>
                        <td className="px-4 py-3 text-gray-500">{secretary.phone || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${secretary.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                            {secretary.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{secretary.updated_at || secretary.created_at || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => startEdit(secretary)} className="rounded-lg border border-[#E8D7C8] p-2 text-[#8B5E3C] hover:bg-[#8B5E3C]/5" aria-label="Edit secretary">
                              <Edit3 size={16} />
                            </button>
                            <button type="button" onClick={() => handleDelete(secretary)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label="Delete secretary">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
