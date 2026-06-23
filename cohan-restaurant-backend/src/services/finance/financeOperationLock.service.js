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
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const currentTail = previous.catch(() => {}).then(() => gate);
  activeLocks.set(normalizedKey, currentTail);

  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (activeLocks.get(normalizedKey) === currentTail) {
      activeLocks.delete(normalizedKey);
    }
  }
}

export function getActiveFinanceOperationLockCount() {
  return activeLocks.size;
}
