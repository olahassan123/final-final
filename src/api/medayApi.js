import { getAuthToken } from "./authApi";
import { API_BASE_URL } from "./config";

function authHeaders() {
  const token = getAuthToken();
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
  const res = await fetch(`${API_BASE_URL}/appointments`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch appointments");
  return res.json();
}

export async function createAppointment(data) {
  const res = await fetch(`${API_BASE_URL}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create appointment");
  return res.json();
}

export async function deleteAppointment(id) {
  const res = await fetch(`${API_BASE_URL}/appointments/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to delete appointment");
  return res.json();
}

export async function updateAppointment(id, data) {
  const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
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
  const res = await fetch(`${API_BASE_URL}/appointments/analytics${query}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

/** Sends a message or recommendation-flow button through the unified MeDay chatbot. */
export async function sendChat(sessionId, message = null, buttonValue = null, questionId = null) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      button_value: buttonValue,
      question_id: questionId,
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
  const res = await fetch(`${API_BASE_URL}/admin/excel/info`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch excel info");
  return res.json();
}

export async function getExcelPreview(fileType) {
  const res = await fetch(`${API_BASE_URL}/admin/excel/preview/${fileType}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch preview");
  return res.json();
}

export async function uploadExcel(fileType, file) {
  const form = new FormData();
  form.append("file_type", fileType);
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/admin/excel/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export const getExcelDownloadUrl = (fileType) => {
  const token = getAuthToken();
  const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
  return `${API_BASE_URL}/admin/excel/download/${fileType}${query}`;
};

export async function getChatbotConfig() {
  const res = await fetch(`${API_BASE_URL}/admin/chatbot/config`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch chatbot config");
  return res.json();
}

export async function listTreatmentsDB() {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch treatments");
  return res.json();
}

export async function createTreatmentDB(data) {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create treatment");
  return res.json();
}

export async function updateTreatmentDB(id, data) {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update treatment");
  return res.json();
}

export async function deleteTreatmentDB(id) {
  const res = await fetch(`${API_BASE_URL}/admin/treatments-db/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete treatment");
  return res.json();
}

async function readApiError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data.detail || fallback);
}

export async function listSecretaries() {
  const res = await fetch(`${API_BASE_URL}/staff/users`, { headers: authHeaders() });
  if (res.status === 404) {
    const fallback = await fetch(`${API_BASE_URL}/admin/secretaries`, { headers: authHeaders() });
    if (!fallback.ok) return readApiError(fallback, "Failed to fetch secretaries");
    return fallback.json();
  }
  if (!res.ok) return readApiError(res, "Failed to fetch secretaries");
  const data = await res.json();
  return data.users || data;
}

export async function createSecretary(data) {
  const res = await fetch(`${API_BASE_URL}/staff/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ...data, role: "secretary" }),
  });
  if (res.status === 404) {
    const fallback = await fetch(`${API_BASE_URL}/admin/secretaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ...data, role: "secretary" }),
    });
    if (!fallback.ok) return readApiError(fallback, "Failed to create secretary");
    return fallback.json();
  }
  if (!res.ok) return readApiError(res, "Failed to create secretary");
  const result = await res.json();
  return result.user || result;
}

export async function updateSecretary(id, data) {
  const res = await fetch(`${API_BASE_URL}/staff/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ...data, role: "secretary" }),
  });
  if (res.status === 404) {
    const fallback = await fetch(`${API_BASE_URL}/admin/secretaries/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ...data, role: "secretary" }),
    });
    if (!fallback.ok) return readApiError(fallback, "Failed to update secretary");
    return fallback.json();
  }
  if (!res.ok) return readApiError(res, "Failed to update secretary");
  const result = await res.json();
  return result.user || result;
}

export async function deleteSecretary(id) {
  const res = await fetch(`${API_BASE_URL}/staff/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.status === 404) {
    const fallback = await fetch(`${API_BASE_URL}/admin/secretaries/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!fallback.ok) return readApiError(fallback, "Failed to delete secretary");
    return fallback.json();
  }
  if (!res.ok) return readApiError(res, "Failed to delete secretary");
  return res.json();
}

export async function listCustomers(search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${API_BASE_URL}/admin/customers${params}`, { headers: authHeaders() });
  if (!res.ok) return readApiError(res, "Failed to fetch customers");
  const data = await res.json();
  return data.customers || [];
}

export async function createCustomer(data) {
  const res = await fetch(`${API_BASE_URL}/admin/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) return readApiError(res, "Failed to create customer");
  const result = await res.json();
  return result.customer || result;
}

export async function updateCustomer(id, data) {
  const res = await fetch(`${API_BASE_URL}/admin/customers/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) return readApiError(res, "Failed to update customer");
  const result = await res.json();
  return result.customer || result;
}

export async function deleteCustomer(id) {
  const res = await fetch(`${API_BASE_URL}/admin/customers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) return readApiError(res, "Failed to delete customer");
  return res.json();
}

export async function listAuditLog(limit = 100) {
  const res = await fetch(`${API_BASE_URL}/admin/audit-log?limit=${encodeURIComponent(limit)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return readApiError(res, "Failed to fetch audit log");
  const data = await res.json();
  return data.items || [];
}
