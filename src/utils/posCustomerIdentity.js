export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
export const normalizePhone = (value) => String(value || "").replace(/[\s.\-()]/g, "").trim();

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
