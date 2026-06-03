const JOB_APPLICATIONS_STORAGE_KEY = "meday.jobApplications";
const JOB_APPLICATION_EVENT = "meday:job-applications-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readApplications() {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(JOB_APPLICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeApplication);
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

function createApplicationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeApplication(app) {
  const feedbackNotes = Array.isArray(app.feedbackNotes) ? app.feedbackNotes : [];
  const normalizedNotes = feedbackNotes.map((note) => ({
    id: note.id || createApplicationId(),
    text: String(note.text || "").trim(),
    createdAt: note.createdAt || app.createdAt || new Date().toISOString(),
  })).filter((note) => note.text);

  return {
    ...app,
    status: app.status || "חדש",
    feedbackNotes: normalizedNotes,
  };
}

/**
 * Save a new job application
 * @param {Object} data - Application data
 * @param {string} data.fullName - Applicant full name
 * @param {string} data.email - Applicant email
 * @param {string} data.phone - Applicant phone
 * @param {string} data.portfolioLink - Portfolio or social media link
 * @param {string} data.field - Selected field/position
 * @returns {Object} The saved application
 */
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

/**
 * Get all job applications
 * @returns {Array} Array of job applications
 */
export function getJobApplications() {
  return readApplications();
}

/**
 * Update job application status
 * @param {string} id - Application ID
 * @param {string} status - New status ("חדש" or "טופל")
 * @returns {Object|null} Updated application or null if not found
 */
export function updateJobApplicationStatus(id, status) {
  const applications = readApplications();
  const updated = applications.map((app) =>
    app.id === id ? { ...app, status } : app
  );
  writeApplications(updated);
  return updated.find((app) => app.id === id) ?? null;
}

/**
 * Add feedback note to a job application
 * @param {string} id - Application ID
 * @param {string} noteText - Feedback note text
 * @returns {Object|null} Updated application or null if not found
 */
export function addJobApplicationFeedback(id, noteText) {
  const text = String(noteText || "").trim();
  if (!text) return null;

  const feedbackNote = {
    id: createApplicationId(),
    text,
    createdAt: new Date().toISOString(),
  };
  const applications = readApplications();
  const updated = applications.map((app) =>
    app.id === id
      ? { ...app, feedbackNotes: [feedbackNote, ...(app.feedbackNotes || [])] }
      : app
  );
  writeApplications(updated);
  return updated.find((app) => app.id === id) ?? null;
}

export { JOB_APPLICATION_EVENT, JOB_APPLICATIONS_STORAGE_KEY };
