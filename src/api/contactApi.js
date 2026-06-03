const CONTACT_INQUIRIES_STORAGE_KEY = "meday.contactInquiries";
const CONTACT_INQUIRY_EVENT = "meday:contact-inquiries-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readInquiries() {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(CONTACT_INQUIRIES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeInquiry);
  } catch {
    return [];
  }
}

function writeInquiries(inquiries) {
  if (!canUseStorage()) return;
  const normalized = inquiries.map(normalizeInquiry);
  window.localStorage.setItem(CONTACT_INQUIRIES_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CONTACT_INQUIRY_EVENT, { detail: normalized }));
}

function createInquiryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeInquiry(inquiry) {
  const feedbackNotes = Array.isArray(inquiry.feedbackNotes) ? inquiry.feedbackNotes : [];
  const legacyNote = String(inquiry.staffNote || "").trim();
  const normalizedNotes = feedbackNotes.map((note) => ({
    id: note.id || createInquiryId(),
    text: String(note.text || "").trim(),
    createdAt: note.createdAt || inquiry.createdAt || new Date().toISOString(),
  })).filter((note) => note.text);

  return {
    ...inquiry,
    status: inquiry.status || "new",
    feedbackNotes: legacyNote && normalizedNotes.length === 0
      ? [{ id: createInquiryId(), text: legacyNote, createdAt: inquiry.createdAt || new Date().toISOString() }]
      : normalizedNotes,
  };
}

export function saveContactInquiry({ fullName, phone, message }) {
  const inquiry = {
    id: createInquiryId(),
    fullName: String(fullName || "").trim(),
    phone: String(phone || "").trim(),
    message: String(message || "").trim(),
    createdAt: new Date().toISOString(),
    status: "new",
    feedbackNotes: [],
  };

  const inquiries = [inquiry, ...readInquiries()];
  writeInquiries(inquiries);
  return inquiry;
}

export function getContactInquiries() {
  return readInquiries();
}

export function updateContactInquiryStatus(id, status) {
  const inquiries = readInquiries();
  const updated = inquiries.map((inquiry) =>
    inquiry.id === id ? { ...inquiry, status } : inquiry
  );
  writeInquiries(updated);
  return updated.find((inquiry) => inquiry.id === id) ?? null;
}

export function updateContactInquiryNote(id, note) {
  const inquiries = readInquiries();
  const updated = inquiries.map((inquiry) =>
    inquiry.id === id ? { ...inquiry, feedbackNotes: note ? [{ id: createInquiryId(), text: String(note), createdAt: new Date().toISOString() }, ...(inquiry.feedbackNotes || [])] : inquiry.feedbackNotes || [] } : inquiry
  );
  writeInquiries(updated);
  return updated.find((inquiry) => inquiry.id === id) ?? null;
}

export function addContactInquiryFeedback(id, noteText) {
  const text = String(noteText || "").trim();
  if (!text) return null;

  const feedbackNote = {
    id: createInquiryId(),
    text,
    createdAt: new Date().toISOString(),
  };
  const inquiries = readInquiries();
  const updated = inquiries.map((inquiry) =>
    inquiry.id === id
      ? { ...inquiry, feedbackNotes: [feedbackNote, ...(inquiry.feedbackNotes || [])] }
      : inquiry
  );
  writeInquiries(updated);
  return updated.find((inquiry) => inquiry.id === id) ?? null;
}

export { CONTACT_INQUIRY_EVENT, CONTACT_INQUIRIES_STORAGE_KEY };
