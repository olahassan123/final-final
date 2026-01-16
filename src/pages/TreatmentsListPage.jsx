import { useEffect, useMemo, useState } from "react";
import { fetchTreatments } from "../api/medayApi";
import cosmeticsCategories from "../data/cosmeticsCategories";

function TreatmentCard({ t, onOpen }) {
  const brief =
    t.keywords ||
    t.results_timing ||
    t.aftercare ||
    "Click to view details";

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      <h3 style={{ margin: "0 0 6px 0" }}>{t.name}</h3>
      <div style={{ fontSize: "14px", opacity: 0.85 }}>
        {brief}
      </div>

      {/* 🔽 التعديل المهم هنا */}
      <button style={{ marginTop: "10px" }} onClick={() => onOpen(t)}>
        View details
      </button>
    </div>
  );
}

function TreatmentsListPage({ onOpen }) {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchTreatments(); // from backend
        if (alive) setTreatments(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load treatments");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Group by category
  const byCategory = useMemo(() => {
    return treatments.reduce((acc, t) => {
      const cat = t.category || "ללא קטגוריה";
      acc[cat] = acc[cat] || [];
      acc[cat].push(t);
      return acc;
    }, {});
  }, [treatments]);

  if (loading) return <div style={{ padding: 16 }}>Loading treatments…</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>{error}</div>;

  return (
    <div>
      <h2>טיפולי קוסמטיקה</h2>

      <div
        style={{
          background: "#f7f7f7",
          border: "1px solid #eee",
          borderRadius: "12px",
          padding: "12px",
          margin: "12px 0 18px",
        }}
      >
        <strong>Note:</strong> The Excel/DB data is mainly a knowledge base for the chatbot.
        The website shows a brief overview, while the chatbot uses the full details to answer questions.
      </div>

      {cosmeticsCategories.map((cat) => {
        const list = byCategory[cat.key] || [];
        return (
          <section key={cat.key} style={{ marginBottom: "26px" }}>
            <h3 style={{ marginBottom: "6px" }}>
              {cat.title} <span style={{ opacity: 0.7 }}>| {cat.subtitle}</span>
            </h3>

            <div style={{ opacity: 0.85, marginBottom: "12px" }}>
              {cat.description}
            </div>

            {list.length === 0 ? (
              <div style={{ opacity: 0.6 }}>
                No treatments added yet for this category.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {list.map((t) => (
                  <TreatmentCard key={t.id} t={t} onOpen={onOpen} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default TreatmentsListPage;
