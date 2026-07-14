export type AuthPayload = { token: string | null; user?: any };

export type AuthSessionChange = {
  status: "authenticated" | "anonymous";
  token: string | null;
  user?: any;
  reason?: string;
};

let accessToken: string | null = null;
const authSessionListeners = new Set<(change: AuthSessionChange) => void>();

export const SESSION_ACCESS_TOKEN_KEY = "cohan_access_token";

const LEGACY_KEYS = [
  "auth_token",
  "auth_user",
  "auth_remember",
  "token",
  "auth_remember_until",
];
const MANAGER_WORKSPACE_KEYS = [
  "manager.currentPage",
  "manager.selectedBrandId",
  "manager.selectedRestaurantId",
];

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function safelyRead(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safelyWrite(
  storage: Storage | null,
  key: string,
  value: string | null,
): boolean {
  if (!storage) return false;
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function safelyRemove(storage: Storage | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore privacy-mode and storage-policy failures.
  }
}

function emitAuthSessionChange(change: AuthSessionChange) {
  authSessionListeners.forEach((listener) => {
    try {
      listener(change);
    } catch {
      // A UI listener must never break token persistence.
    }
  });
}

export function subscribeAuthSession(
  listener: (change: AuthSessionChange) => void,
) {
  authSessionListeners.add(listener);
  return () => authSessionListeners.delete(listener);
}

export function setAuth({ token }: AuthPayload) {
  accessToken = token || null;
  const sessionStorage = getSessionStorage();
  const localStorage = getLocalStorage();

  if (!accessToken) {
    safelyRemove(sessionStorage, SESSION_ACCESS_TOKEN_KEY);
    safelyRemove(localStorage, SESSION_ACCESS_TOKEN_KEY);
    return;
  }

  if (safelyWrite(sessionStorage, SESSION_ACCESS_TOKEN_KEY, accessToken)) {
    // localStorage is only a privacy-mode fallback. Do not leave a longer-lived
    // copy when normal tab-scoped sessionStorage is working.
    safelyRemove(localStorage, SESSION_ACCESS_TOKEN_KEY);
    return;
  }

  // Some embedded/mobile/private browser modes expose sessionStorage but reject
  // writes. Their private localStorage is still cleared with the private session
  // and gives the current login a reload-safe fallback.
  safelyWrite(localStorage, SESSION_ACCESS_TOKEN_KEY, accessToken);
}

export function publishAuthenticatedSession({ token, user }: AuthPayload) {
  if (!token) return;
  setAuth({ token });
  emitAuthSessionChange({
    status: "authenticated",
    token,
    user: user || null,
  });
}

export function publishAnonymousSession(reason = "session_expired") {
  clearAuth();
  emitAuthSessionChange({
    status: "anonymous",
    token: null,
    user: null,
    reason,
  });
}

export function getToken(): string | null {
  if (accessToken) return accessToken;

  const restoredToken =
    safelyRead(getSessionStorage(), SESSION_ACCESS_TOKEN_KEY) ||
    safelyRead(getLocalStorage(), SESSION_ACCESS_TOKEN_KEY);
  if (restoredToken) accessToken = restoredToken;
  return restoredToken;
}

export function clearLegacyAuthStorage() {
  const storages = [getLocalStorage(), getSessionStorage()].filter(
    Boolean,
  ) as Storage[];
  storages.forEach((storage) =>
    LEGACY_KEYS.forEach((key) => safelyRemove(storage, key)),
  );
}

export function clearManagerWorkspaceStorage() {
  const storage = getLocalStorage();
  MANAGER_WORKSPACE_KEYS.forEach((key) => safelyRemove(storage, key));
}

export function clearAuth() {
  accessToken = null;
  safelyRemove(getSessionStorage(), SESSION_ACCESS_TOKEN_KEY);
  safelyRemove(getLocalStorage(), SESSION_ACCESS_TOKEN_KEY);
  clearLegacyAuthStorage();
  clearManagerWorkspaceStorage();
}
