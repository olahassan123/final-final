import { API_BASE_URL } from "./config";
import { getAuthToken } from "./authApi";

const CONTACT_INQUIRIES_STORAGE_KEY = "meday.contactInquiries";
const CONTACT_INQUIRY_EVENT = "meday:contact-inquiries-updated";

function createInquiryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeInquiry(inquiry) {
  const feedbackNotes = Array.isArray(inquiry.feedbackNotes)
    ? inquiry.feedbackNotes
    : [];

  return {
    ...inquiry,
    status: inquiry.status || "new",
    feedbackNotes,
  };
}

function dispatchUpdate(data) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONTACT_INQUIRY_EVENT, { detail: data })
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

export async function saveContactInquiry({ fullName, phone, message }) {
  const inquiry = normalizeInquiry({
    id: createInquiryId(),
    fullName: String(fullName || "").trim(),
    phone: String(phone || "").trim(),
    message: String(message || "").trim(),
    createdAt: new Date().toISOString(),
    status: "new",
    feedbackNotes: [],
  });

  const response = await fetch(`${API_BASE_URL}/contact-inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: inquiry.id,
      data: inquiry,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save contact inquiry");
  }

  const saved = normalizeInquiry(await response.json());
  dispatchUpdate(saved);
  return saved;
}

export async function getContactInquiries() {
  const response = await fetch(`${API_BASE_URL}/contact-inquiries`, {
    headers: staffHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return [];
    throw new Error("Failed to load contact inquiries");
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeInquiry) : [];
}

async function saveUpdatedInquiry(inquiry) {
  const response = await fetch(
    `${API_BASE_URL}/contact-inquiries/${encodeURIComponent(inquiry.id)}`,
    {
      method: "PUT",
      headers: staffHeaders(),
      body: JSON.stringify({ data: inquiry }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update contact inquiry");
  }

  const saved = normalizeInquiry(await response.json());
  dispatchUpdate(saved);
  return saved;
}

export async function updateContactInquiryStatus(id, status) {
  const inquiries = await getContactInquiries();
  const inquiry = inquiries.find((item) => item.id === id);

  if (!inquiry) return null;

  return saveUpdatedInquiry({
    ...inquiry,
    status,
  });
}

export async function updateContactInquiryNote(id, note) {
  return addContactInquiryFeedback(id, note);
}

export async function addContactInquiryFeedback(id, noteText) {
  const text = String(noteText || "").trim();
  if (!text) return null;

  const inquiries = await getContactInquiries();
  const inquiry = inquiries.find((item) => item.id === id);

  if (!inquiry) return null;

  const feedbackNote = {
    id: createInquiryId(),
    text,
    createdAt: new Date().toISOString(),
  };

  return saveUpdatedInquiry({
    ...inquiry,
    feedbackNotes: [
      feedbackNote,
      ...(inquiry.feedbackNotes || []),
    ],
  });
}

export {
  CONTACT_INQUIRY_EVENT,
  CONTACT_INQUIRIES_STORAGE_KEY,
};