import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthContext } from "./AuthContext";
import { subscribeAuthSession } from "@/lib/authStorage";

function normalizeLoginUser(roleOrUser, fallbackUser = null) {
  if (typeof roleOrUser === "string") {
    return {
      ...(fallbackUser || {}),
      roleName: roleOrUser,
    };
  }
  if (roleOrUser && typeof roleOrUser === "object") return roleOrUser;
  return fallbackUser;
}

/**
 * Keeps consumers of AuthContext synchronized with auth changes triggered by
 * Apollo refreshes and applies a login result to the UI immediately, even when
 * the parent provider is still waiting for a previous Apollo cache reset.
 */
export default function AuthSessionReconciler({ children }) {
  const parentAuth = useContext(AuthContext) || {};
  const parentAuthRef = useRef(parentAuth);
  const anonymousHandledRef = useRef(false);
  const [externalSession, setExternalSession] = useState(null);

  useEffect(() => {
    parentAuthRef.current = parentAuth;
  }, [parentAuth]);

  useEffect(
    () =>
      subscribeAuthSession((change) => {
        if (change?.status === "authenticated" && change.token) {
          anonymousHandledRef.current = false;
          const currentAuth = parentAuthRef.current || {};
          const nextUser = change.user || currentAuth.user || null;
          setExternalSession({
            status: "authenticated",
            token: change.token,
            user: nextUser,
          });

          // The notification is emitted while the shared refresh promise is
          // resolving. Sync the parent on the next task so clearRefreshPromise
          // cannot invalidate the refresh that just succeeded.
          window.setTimeout(() => {
            const latestAuth = parentAuthRef.current || {};
            if (latestAuth.token === change.token || !latestAuth.login) return;
            Promise.resolve(
              latestAuth.login(change.token, nextUser || latestAuth.user),
            ).catch(() => {
              // The nested provider still exposes the valid refreshed session.
            });
          }, 0);
          return;
        }

        if (change?.status === "anonymous") {
          setExternalSession({
            status: "anonymous",
            token: null,
            user: null,
            reason: change.reason || "session_expired",
          });

          if (anonymousHandledRef.current) return;
          anonymousHandledRef.current = true;
          window.setTimeout(() => {
            const latestAuth = parentAuthRef.current || {};
            if (!latestAuth.token || !latestAuth.logout) return;
            latestAuth.logout();
          }, 0);
        }
      }),
    [],
  );

  useEffect(() => {
    if (!externalSession) return;

    if (
      externalSession.status === "authenticated" &&
      parentAuth.token === externalSession.token &&
      (parentAuth.user || !externalSession.user)
    ) {
      setExternalSession(null);
      return;
    }

    if (
      externalSession.status === "anonymous" &&
      !parentAuth.token &&
      !parentAuth.user
    ) {
      setExternalSession(null);
    }
  }, [externalSession, parentAuth.token, parentAuth.user]);

  const login = useCallback((newToken, roleOrUser, avatar = null, options = {}) => {
    const currentAuth = parentAuthRef.current || {};
    const nextUser = normalizeLoginUser(roleOrUser, currentAuth.user);
    anonymousHandledRef.current = false;

    // Update Header, routes and login redirect immediately. The parent login
    // can still safely wait for an old account cache to finish clearing.
    setExternalSession({
      status: "authenticated",
      token: newToken,
      user: nextUser,
    });

    if (!currentAuth.login) return Promise.resolve(false);
    return Promise.resolve(
      currentAuth.login(newToken, roleOrUser, avatar, options),
    )
      .then(() => true)
      .catch(() => false);
  }, []);

  const logout = useCallback(() => {
    const currentAuth = parentAuthRef.current || {};
    anonymousHandledRef.current = true;
    setExternalSession({
      status: "anonymous",
      token: null,
      user: null,
      reason: "manual_logout",
    });
    return currentAuth.logout?.();
  }, []);

  const value = useMemo(() => {
    if (!externalSession) {
      return {
        ...parentAuth,
        login,
        logout,
      };
    }

    const authenticated = externalSession.status === "authenticated";
    return {
      ...parentAuth,
      token: authenticated ? externalSession.token : null,
      user: authenticated ? externalSession.user : null,
      loading: false,
      sessionState: authenticated ? "authenticated" : "anonymous",
      sessionWarning: "",
      isAuthenticated: authenticated,
      login,
      logout,
    };
  }, [externalSession, login, logout, parentAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
