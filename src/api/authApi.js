export const AUTH_STORAGE_KEY = "meday_auth_user";
export const CLIENTS_STORAGE_KEY = "meday_client_users";

export const STAFF_USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "employee", password: "emp123", role: "employee" },
];

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

function normalizeUsername(username = "") {
  return username.trim();
}

function normalizeClient(client) {
  return {
    id: client.id || `client-${Date.now()}`,
    role: "client",
    fullName: client.fullName || client.username || "",
    username: normalizeUsername(client.username),
    password: client.password || "",
    age: client.age || "",
    gender: client.gender || "",
    phone: client.phone || "",
    selectedTreatments: Array.isArray(client.selectedTreatments)
      ? client.selectedTreatments
      : [],
    createdAt: client.createdAt || new Date().toISOString(),
    updatedAt: client.updatedAt || client.createdAt || new Date().toISOString(),
  };
}

function buildSessionUser(user) {
  return {
    username: user.username,
    role: user.role,
    fullName: user.fullName || user.username,
  };
}

export function getCurrentUser() {
  return readJson(AUTH_STORAGE_KEY, null);
}

export function setCurrentUser(user) {
  saveJson(AUTH_STORAGE_KEY, user);
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

export function loginUser({ username, password }) {
  const normalizedUsername = normalizeUsername(username);
  const staffUser = STAFF_USERS.find(
    (item) => item.username === normalizedUsername && item.password === password
  );

  if (staffUser) {
    const user = buildSessionUser(staffUser);
    setCurrentUser(user);
    return { ok: true, user };
  }

  const clientUser = getClientUsers().find(
    (item) => item.username === normalizedUsername && item.password === password
  );

  if (clientUser) {
    const user = buildSessionUser(clientUser);
    setCurrentUser(user);
    return { ok: true, user };
  }

  return { ok: false, error: "שם משתמש או סיסמה שגויים" };
}

export function registerClientUser(profile) {
  const normalizedUsername = normalizeUsername(profile.username);
  const fullName = profile.fullName?.trim() || "";
  const password = profile.password || "";
  const phone = profile.phone?.trim() || "";
  const selectedTreatments = Array.isArray(profile.selectedTreatments)
    ? profile.selectedTreatments
    : [];

  if (!fullName || !normalizedUsername || !password || !profile.age || !profile.gender || !phone) {
    return { ok: false, error: "נא למלא את כל פרטי ההרשמה" };
  }

  if (password.length < 4) {
    return { ok: false, error: "הסיסמה צריכה להכיל לפחות 4 תווים" };
  }

  const isReservedStaffName = STAFF_USERS.some(
    (item) => item.username === normalizedUsername
  );
  const clients = getClientUsers();
  const clientExists = clients.some((item) => item.username === normalizedUsername);

  if (isReservedStaffName || clientExists) {
    return { ok: false, error: "שם המשתמש כבר קיים" };
  }

  const now = new Date().toISOString();
  const client = normalizeClient({
    id: `client-${now}-${Math.random().toString(36).slice(2, 8)}`,
    role: "client",
    fullName,
    username: normalizedUsername,
    password,
    age: profile.age,
    gender: profile.gender,
    phone,
    selectedTreatments,
    createdAt: now,
    updatedAt: now,
  });

  saveClientUsers([...clients, client]);

  const user = buildSessionUser(client);
  setCurrentUser(user);
  return { ok: true, user, client };
}

export function updateClientProfile(username, updates) {
  const normalizedUsername = normalizeUsername(username);
  const clients = getClientUsers();
  const clientIndex = clients.findIndex((client) => client.username === normalizedUsername);

  if (clientIndex === -1) {
    return { ok: false, error: "פרופיל הלקוח לא נמצא" };
  }

  const current = clients[clientIndex];
  const nextClient = normalizeClient({
    ...current,
    ...updates,
    username: current.username,
    password: updates.password || current.password,
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
