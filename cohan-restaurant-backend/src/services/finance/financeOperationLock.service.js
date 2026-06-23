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

  const previous = activeLocks.get(normalizedKey);

  const run = previous
    ? previous.catch(() => {}).then(operation)
    : (async () => operation())();
  activeLocks.set(normalizedKey, run);

  try {
    return await run;
  } finally {
    if (activeLocks.get(normalizedKey) === run) {
      activeLocks.delete(normalizedKey);
    }
  }
}

export function getActiveFinanceOperationLockCount() {
  return activeLocks.size;
}
