// Admin editing of the chatbot's knowledge base.
// Everything here writes straight to the tables the bot reads, so a save shows
// up in the next chat message — there is no import step to run afterwards.
import { getAuthToken } from "./authApi";
import { API_BASE_URL } from "./config";

const BASE = `${API_BASE_URL}/admin/ai`;

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonOrThrow(res, fallback) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || fallback);
  }
  return res.json();
}

export async function getAiOverview() {
  const res = await fetch(`${BASE}/overview`, { headers: authHeaders() });
  return jsonOrThrow(res, "שגיאה בטעינת המידע");
}

export async function getSection(section) {
  const res = await fetch(`${BASE}/${section}`, { headers: authHeaders() });
  return jsonOrThrow(res, "שגיאה בטעינת המידע");
}

export async function createItem(section, data) {
  const res = await fetch(`${BASE}/${section}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res, "שמירה נכשלה");
}

export async function updateItem(section, id, data) {
  const res = await fetch(`${BASE}/${section}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res, "עדכון נכשל");
}

export async function deleteItem(section, id) {
  const res = await fetch(`${BASE}/${section}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return jsonOrThrow(res, "מחיקה נכשלה");
}

export async function getQuizOverview() {
  const res = await fetch(`${BASE}/quiz`, { headers: authHeaders() });
  return jsonOrThrow(res, "שגיאה בטעינת שאלון ההתאמה");
}

// The download is a plain <a href>, which cannot carry an Authorization header,
// so the token rides along as a query param — the same pattern the rest of the
// admin downloads already use.
export const getExportUrl = (section) => {
  const token = getAuthToken();
  const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
  return `${BASE}/${section}/export${query}`;
};

/** Uploads the file and returns the diff. Writes nothing. */
export async function previewImport(section, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/${section}/import/preview`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return jsonOrThrow(res, "קריאת הקובץ נכשלה");
}

/** Commits a previewed import. The token comes from previewImport. */
export async function applyImport(section, token) {
  const res = await fetch(`${BASE}/${section}/import/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ token }),
  });
  return jsonOrThrow(res, "הייבוא נכשל");
}
