const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/i;
const DURATION_FACTORS_MS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };

export function parseDurationMs(value, fallback = null) {
  const raw = String(value ?? fallback ?? "").trim();
  const match = raw.match(DURATION_PATTERN);
  if (!match) throw new Error(`Invalid duration: ${raw || "<empty>"}`);
  const amount = Number(match[1]);
  const unit = String(match[2]).toLowerCase();
  const ttlMs = amount * DURATION_FACTORS_MS[unit];
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error(`Invalid duration: ${raw || "<empty>"}`);
  }
  return ttlMs;
}
