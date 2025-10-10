// src/lib/authStorage.ts
export type AuthPayload = { token: string; user?: any; remember?: boolean };

const KEY = "auth_token";
const USER_KEY = "auth_user";
const REM_KEY = "auth_remember";

export function setAuth({ token, user, remember }: AuthPayload) {
  // xoá cả 2 nơi trước
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(REM_KEY);
  sessionStorage.removeItem(REM_KEY);

  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(KEY, token);
  if (user) storage.setItem(USER_KEY, JSON.stringify(user));
  storage.setItem(REM_KEY, remember ? "1" : "0");
}

export function getToken(): string | null {
  return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || null;
}

export function getAuthUser(): any | null {
  const raw =
    localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(KEY);
    s.removeItem(USER_KEY);
    s.removeItem(REM_KEY);
  });
}
