const JOB_APPLICATIONS_STORAGE_KEY = "meday.jobApplications";
const JOB_APPLICATION_EVENT = "meday:job-applications-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

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
    feedbackNotes: Array.isArray(app.feedbackNotes) ? app.feedbackNotes : [],
  };
}

function readApplications() {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(JOB_APPLICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeApplication) : [];
  } catch {
    return [];
  }
}

function writeApplications(applications) {
  if (!canUseStorage()) return;

  const normalized = applications.map(normalizeApplication);
  window.localStorage.setItem(JOB_APPLICATIONS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(JOB_APPLICATION_EVENT, { detail: normalized }));
}

export function saveJobApplication({ fullName, email, phone, portfolioLink, field }) {
  const application = {
    id: createApplicationId(),
    fullName: String(fullName || "").trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
    portfolioLink: String(portfolioLink || "").trim(),
    field: String(field || "").trim(),
    createdAt: new Date().toISOString(),
    status: "חדש",
    feedbackNotes: [],
  };

  const applications = [application, ...readApplications()];
  writeApplications(applications);

  return application;
}

export function getJobApplications() {
  return readApplications();
}

export { JOB_APPLICATION_EVENT, JOB_APPLICATIONS_STORAGE_KEY };
