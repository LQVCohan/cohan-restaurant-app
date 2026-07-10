const memoryStorage = new Map();
const STORAGE_ORDER = ["local", "session"];
const STORAGE_PROBE_KEY = "__cohan_storage_probe__";
const STORAGE_KEY_ALIASES = {
  auth_token: "cohan_access_token",
  token: "cohan_access_token",
};

function resolveStorage(kind) {
  if (typeof window === "undefined") return null;

  try {
    const storage =
      kind === "local" ? window.localStorage : window.sessionStorage;
    if (!storage) return null;
    storage.setItem(STORAGE_PROBE_KEY, kind);
    storage.removeItem(STORAGE_PROBE_KEY);
    return storage;
  } catch {
    return null;
  }
}

function forEachStorage(callback) {
  STORAGE_ORDER.forEach((kind) => {
    const storage = resolveStorage(kind);
    if (!storage) return;
    callback(storage, kind);
  });
}

export function readStorageValue(key) {
  const keys = [key, STORAGE_KEY_ALIASES[key]].filter(Boolean);

  for (const storageKey of keys) {
    for (const kind of STORAGE_ORDER) {
      const storage = resolveStorage(kind);
      if (!storage) continue;

      try {
        const value = storage.getItem(storageKey);
        if (value !== null) return value;
      } catch {
        continue;
      }
    }
  }

  for (const storageKey of keys) {
    if (memoryStorage.has(storageKey)) return memoryStorage.get(storageKey);
  }
  return null;
}

export function readStorageValueFrom(kind, key) {
  const storage = resolveStorage(kind);
  if (!storage) {
    return kind === "memory" && memoryStorage.has(key)
      ? memoryStorage.get(key)
      : null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageValue(key, value, { persistent = true } = {}) {
  const preferredKinds = persistent
    ? STORAGE_ORDER
    : [...STORAGE_ORDER].reverse();

  for (const kind of preferredKinds) {
    const storage = resolveStorage(kind);
    if (!storage) continue;

    try {
      storage.setItem(key, value);
      memoryStorage.delete(key);
      return kind;
    } catch {
      continue;
    }
  }

  memoryStorage.set(key, value);
  return "memory";
}

export function removeStorageValue(key) {
  forEachStorage((storage) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore storage removal errors
    }
  });
  memoryStorage.delete(key);
}

export function clearStorageKeys(keys = []) {
  keys.forEach((key) => removeStorageValue(key));
}
