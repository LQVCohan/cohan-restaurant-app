export function normalizePhoneNumber(value) {
  const raw = String(value ?? "").trim();
  const compact = raw.replace(/[\s().-]/g, "");

  if (!compact) return "";

  const hasPlus = compact.startsWith("+");
  const body = hasPlus ? compact.slice(1) : compact;

  if (!/^\d+$/.test(body)) return compact;
  if (hasPlus && compact.slice(1).includes("+")) return compact;
  if (!hasPlus && compact.includes("+")) return compact;

  return hasPlus ? `+${body}` : body;
}

export function isValidPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);
  return /^\+?\d{7,15}$/.test(normalized);
}
