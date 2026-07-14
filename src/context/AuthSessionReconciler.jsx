import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthContext } from "./AuthContext";
import { getToken, setAuth, subscribeAuthSession } from "@/lib/authStorage";

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

function buildAuthenticatedSession(token, user) {
  if (!token) return null;
  return {
    status: "authenticated",
    token,
    user: user || null,
  };
}

/**
 * Keeps consumers of AuthContext synchronized with auth changes triggered by
 * Apollo refreshes and applies a login result to the UI immediately, even when
 * the parent provider is still waiting for a previous Apollo cache reset.
 */
export default function AuthSessionReconciler({ children }) {
  const parentAuth = useContext(AuthContext) || {};
  const parentAuthRef = useRef(parentAuth);
  const explicitAnonymousRef = useRef(false);
  const lastAuthenticatedRef = useRef(null);
  const parentWasAuthenticatedRef = useRef(false);
  const recoveryScheduledRef = useRef(false);
  const [externalSession, setExternalSession] = useState(null);

  useEffect(() => {
    parentAuthRef.current = parentAuth;
  }, [parentAuth]);

  const syncParentSession = useCallback((session) => {
    if (!session?.token || recoveryScheduledRef.current) return;
    recoveryScheduledRef.current = true;

    window.setTimeout(() => {
      recoveryScheduledRef.current = false;
      const latestAuth = parentAuthRef.current || {};
      if (
        explicitAnonymousRef.current ||
        latestAuth.token === session.token ||
        (latestAuth.token && latestAuth.user) ||
        !latestAuth.login
      ) {
        return;
      }

      Promise.resolve(
        latestAuth.login(session.token, session.user || latestAuth.user),
      ).catch(() => {
        // The nested provider still exposes the valid session while the parent
        // retries its own cache and account synchronization.
      });
    }, 0);
  }, []);

  useEffect(
    () =>
      subscribeAuthSession((change) => {
        if (change?.status === "authenticated" && change.token) {
          explicitAnonymousRef.current = false;
          const currentAuth = parentAuthRef.current || {};
          const nextSession = buildAuthenticatedSession(
            change.token,
            change.user || currentAuth.user || lastAuthenticatedRef.current?.user,
          );
          lastAuthenticatedRef.current = nextSession;
          setExternalSession(nextSession);
          syncParentSession(nextSession);
          return;
        }

        if (change?.status === "anonymous") {
          explicitAnonymousRef.current = true;
          lastAuthenticatedRef.current = null;
          setExternalSession({
            status: "anonymous",
            token: null,
            user: null,
            reason: change.reason || "session_expired",
          });

          window.setTimeout(() => {
            const latestAuth = parentAuthRef.current || {};
            if (!latestAuth.logout) return;
            latestAuth.logout();
          }, 0);
        }
      }),
    [syncParentSession],
  );

  useEffect(() => {
    const parentAuthenticated = Boolean(parentAuth.token && parentAuth.user);

    if (parentAuthenticated) {
      const parentSession = buildAuthenticatedSession(
        parentAuth.token,
        parentAuth.user,
      );
      lastAuthenticatedRef.current = parentSession;
      parentWasAuthenticatedRef.current = true;
      return;
    }

    const parentDroppedAuthenticatedSession =
      parentWasAuthenticatedRef.current &&
      !parentAuth.token &&
      !parentAuth.user;
    const lastAuthenticatedToken = lastAuthenticatedRef.current?.token || null;
    const persistedToken = getToken();

    if (
      parentDroppedAuthenticatedSession &&
      !explicitAnonymousRef.current &&
      lastAuthenticatedToken &&
      persistedToken === lastAuthenticatedToken
    ) {
      const recoverableSession = lastAuthenticatedRef.current;
      setAuth({ token: recoverableSession.token });
      setExternalSession(recoverableSession);
      syncParentSession(recoverableSession);
      return;
    }

    // When Apollo or the parent provider deliberately cleared auth storage after
    // an actual UNAUTHENTICATED response, do not resurrect the last UI snapshot.
    // Temporary React state resets still recover because their token remains in
    // session storage.
    if (parentDroppedAuthenticatedSession && !persistedToken) {
      lastAuthenticatedRef.current = null;
      parentWasAuthenticatedRef.current = false;
      setExternalSession(null);
      return;
    }

    if (explicitAnonymousRef.current && !parentAuth.token && !parentAuth.user) {
      parentWasAuthenticatedRef.current = false;
    }
  }, [parentAuth.token, parentAuth.user, syncParentSession]);

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

  const login = useCallback(
    (newToken, roleOrUser, avatar = null, options = {}) => {
      const currentAuth = parentAuthRef.current || {};
      const nextUser = normalizeLoginUser(roleOrUser, currentAuth.user);
      const nextSession = buildAuthenticatedSession(newToken, nextUser);
      explicitAnonymousRef.current = false;
      parentWasAuthenticatedRef.current = true;
      lastAuthenticatedRef.current = nextSession;

      // Update Header, routes and login redirect immediately. The parent login
      // can still safely wait for an old account cache to finish clearing.
      setAuth({ token: newToken });
      setExternalSession(nextSession);

      if (!currentAuth.login) return Promise.resolve(false);
      return Promise.resolve(
        currentAuth.login(newToken, roleOrUser, avatar, options),
      )
        .then(() => true)
        .catch(() => false);
    },
    [],
  );

  const logout = useCallback(() => {
    const currentAuth = parentAuthRef.current || {};
    explicitAnonymousRef.current = true;
    parentWasAuthenticatedRef.current = false;
    lastAuthenticatedRef.current = null;
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
