export type AuthPayload = { token: string | null; user?: any };

let accessToken: string | null = null;

export const SESSION_ACCESS_TOKEN_KEY = "foodhub_access_token";

const LEGACY_KEYS = ["auth_token", "auth_user", "auth_remember", "token", "auth_remember_until"];
const MANAGER_WORKSPACE_KEYS = [
  "manager.currentPage",
  "manager.selectedBrandId",
  "manager.selectedRestaurantId",
];

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage || null;
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage || null;
}

export function setAuth({ token }: AuthPayload) {
  accessToken = token || null;

  const storage = getSessionStorage();
  if (!storage) return;

  if (accessToken) {
    storage.setItem(SESSION_ACCESS_TOKEN_KEY, accessToken);
  } else {
    storage.removeItem(SESSION_ACCESS_TOKEN_KEY);
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;

  const storage = getSessionStorage();
  return storage?.getItem(SESSION_ACCESS_TOKEN_KEY) || null;
}

export function clearLegacyAuthStorage() {
  const storages = [getLocalStorage(), getSessionStorage()].filter(Boolean) as Storage[];
  storages.forEach((storage) => LEGACY_KEYS.forEach((key) => storage.removeItem(key)));
}

export function clearManagerWorkspaceStorage() {
  const storage = getLocalStorage();
  MANAGER_WORKSPACE_KEYS.forEach((key) => storage?.removeItem(key));
}

export function clearAuth() {
  accessToken = null;
  getSessionStorage()?.removeItem(SESSION_ACCESS_TOKEN_KEY);
  clearLegacyAuthStorage();
  clearManagerWorkspaceStorage();
}
