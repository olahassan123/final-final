import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";
import { fetchRecommendations } from "../api/medayApi";
import { useAuth } from "../context/useAuth";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white/60 border border-white/70 p-5 space-y-3">
      <div className="h-3 w-20 rounded-full bg-gray-200" />
      <div className="h-5 w-3/4 rounded-full bg-gray-200" />
      <div className="h-3 w-full rounded-full bg-gray-200" />
      <div className="h-3 w-5/6 rounded-full bg-gray-200" />
    </div>
  );
}

function TreatmentCard({ rec, accent = "#C4795A" }) {
  return (
    <Link
      to={`/treatments/${rec.id}`}
      className="group flex flex-col justify-between rounded-2xl bg-white/80 border border-white/70 p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 text-right"
    >
      <div>
        {rec.class_name && (
          <span
            className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            {rec.class_name}
          </span>
        )}
        <h4 className="font-bold text-gray-900 text-base leading-snug mb-2 group-hover:text-primary transition-colors">
          {rec.name}
        </h4>
        {rec.description && (
          <p className="text-xs text-gray-500 leading-5 line-clamp-2">{rec.description}</p>
        )}
      </div>
      <div
        className="mt-4 flex items-center justify-end gap-1 text-xs font-bold transition-colors"
        style={{ color: accent }}
      >
        לפרטים
        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function RecommendationWidget({ excludeId = null, accent = "#C4795A", limit = 4 }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    fetchRecommendations(excludeId, limit)
      .then(setRecs)
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [excludeId, limit]);

  if (!loading && recs.length === 0) return null;

  const label = user?.isGoogle ? "המלצות בשבילך" : "אולי תאהבי גם";

  return (
    <section className="mt-10" dir="rtl">
      <div className="flex items-center gap-2 mb-1 justify-end">
        <h2 className="font-serif text-2xl font-black text-gray-900">{label}</h2>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Sparkles size={16} style={{ color: accent }} />
        </div>
      </div>

      {user?.isGoogle && (
        <p className="text-xs text-gray-400 mb-5 text-right">
          מותאם אישית על פי פרופיל העור שלך מהשיחות הקודמות
        </p>
      )}
      {!user?.isGoogle && <div className="mb-5" />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: limit }).map((_, i) => <SkeletonCard key={i} />)
          : recs.map((rec) => (
              <TreatmentCard key={rec.id} rec={rec} accent={accent} />
            ))}
      </div>
    </section>
  );
}
