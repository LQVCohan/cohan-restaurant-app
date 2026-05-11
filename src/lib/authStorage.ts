// src/lib/authStorage.ts
export type AuthPayload = { token: string; user?: any; remember?: boolean };
export type StoragePreference = "localStorage" | "sessionStorage" | "memory";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "auth_token";
const LEGACY_KEY = "token";
const USER_KEY = "auth_user";
const REM_KEY = "auth_remember";

const memoryState = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem(key) {
    return memoryState.has(key) ? memoryState.get(key) ?? null : null;
  },
  setItem(key, value) {
    memoryState.set(key, String(value));
  },
  removeItem(key) {
    memoryState.delete(key);
  },
};

function getBrowserStorage(kind: "localStorage" | "sessionStorage"): StorageLike | null {
  if (typeof window === "undefined") return null;

  try {
    const storage = window[kind];
    storage?.getItem?.("__auth_storage_probe__");
    return storage;
  } catch {
    return null;
  }
}

function getStorageByPreference(
  preference: StoragePreference,
): StorageLike | null {
  if (preference === "memory") return memoryStorage;
  return getBrowserStorage(preference);
}

function getStorageCandidates(
  preferPersistent = false,
  preferred?: StoragePreference,
) {
  if (preferred) {
    return [
      preferred,
      ...(preferred === "localStorage"
        ? (["sessionStorage", "memory"] as const)
        : preferred === "sessionStorage"
          ? (["localStorage", "memory"] as const)
          : (["localStorage", "sessionStorage"] as const)),
    ];
  }

  return preferPersistent
    ? (["localStorage", "sessionStorage", "memory"] as const)
    : (["sessionStorage", "localStorage", "memory"] as const);
}

function tryGetItem(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function trySetItem(storage: StorageLike | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
    return !!storage;
  } catch {
    return false;
  }
}

function tryRemoveItem(storage: StorageLike | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore blocked or unavailable storage
  }
}

export function readStorageValue(key: string): string | null {
  for (const preference of [
    "localStorage",
    "sessionStorage",
    "memory",
  ] as const) {
    const value = tryGetItem(getStorageByPreference(preference), key);
    if (value !== null) return value;
  }

  return null;
}

export function getStoragePreferenceForKey(
  key: string,
): StoragePreference | null {
  for (const preference of [
    "localStorage",
    "sessionStorage",
    "memory",
  ] as const) {
    if (tryGetItem(getStorageByPreference(preference), key) !== null) {
      return preference;
    }
  }

  return null;
}

export function writeStorageValue(
  key: string,
  value: string,
  options: { preferPersistent?: boolean; preferred?: StoragePreference } = {},
): StoragePreference {
  const { preferPersistent = false, preferred } = options;

  for (const preference of getStorageCandidates(preferPersistent, preferred)) {
    if (trySetItem(getStorageByPreference(preference), key, value)) {
      return preference;
    }
  }

  memoryStorage.setItem(key, value);
  return "memory";
}

export function clearStorageKeys(keys: string[]) {
  for (const preference of [
    "localStorage",
    "sessionStorage",
    "memory",
  ] as const) {
    const storage = getStorageByPreference(preference);
    keys.forEach((key) => tryRemoveItem(storage, key));
  }
}

export function setAuth({ token, user, remember }: AuthPayload) {
  clearStorageKeys([KEY, LEGACY_KEY, USER_KEY, REM_KEY]);

  const writtenTo = writeStorageValue(KEY, token, {
    preferPersistent: Boolean(remember),
    preferred: remember ? "localStorage" : "sessionStorage",
  });

  writeStorageValue(LEGACY_KEY, token, { preferred: writtenTo });

  if (user != null) {
    writeStorageValue(USER_KEY, JSON.stringify(user), { preferred: writtenTo });
  }

  writeStorageValue(REM_KEY, remember ? "1" : "0", { preferred: writtenTo });
}

export function getToken(): string | null {
  return readStorageValue(KEY) || readStorageValue(LEGACY_KEY) || null;
}

export function getAuthUser(): any | null {
  const raw = readStorageValue(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  clearStorageKeys([KEY, LEGACY_KEY, USER_KEY, REM_KEY]);
}
