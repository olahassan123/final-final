import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { listAuditLog } from "../api/medayApi";

export default function AdminAuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listAuditLog(200));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F1EA] px-4 py-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[#E8D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#8B5E3C]/10 px-3 py-1 text-xs font-black text-[#8B5E3C]">
              <History size={14} />
              Admin only
            </div>
            <h1 className="text-2xl font-black text-gray-900">Audit Log</h1>
            <p className="mt-1 text-sm text-gray-500">Security and account-management activity.</p>
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

        <section className="overflow-hidden rounded-2xl border border-[#E8D7C8] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="bg-[#FAF6F1] text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4D8]">
                {loading ? (
                  <tr><td colSpan="5" className="px-4 py-8 text-center font-bold text-gray-500">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan="5" className="px-4 py-8 text-center font-bold text-gray-500">No audit entries yet.</td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF6F1]">
                      <td className="px-4 py-3 text-xs text-gray-500">{item.created_at}</td>
                      <td className="px-4 py-3 font-black text-gray-900">{item.action}</td>
                      <td className="px-4 py-3 text-gray-600">{item.actor_username || "-"} · {item.actor_role || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{item.target_type || "-"} · {item.target_username || item.target_id || "-"}</td>
                      <td className="px-4 py-3 text-gray-500">{item.details || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
