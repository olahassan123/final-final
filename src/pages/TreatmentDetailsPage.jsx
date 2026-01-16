import { useEffect, useState } from "react";
import { fetchTreatmentById } from "../api/medayApi";

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: "8px" }}>
      <strong>{label}:</strong> <span>{value}</span>
    </div>
  );
}

function TreatmentDetailsPage({ treatmentId, onBack }) {
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchTreatmentById(treatmentId);
        if (alive) setTreatment(data);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load treatment");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [treatmentId]);

  if (loading) {
    return (
      <div>
        <button onClick={onBack}>← Back</button>
        <p style={{ marginTop: 12 }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button onClick={onBack}>← Back</button>
        <p style={{ marginTop: 12, color: "crimson" }}>{error}</p>
      </div>
    );
  }

  if (!treatment) {
    return (
      <div>
        <p>Treatment not found.</p>
        <button onClick={onBack}>Back</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>

      <h2 style={{ marginTop: "10px" }}>{treatment.name}</h2>

      <Row label="Category" value={treatment.category} />
      <Row label="Suitable for all skins" value={treatment.suitable_for_all_skins} />
      <Row label="Ages" value={treatment.ages} />
      <Row label="When results appear" value={treatment.results_timing} />
      <Row label="Complementary products" value={treatment.complementary_products} />
      <Row label="Aftercare" value={treatment.aftercare} />
      <Row label="Consultation required" value={treatment.consultation_required} />
      <Row label="Recommended frequency" value={treatment.recommended_frequency} />
      <Row label="Pregnancy/Breastfeeding" value={treatment.pregnancy_breastfeeding} />
      <Row label="Medical limitations" value={treatment.medical_limitations} />

      <h3 style={{ marginTop: "18px" }}>FAQ from Excel</h3>

      <div style={{ display: "grid", gap: "8px" }}>
        {Object.entries(treatment.faq || {}).length === 0 ? (
          <p style={{ opacity: 0.7 }}>No FAQ filled yet in the sheet.</p>
        ) : (
          Object.entries(treatment.faq).map(([question, answer]) => (
            <div
              key={question}
              style={{
                border: "1px solid #eee",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <strong>{question}</strong>
              <div style={{ marginTop: "6px" }}>{answer}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TreatmentDetailsPage;
