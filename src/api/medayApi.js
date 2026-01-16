const API_BASE = "http://127.0.0.1:8000";

export async function fetchTreatments() {
  const res = await fetch(`${API_BASE}/treatments`);
  if (!res.ok) throw new Error("Failed to fetch treatments");
  return res.json();
}

export async function fetchTreatmentById(id) {
  const res = await fetch(`${API_BASE}/treatments/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to fetch treatment");
  return res.json();
}

export async function sendChat(message, context = null) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}
