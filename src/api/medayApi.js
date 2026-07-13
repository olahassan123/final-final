import { getAuthToken } from "./authApi";
import { API_BASE_URL } from "./config";

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readApiError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data.detail || fallback);
}

// ── Chat ──────────────────────────────────────────────────────────────────

export async function sendChat(sessionId, message = null, buttonValue = null, questionId = null) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      message: message || null,
      button_value: buttonValue || null,
      question_id: questionId || null,
    }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

// ── Appointments ──────────────────────────────────────────────────────────

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
  const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
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

// ── Analytics ─────────────────────────────────────────────────────────────

export async function fetchAnalytics({ fromDate, toDate } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/appointments/analytics${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

// ── Excel (admin) ─────────────────────────────────────────────────────────

export async function getExcelInfo() {
  const res = await fetch(`${API_BASE_URL}/admin/excel/info`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch excel info");
  return res.json();
}

export async function getExcelPreview(fileType) {
  const res = await fetch(`${API_BASE_URL}/admin/excel/preview/${fileType}`, {
    headers: authHeaders(),
  });
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

// ── Secretaries (staff) ───────────────────────────────────────────────────

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

// ── Customers (admin) ─────────────────────────────────────────────────────

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

// ── Audit log ─────────────────────────────────────────────────────────────

export async function listAuditLog(limit = 100) {
  const res = await fetch(
    `${API_BASE_URL}/admin/audit-log?limit=${encodeURIComponent(limit)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) return readApiError(res, "Failed to fetch audit log");
  const data = await res.json();
  return data.items || [];
}
