// src/context/AuthProvider.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";

const TOKEN_KEYS = { token: "auth_token", legacy: "token", user: "auth_user" };

function readStoredAuth() {
  const token =
    localStorage.getItem(TOKEN_KEYS.token) ||
    sessionStorage.getItem(TOKEN_KEYS.token) ||
    localStorage.getItem(TOKEN_KEYS.legacy) ||
    sessionStorage.getItem(TOKEN_KEYS.legacy) ||
    null;

  const userStr =
    localStorage.getItem(TOKEN_KEYS.user) ||
    sessionStorage.getItem(TOKEN_KEYS.user) ||
    null;

  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch {
    user = null;
  }

  const storage =
    localStorage.getItem(TOKEN_KEYS.token) ||
    localStorage.getItem(TOKEN_KEYS.legacy)
      ? localStorage
      : sessionStorage;

  return { token, user, storage };
}

function writeStoredAuth(token, user, remember) {
  const storage = remember ? localStorage : sessionStorage;
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEYS.token);
    s.removeItem(TOKEN_KEYS.legacy);
    s.removeItem(TOKEN_KEYS.user);
  });
  storage.setItem(TOKEN_KEYS.token, token);
  storage.setItem(TOKEN_KEYS.legacy, token);
  storage.setItem(TOKEN_KEYS.user, JSON.stringify(user || {}));
}

function clearStoredAuth() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEYS.token);
    s.removeItem(TOKEN_KEYS.legacy);
    s.removeItem(TOKEN_KEYS.user);
  });
}

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Lấy token từ storage khi khởi động
  useEffect(() => {
    const { token: t, user: u } = readStoredAuth();
    if (t) {
      setToken(t);
      setUser(u);
    }
    setLoading(false);
  }, []);

  const isAuthenticated = !!token;

  // ✅ Hàm login được gọi từ LoginPage
  const login = useCallback(
    (newToken, roleOrUser, avatar = null, remember = true) => {
      const roleName =
        typeof roleOrUser === "string"
          ? roleOrUser
          : roleOrUser?.roleName || roleOrUser?.role?.slug || "customer";

      const newUser = { ...(user || {}), roleName, avatar };

      setToken(newToken);
      setUser(newUser);
      writeStoredAuth(newToken, newUser, remember);
    },
    [user]
  );

  // ✅ Logout
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearStoredAuth();
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated,
      login,
      logout,
    }),
    [token, user, loading, isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
