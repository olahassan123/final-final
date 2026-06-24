import { getGoogleToken } from "./authApi";
import { API_BASE_URL } from "./config";

function authHeaders() {
  const token = getGoogleToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetches the full list of treatments from the database.
 */
export async function fetchTreatments() {
  const res = await fetch(`${API_BASE_URL}/treatments`);
  if (!res.ok) throw new Error("Failed to fetch treatments");
  return res.json();
}

/**
 * Fetches detailed information for a specific treatment.
 */
export async function fetchTreatmentById(id) {
  const res = await fetch(`${API_BASE_URL}/treatments/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to fetch treatment");
  return res.json();
}

/**
 * Sends the user message and current session context to the AI assistant.
 * Updated to include the selectedTreatment context.
 */
export async function fetchAppointments() {
  const res = await fetch(`${API_BASE_URL}/appointments`);
  if (!res.ok) throw new Error("Failed to fetch appointments");
  return res.json();
}

export async function createAppointment(data) {
  const res = await fetch(`${API_BASE_URL}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create appointment");
  return res.json();
}

export async function deleteAppointment(id) {
  const res = await fetch(`${API_BASE_URL}/appointments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete appointment");
  return res.json();
}

export async function updateAppointment(id, data) {
  const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update appointment");
  return res.json();
}

export async function fetchAnalytics({ fromDate, toDate } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/appointments/analytics${query}`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

/**
 * Sends a chat message with full flow state to the AI assistant.
 *
 * @param {string}  message              - The text the user typed or the chip label
 * @param {object}  flowState            - { profile, mode, category, currentField }
 * @param {object}  chipData             - { chip_field, chip_value } when a chip was tapped
 * @param {string|null} selectedTreatmentId  - ID of the treatment page the user is viewing
 * @param {Array}   history              - Previous messages [{from, text}]
 */
export async function sendChat(
  message,
  flowState = {},
  chipData = {},
  selectedTreatmentId = null,
  history = []
) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      selected_treatment_id: selectedTreatmentId,
      profile: flowState.profile ?? {},
      mode: flowState.mode ?? "idle",
      category: flowState.category ?? null,
      current_field: flowState.currentField ?? null,
      chip_field: chipData.chip_field ?? null,
      chip_value: chipData.chip_value ?? null,
    }),
  });

  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

export async function analyzeSkin(base64, mimeType = "image/jpeg") {
  const res = await fetch(`${API_BASE_URL}/analyze-skin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: base64, mime_type: mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `שגיאת שרת ${res.status}`);
  }
  return res.json();
}

export async function fetchRecommendations(excludeId = null, limit = 4) {
  const params = new URLSearchParams({ limit });
  if (excludeId) params.set("exclude_id", excludeId);
  const res = await fetch(`${API_BASE_URL}/recommendations?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
}

export async function saveChatSession(messages, skinProfile = {}, category = null) {
  const res = await fetch(`${API_BASE_URL}/chat-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ messages, skin_profile: skinProfile, category }),
  });
  if (!res.ok) throw new Error("Failed to save chat session");
  return res.json();
}

export async function getChatSessions() {
  const res = await fetch(`${API_BASE_URL}/chat-sessions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch chat sessions");
  return res.json();
}

export async function getExcelInfo() {
  const res = await fetch(`${API_BASE_URL}/admin/excel/info`);
  if (!res.ok) throw new Error("Failed to fetch excel info");
  return res.json();
}

export async function getExcelPreview(fileType) {
  const res = await fetch(`${API_BASE_URL}/admin/excel/preview/${fileType}`);
  if (!res.ok) throw new Error("Failed to fetch preview");
  return res.json();
}

export async function uploadExcel(fileType, file) {
  const form = new FormData();
  form.append("file_type", fileType);
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/admin/excel/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export const getExcelDownloadUrl = (fileType) =>
  `${API_BASE_URL}/admin/excel/download/${fileType}`;

export async function getChatbotConfig() {
  const res = await fetch(`${API_BASE_URL}/admin/chatbot/config`);
  if (!res.ok) throw new Error("Failed to fetch chatbot config");
  return res.json();
}

export async function listTreatmentsDB() {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db`);
  if (!res.ok) throw new Error("Failed to fetch treatments");
  return res.json();
}

export async function createTreatmentDB(data) {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create treatment");
  return res.json();
}

export async function updateTreatmentDB(id, data) {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update treatment");
  return res.json();
}

export async function deleteTreatmentDB(id) {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete treatment");
  return res.json();
}
