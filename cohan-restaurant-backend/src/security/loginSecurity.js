import process from "process";
const WINDOW_MS = Number(process.env.LOGIN_ATTEMPT_WINDOW_MS || 15 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const BLOCK_MS = Number(process.env.LOGIN_BLOCK_MS || 15 * 60 * 1000);

const attemptStore = new Map();

const normalize = (value) => String(value || "").trim().toLowerCase();

const keyOf = ({ identifier, ip }) => `${normalize(identifier)}::${normalize(ip)}`;

function readState(key) {
  const now = Date.now();
  const current = attemptStore.get(key);
  if (!current) return { attempts: 0, blockedUntil: 0, windowStart: now };

  if (current.blockedUntil && current.blockedUntil <= now) {
    attemptStore.delete(key);
    return { attempts: 0, blockedUntil: 0, windowStart: now };
  }

  if (now - current.windowStart > WINDOW_MS) {
    attemptStore.set(key, { attempts: 0, blockedUntil: 0, windowStart: now });
    return { attempts: 0, blockedUntil: 0, windowStart: now };
  }

  return current;
}

export function getLoginAttemptState({ identifier, ip }) {
  const key = keyOf({ identifier, ip });
  const current = readState(key);
  const now = Date.now();
  const blocked = Number(current.blockedUntil || 0) > now;
  return {
    blocked,
    retryAfterMs: blocked ? current.blockedUntil - now : 0,
    attempts: Number(current.attempts || 0),
  };
}

export function recordFailedLoginAttempt({ identifier, ip }) {
  const key = keyOf({ identifier, ip });
  const now = Date.now();
  const current = readState(key);
  const attempts = Number(current.attempts || 0) + 1;
  const blockedUntil = attempts >= MAX_ATTEMPTS ? now + BLOCK_MS : 0;
  const next = {
    attempts,
    blockedUntil,
    windowStart: current.windowStart || now,
  };
  attemptStore.set(key, next);
  return next;
}

export function resetLoginAttempts({ identifier, ip }) {
  const key = keyOf({ identifier, ip });
  attemptStore.delete(key);
}

export function logAuthAuditEvent(ctx, event, metadata = {}) {
  const requestLog = ctx?.request?.log;
  if (!requestLog?.info) return;

  requestLog.info(
    {
      event,
      category: "auth",
      ...metadata,
    },
    `auth:${event}`,
  );
}
