const activeLocks = new Map();

function normalizeLockKey(key) {
  return String(key || "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export async function withFinanceOperationLock(key, operation) {
  const normalizedKey = normalizeLockKey(key);
  if (!normalizedKey) throw new Error("FINANCE_OPERATION_LOCK_KEY_REQUIRED");
  if (typeof operation !== "function") throw new Error("FINANCE_OPERATION_REQUIRED");

  const previous = activeLocks.get(normalizedKey) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  activeLocks.set(normalizedKey, previous.then(() => current, () => current));

  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (activeLocks.get(normalizedKey) === current) {
      activeLocks.delete(normalizedKey);
    } else {
      activeLocks.get(normalizedKey)?.finally?.(() => {
        if (activeLocks.get(normalizedKey) === current) activeLocks.delete(normalizedKey);
      });
    }
  }
}

export function getActiveFinanceOperationLockCount() {
  return activeLocks.size;
}
