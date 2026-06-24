import { API_BASE_URL } from "./config";

export const AUTH_STORAGE_KEY = "meday_auth_user";
export const CLIENTS_STORAGE_KEY = "meday_client_users";
export const GOOGLE_JWT_KEY = "meday_google_jwt";
export const AUTH_TOKEN_KEY = GOOGLE_JWT_KEY;

export function getGoogleToken() {
  return localStorage.getItem(GOOGLE_JWT_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setGoogleToken(token) {
  setAuthToken(token);
}

export function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearGoogleToken() {
  clearAuthToken();
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function readApiError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  return data.detail || fallback;
}

function normalizeUsername(username = "") {
  return username.trim();
}

function normalizeRole(role = "") {
  if (role === "client") return "customer";
  if (role === "employee") return "secretary";
  return role || "customer";
}

function stripPasswordFields(data = {}) {
  const { password, password_hash, ...safeData } = data;
  return safeData;
}

function normalizeClient(client) {
  const safeClient = stripPasswordFields(client || {});
  return {
    id: safeClient.id || `client-${Date.now()}`,
    role: "customer",
    fullName: safeClient.fullName || safeClient.full_name || safeClient.username || "",
    username: normalizeUsername(safeClient.username),
    email: safeClient.email || "",
    age: safeClient.age || "",
    gender: safeClient.gender || "",
    phone: safeClient.phone || "",
    selectedTreatments: Array.isArray(safeClient.selectedTreatments)
      ? safeClient.selectedTreatments
      : [],
    createdAt: safeClient.createdAt || safeClient.created_at || new Date().toISOString(),
    updatedAt: safeClient.updatedAt || safeClient.updated_at || safeClient.created_at || new Date().toISOString(),
  };
}

function buildSessionUser(user) {
  const safeUser = stripPasswordFields(user || {});
  return {
    id: safeUser.id,
    username: safeUser.username,
    role: normalizeRole(safeUser.role),
    fullName: safeUser.fullName || safeUser.full_name || safeUser.username,
    email: safeUser.email || "",
    phone: safeUser.phone || "",
    type: safeUser.type || (normalizeRole(safeUser.role) === "customer" ? "customer" : "staff"),
  };
}

export function getCurrentUser() {
  const user = readJson(AUTH_STORAGE_KEY, null);
  return user ? buildSessionUser(user) : null;
}

export function setCurrentUser(user) {
  saveJson(AUTH_STORAGE_KEY, user ? buildSessionUser(user) : user);
}

export function clearCurrentUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getClientUsers() {
  return readJson(CLIENTS_STORAGE_KEY, []).map(normalizeClient);
}

export function saveClientUsers(clients) {
  saveJson(CLIENTS_STORAGE_KEY, clients.map(normalizeClient));
}

export function getClientProfile(username) {
  const normalizedUsername = normalizeUsername(username);
  return (
    getClientUsers().find((client) => client.username === normalizedUsername) ||
    null
  );
}

export async function fetchClientProfile() {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Authentication required" };
  const res = await fetch(`${API_BASE_URL}/customers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.detail || "Profile loading failed" };
  }
  return { ok: true, client: normalizeClient(data.customer) };
}

export async function fetchClientAppointments() {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Authentication required", appointments: [] };
  const res = await fetch(`${API_BASE_URL}/customers/me/appointments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.detail || "Appointments loading failed", appointments: [] };
  }
  return { ok: true, appointments: data.appointments || [] };
}

export async function loginUser({ username, password }) {
  const normalizedUsername = normalizeUsername(username);
  try {
    const res = await fetch(`${API_BASE_URL}/auth/customer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalizedUsername, password }),
    });
    if (res.ok) {
      const data = await res.json();
      setAuthToken(data.token);
      const user = buildSessionUser(data.user);
      setCurrentUser(user);
      return { ok: true, user, client: normalizeClient(data.customer || data.user) };
    }
    return { ok: false, error: "שם משתמש או סיסמה שגויים" };
  } catch {
    return { ok: false, error: "לא ניתן להתחבר כרגע. נסי שוב בעוד רגע." };
  }
}

export async function loginStaffUser({ username, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: normalizeUsername(username), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.detail || "Staff login failed" };
  }
  setAuthToken(data.token);
  const user = buildSessionUser(data.user);
  setCurrentUser(user);
  return { ok: true, user };
}

export async function updateAccountSettings(data) {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "Authentication required" };
  const res = await fetch(`${API_BASE_URL}/account/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: result.detail || "Account update failed" };
  }
  const user = buildSessionUser(result.user);
  setCurrentUser(user);
  return { ok: true, user };
}

export async function registerClientUser(profile) {
  const normalizedUsername = normalizeUsername(profile.username);
  const fullName = profile.fullName?.trim() || "";
  const phone = profile.phone?.trim() || "";
  if (!fullName || !normalizedUsername || !profile.password || !profile.age || !profile.gender || !phone) {
    return { ok: false, error: "נא למלא את כל פרטי ההרשמה" };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, username: normalizedUsername }),
    });
    if (!res.ok) {
      return { ok: false, error: await readApiError(res, "Registration failed") };
    }
    const data = await res.json();
    setAuthToken(data.token);
    const user = buildSessionUser(data.user);
    setCurrentUser(user);
    return { ok: true, user, client: normalizeClient(data.customer || data.user) };
  } catch (error) {
    return { ok: false, error: error.message || "Registration failed" };
  }
}

export async function updateClientProfile(username, updates) {
  const token = getAuthToken();
  if (token) {
    const res = await fetch(`${API_BASE_URL}/customers/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      return { ok: false, error: await readApiError(res, "Profile update failed") };
    }
    const data = await res.json();
    return { ok: true, client: normalizeClient(data.customer) };
  }

  const normalizedUsername = normalizeUsername(username);
  const clients = getClientUsers();
  const clientIndex = clients.findIndex((client) => client.username === normalizedUsername);

  if (clientIndex === -1) {
    return { ok: false, error: "פרופיל הלקוח/ה לא נמצא" };
  }

  const current = clients[clientIndex];
  const nextClient = normalizeClient({
    ...current,
    ...stripPasswordFields(updates),
    username: current.username,
    selectedTreatments: Array.isArray(updates.selectedTreatments)
      ? updates.selectedTreatments
      : current.selectedTreatments,
    updatedAt: new Date().toISOString(),
  });

  const nextClients = [...clients];
  nextClients[clientIndex] = nextClient;
  saveClientUsers(nextClients);

  return { ok: true, client: nextClient };
}

export async function startCustomerPasswordReset(identifier) {
  const res = await fetch(`${API_BASE_URL}/auth/customer/password-reset/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.detail || "לא ניתן להתחיל איפוס סיסמה" };
  }
  return { ok: true, message: data.message, devCode: data.dev_code };
}

export async function confirmCustomerPasswordReset({ identifier, code, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/customer/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, code, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.detail || "לא ניתן לעדכן את הסיסמה" };
  }
  return { ok: true, message: data.message || "הסיסמה עודכנה בהצלחה" };
}
