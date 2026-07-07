import { getAuthToken, setCurrentUser } from "./authApi";
import { API_BASE_URL } from "./config";

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readApiError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  return data.detail || fallback;
}

export async function getSettings() {
  const res = await fetch(`${API_BASE_URL}/settings`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to load settings"));
  }
  return res.json();
}

export async function updateSystemSettings(settings) {
  const res = await fetch(`${API_BASE_URL}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to update system settings"));
  }
  return res.json();
}

export async function updateSettingsAccount(data) {
  const res = await fetch(`${API_BASE_URL}/settings/account`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.detail || "Failed to update account settings");
  }
  if (result.user) {
    setCurrentUser(result.user);
  }
  return result;
}

export async function updateSettingsPassword(data) {
  const res = await fetch(`${API_BASE_URL}/settings/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.detail || "Failed to update password");
  }
  if (result.user) {
    setCurrentUser(result.user);
  }
  return result;
}
