import { useEffect, useState } from "react";
import { Edit3, RefreshCw, Save, Search, Trash2, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from "../api/medayApi";

const EMPTY_FORM = {
  username: "",
  fullName: "",
  email: "",
  phone: "",
  password: "",
  age: "",
  gender: "",
  active: true,
};

export default function AdminCustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await listCustomers(search));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      username: customer.username || "",
      fullName: customer.fullName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      password: "",
      age: customer.age || "",
      gender: customer.gender || "",
      active: Boolean(customer.active),
    });
    setError("");
    setMessage("");
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (editingId) {
        await updateCustomer(editingId, payload);
        setMessage("Customer updated.");
      } else {
        await createCustomer({
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          age: form.age,
          gender: form.gender,
          selectedTreatments: [],
        });
        setMessage("Customer created.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete customer ${customer.username}?`)) return;
    setError("");
    setMessage("");
    try {
      await deleteCustomer(customer.id);
      if (editingId === customer.id) resetForm();
      setMessage("Customer deleted.");
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
              <Users size={14} />
              Admin only
            </div>
            <h1 className="text-2xl font-black text-gray-900">Customer Management</h1>
            <p className="mt-1 text-sm text-gray-500">View, search, edit, reset password, and delete customers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin" className="inline-flex items-center justify-center rounded-xl border border-[#E8D7C8] px-4 py-2 text-sm font-black text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5">
              Back to Admin Dashboard
            </Link>
            <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8D7C8] px-4 py-2 text-sm font-black text-[#8B5E3C] transition hover:bg-[#8B5E3C]/5">
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
              <h2 className="text-lg font-black text-gray-900">{editingId ? "Edit customer" : "Add customer"}</h2>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Cancel edit">
                  <X size={18} />
                </button>
              ) : null}
            </div>
            <div className="space-y-3">
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Username" value={form.username} onChange={(e) => updateField("username", e.target.value)} required />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Full name" value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} required />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} required />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Age" value={form.age} onChange={(e) => updateField("age", e.target.value)} />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder="Gender" value={form.gender} onChange={(e) => updateField("gender", e.target.value)} />
              <input className="w-full rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-right outline-none focus:border-[#8B5E3C]" placeholder={editingId ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required={!editingId} />
              {editingId ? (
                <label className="flex items-center justify-between rounded-xl border border-[#E8D7C8] px-3 py-2.5 text-sm font-bold text-gray-700">
                  <span>Active account</span>
                  <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} className="h-5 w-5 accent-[#8B5E3C]" />
                </label>
              ) : null}
              <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-4 py-3 font-black text-white transition hover:bg-[#6F4729] disabled:opacity-60">
                <Save size={17} />
                {saving ? "Saving..." : editingId ? "Save changes" : "Add customer"}
              </button>
            </div>
          </form>

          <section className="overflow-hidden rounded-2xl border border-[#E8D7C8] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#E8D7C8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black text-gray-900">All customers</h2>
                <p className="mt-1 text-xs text-gray-500">{customers.length} accounts</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); load(); }} className="flex gap-2">
                <input className="rounded-xl border border-[#E8D7C8] px-3 py-2 text-right text-sm outline-none focus:border-[#8B5E3C]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
                <button className="rounded-xl bg-[#8B5E3C] px-3 py-2 text-white" aria-label="Search">
                  <Search size={16} />
                </button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead className="bg-[#FAF6F1] text-xs font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Full name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E4D8]">
                  {loading ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center font-bold text-gray-500">Loading...</td></tr>
                  ) : customers.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center font-bold text-gray-500">No customers found.</td></tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-[#FAF6F1]">
                        <td className="px-4 py-3 font-black text-gray-900">{customer.username}</td>
                        <td className="px-4 py-3 text-gray-700">{customer.fullName}</td>
                        <td className="px-4 py-3 text-gray-500">{customer.email || "-"}</td>
                        <td className="px-4 py-3 text-gray-500">{customer.phone || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${customer.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                            {customer.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => startEdit(customer)} className="rounded-lg border border-[#E8D7C8] p-2 text-[#8B5E3C] hover:bg-[#8B5E3C]/5" aria-label="Edit customer">
                              <Edit3 size={16} />
                            </button>
                            <button type="button" onClick={() => handleDelete(customer)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label="Delete customer">
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
