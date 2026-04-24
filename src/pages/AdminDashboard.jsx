import { useState, useEffect } from "react";
import { fetchAnalytics } from "../api/medayApi";
import { BarChart2, TrendingUp, Calendar, Clock, Sparkles, Users } from "lucide-react";

function Bar({ label, count, max, color = "bg-primary" }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 text-right text-gray-600 truncate text-xs">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className={`${color} h-5 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-gray-700 font-semibold text-xs">{count}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">טוען נתונים...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-400 text-sm">שגיאה בטעינת הנתונים</div>
      </div>
    );
  }

  const maxTreatment = Math.max(...(data.by_treatment.map((t) => t.count) || [1]), 1);
  const maxDay = Math.max(...(data.by_day.map((d) => d.count) || [1]), 1);
  const maxHour = Math.max(...(data.by_hour.map((h) => h.count) || [1]), 1);

  const topTreatment = data.by_treatment[0]?.name || "—";

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
          <BarChart2 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">דשבורד ניהולי — MeDay</h1>
          <p className="text-sm text-gray-500">ממשק מנהלת</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-light rounded-xl flex items-center justify-center text-primary-dark">
              <Users size={22} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{data.total}</p>
              <p className="text-sm text-gray-500">סה״כ תורים</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{topTreatment}</p>
              <p className="text-sm text-gray-500">הטיפול הפופולרי ביותר</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{data.by_treatment.length}</p>
              <p className="text-sm text-gray-500">סוגי טיפולים שנקבעו</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* By Treatment */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-dark" />
              טיפולים מבוקשים
            </h2>
            {data.by_treatment.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">אין נתונים עדיין</p>
            ) : (
              <div className="space-y-3">
                {data.by_treatment.map((t) => (
                  <Bar key={t.name} label={t.name} count={t.count} max={maxTreatment} color="bg-primary" />
                ))}
              </div>
            )}
          </div>

          {/* By Day */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Calendar size={16} className="text-purple-500" />
              תורים לפי יום בשבוע
            </h2>
            {data.by_day.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">אין נתונים עדיין</p>
            ) : (
              <div className="space-y-3">
                {data.by_day.map((d) => (
                  <Bar key={d.day} label={d.day} count={d.count} max={maxDay} color="bg-purple-400" />
                ))}
              </div>
            )}
          </div>

          {/* By Hour */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              שעות עמוסות
            </h2>
            {data.by_hour.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">אין נתונים עדיין</p>
            ) : (
              <div className="space-y-3">
                {data.by_hour.map((h) => (
                  <Bar key={h.hour} label={h.hour} count={h.count} max={maxHour} color="bg-blue-400" />
                ))}
              </div>
            )}
          </div>

          {/* Recent Appointments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Users size={16} className="text-green-500" />
              תורים אחרונים
            </h2>
            {data.recent.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">אין נתונים עדיין</p>
            ) : (
              <div className="space-y-3">
                {data.recent.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{a.client_name}</p>
                      <p className="text-xs text-gray-400">{a.treatment_name}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-600">{a.date}</p>
                      <p className="text-xs text-gray-400">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
