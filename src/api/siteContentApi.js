// Admin-editable content for the public category pages.
// A save here rewrites what /categories/<slug> renders on the next load — the
// page reads the same endpoint, with the static catalog as the fallback.
import { getAuthToken } from "./authApi";
import { API_BASE_URL } from "./config";

const PUBLIC_BASE = `${API_BASE_URL}/site-content/categories`;
const ADMIN_BASE = `${API_BASE_URL}/admin/site-content/categories`;

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

/** Public read for one category. Returns null when nothing was customised —
 *  the page then keeps its built-in content, and a backend that is down looks
 *  the same as "not customised" rather than breaking the page. */
export async function fetchCategoryContent(categorySlug) {
  try {
    const res = await fetch(`${PUBLIC_BASE}/${encodeURIComponent(categorySlug)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.content || null;
  } catch {
    return null;
  }
}

export async function getContentOverview() {
  const res = await fetch(ADMIN_BASE, { headers: authHeaders() });
  return jsonOrThrow(res, "שגיאה בטעינת ניהול התוכן");
}

export async function getCategoryContent(categorySlug) {
  const res = await fetch(`${ADMIN_BASE}/${encodeURIComponent(categorySlug)}`, {
    headers: authHeaders(),
  });
  const data = await jsonOrThrow(res, "שגיאה בטעינת תוכן הקטגוריה");
  return data.content || null;
}

export async function saveCategoryContent(categorySlug, content) {
  const res = await fetch(`${ADMIN_BASE}/${encodeURIComponent(categorySlug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(content),
  });
  return jsonOrThrow(res, "שמירה נכשלה");
}

/** Drops the override so the category goes back to its built-in content. */
export async function resetCategoryContent(categorySlug) {
  const res = await fetch(`${ADMIN_BASE}/${encodeURIComponent(categorySlug)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return jsonOrThrow(res, "איפוס נכשל");
}
