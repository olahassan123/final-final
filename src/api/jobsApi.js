import { API_BASE_URL } from "./config";
import { getAuthToken } from "./authApi";

const JOB_APPLICATIONS_STORAGE_KEY = "meday.jobApplications";
const JOB_APPLICATION_EVENT = "meday:job-applications-updated";

function createApplicationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeApplication(app) {
  return {
    ...app,
    status: app.status || "חדש",
    feedbackNotes: Array.isArray(app.feedbackNotes)
      ? app.feedbackNotes
      : [],
  };
}

function dispatchUpdate(data) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(JOB_APPLICATION_EVENT, { detail: data })
    );
  }
}

function staffHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function saveJobApplication({
  fullName,
  email,
  phone,
  portfolioLink,
  field,
}) {
  const application = normalizeApplication({
    id: createApplicationId(),
    fullName: String(fullName || "").trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
    portfolioLink: String(portfolioLink || "").trim(),
    field: String(field || "").trim(),
    createdAt: new Date().toISOString(),
    status: "חדש",
    feedbackNotes: [],
  });

  const response = await fetch(`${API_BASE_URL}/job-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: application.id,
      data: application,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save job application");
  }

  const saved = normalizeApplication(await response.json());
  dispatchUpdate(saved);
  return saved;
}

export async function getJobApplications() {
  const response = await fetch(`${API_BASE_URL}/job-applications`, {
    headers: staffHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return [];
    throw new Error("Failed to load job applications");
  }

  const data = await response.json();
  return Array.isArray(data)
    ? data.map(normalizeApplication)
    : [];
}

async function saveUpdatedApplication(application) {
  const response = await fetch(
    `${API_BASE_URL}/job-applications/${encodeURIComponent(application.id)}`,
    {
      method: "PUT",
      headers: staffHeaders(),
      body: JSON.stringify({ data: application }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update job application");
  }

  const saved = normalizeApplication(await response.json());
  dispatchUpdate(saved);
  return saved;
}

export async function updateJobApplicationStatus(id, status) {
  const applications = await getJobApplications();
  const application = applications.find((item) => item.id === id);

  if (!application) return null;

  return saveUpdatedApplication({
    ...application,
    status,
  });
}

export async function addJobApplicationFeedback(id, noteText) {
  const text = String(noteText || "").trim();
  if (!text) return null;

  const applications = await getJobApplications();
  const application = applications.find((item) => item.id === id);

  if (!application) return null;

  const feedbackNote = {
    id: createApplicationId(),
    text,
    createdAt: new Date().toISOString(),
  };

  return saveUpdatedApplication({
    ...application,
    feedbackNotes: [
      feedbackNote,
      ...(application.feedbackNotes || []),
    ],
  });
}

export {
  JOB_APPLICATION_EVENT,
  JOB_APPLICATIONS_STORAGE_KEY,
};