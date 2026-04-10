const API_BASE = "http://127.0.0.1:8000";

/**
 * Fetches the full list of treatments from the database.
 */
export async function fetchTreatments() {
  const res = await fetch(`${API_BASE}/treatments`);
  if (!res.ok) throw new Error("Failed to fetch treatments");
  return res.json();
}

/**
 * Fetches detailed information for a specific treatment.
 */
export async function fetchTreatmentById(id) {
  const res = await fetch(`${API_BASE}/treatments/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to fetch treatment");
  return res.json();
}

/**
 * Sends the user message and current session context to the AI assistant.
 * Updated to include the selectedTreatment context.
 */
export async function fetchAppointments() {
  const res = await fetch(`${API_BASE}/appointments`);
  if (!res.ok) throw new Error("Failed to fetch appointments");
  return res.json();
}

export async function createAppointment(data) {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create appointment");
  return res.json();
}

export async function deleteAppointment(id) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete appointment");
  return res.json();
}

export async function updateAppointment(id, data) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update appointment");
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/appointments/analytics`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function sendChat(message, context = null, selectedTreatment = null, history = []) {
  const selected_treatment_id = selectedTreatment?.id || null;

  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context,
      selected_treatment_id,
      history,
    }),
  });

  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}