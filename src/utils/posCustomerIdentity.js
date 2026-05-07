export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
export const normalizePhone = (value) => {
  let normalized = String(value || "").replace(/[\s.\-()]/g, "").trim();
  if (normalized.startsWith("+84")) normalized = `0${normalized.slice(3)}`;
  if (normalized.startsWith("84")) normalized = `0${normalized.slice(2)}`;
  return normalized;
};

export function deriveCandidateMatches(candidates = [], { email, phone }) {
  const nEmail = normalizeEmail(email);
  const nPhone = normalizePhone(phone);
  const byEmail = nEmail
    ? (candidates || []).filter((c) => normalizeEmail(c?.email) === nEmail)
    : [];
  const byPhone = nPhone
    ? (candidates || []).filter((c) => normalizePhone(c?.phone) === nPhone)
    : [];

  const sameCandidate = byEmail.find((e) => byPhone.some((p) => String(p?.id || p?._id) === String(e?.id || e?._id))) || null;

  return { byEmail, byPhone, sameCandidate };
}

export function detectIdentityConflict(emailCandidate, phoneCandidate) {
  if (!emailCandidate || !phoneCandidate) return false;
  return String(emailCandidate?.id || emailCandidate?._id) !== String(phoneCandidate?.id || phoneCandidate?._id);
}

export function deriveSelectedCustomerPayload({ selectedCandidate, conflict, form }) {
  if (conflict || !selectedCandidate) return { userId: null, customerIdentityMode: "snapshot_only" };
  return {
    userId: selectedCandidate.id || selectedCandidate._id || null,
    customerIdentityMode: "attach_existing",
    customer: {
      fullName: (form?.name || selectedCandidate?.fullName || "").trim(),
      phone: normalizePhone(form?.phone || selectedCandidate?.phone || "") || undefined,
      email: normalizeEmail(form?.email || selectedCandidate?.email || "") || undefined,
    },
  };
}
