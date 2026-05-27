export type AuthPayload = { token: string | null; user?: any };

let accessToken: string | null = null;

const LEGACY_KEYS = ["auth_token", "auth_user", "auth_remember", "token", "auth_remember_until"];

export function setAuth({ token }: AuthPayload) {
  accessToken = token || null;
}

export function getToken(): string | null {
  return accessToken;
}

export function clearLegacyAuthStorage() {
  [localStorage, sessionStorage].forEach((s) => LEGACY_KEYS.forEach((k) => s.removeItem(k)));
}

export function clearAuth() {
  accessToken = null;
  clearLegacyAuthStorage();
}
