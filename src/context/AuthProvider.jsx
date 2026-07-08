import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { gql } from "@apollo/client";
import { useApolloClient, useQuery } from "@apollo/client/react";
import {
  readStorageValue,
} from "@/lib/browserStorage";
import { clearPersistedCart } from "@/hooks/useCart";
import { clearAuth, clearLegacyAuthStorage, getToken, setAuth } from "@/lib/authStorage";
import { getLogoutUrl } from "@/lib/apiBaseUrl";
import { refreshAccessTokenOnce } from "@/lib/authRefresh";

const TOKEN_KEYS = {
  token: "auth_token",
  legacy: "token",
  user: "auth_user",
  rememberUntil: "auth_remember_until",
  rememberedIdentifier: "remembered_login_identifier",
};

const AUTH_ERROR_CODES = new Set([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_TOKEN",
  "TOKEN_EXPIRED",
  "TOKEN_REVOKED",
  "UNAUTHORIZED",
]);

const GET_RECENT_RESTAURANTS = gql`
  query AuthRecentRestaurants($limit: Int = 12) {
    myRecentRestaurants(limit: $limit) {
      id
      name
      description
      avatar
    }
  }
`;

const GET_AUTH_BUSINESS_CONTEXT = gql`
  query AuthBusinessContext($limit: Int = 100, $cursor: ID) {
    myBrandMemberships {
      id
      brandId
      role
      restaurantIds
      status
      brand {
        id
        name
        slug
      }
    }
    scopedRestaurants(limit: $limit, cursor: $cursor) {
      edges {
        cursor
        node {
          id
          name
          avatar
          brandId
          initialSetup {
            status
            templateKey
            templateVersion
            completedAt
            completedBy
          }
          address {
            city
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

// GraphQL query: thông tin tài khoản; phạm vi doanh nghiệp lấy riêng từ BrandMembership.
const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      email
      phone
      username
      avatarUrl
      roleName
      status
      emailVerified
      phoneVerified
      verifiedAt
      emailVerifiedAt
      phoneVerifiedAt
      wallet {
        provider
        status
        balance
        currency
        updatedAt
      }
      refRestaurants {
        id
        name
      }
      employmentType
      department
      positionTitle
    }
  }
`;

function getNetworkStatusCode(error) {
  return (
    error?.networkError?.statusCode ||
    error?.networkError?.response?.status ||
    error?.networkError?.status ||
    null
  );
}

function isAuthFailure(error) {
  const gqlErrors = Array.isArray(error?.graphQLErrors) ? error.graphQLErrors : [];
  const hasAuthCode = gqlErrors.some((item) =>
    AUTH_ERROR_CODES.has(String(item?.extensions?.code || "").toUpperCase())
  );
  if (hasAuthCode) return true;

  const hasAuthMessage = gqlErrors.some((item) => {
    const msg = String(item?.message || "").toLowerCase();
    return (
      msg.includes("unauthorized") ||
      msg.includes("unauthenticated") ||
      msg.includes("invalid token") ||
      msg.includes("token expired") ||
      msg.includes("jwt")
    );
  });
  if (hasAuthMessage) return true;

  const status = getNetworkStatusCode(error);
  return status === 401 || status === 403;
}

function normalizeUserModel(rawUser, fallbackUser = null, avatar = null) {
  const roleName = String(
    rawUser?.roleName ||
      rawUser?.role?.slug ||
      fallbackUser?.roleName ||
      fallbackUser?.role?.slug ||
      "customer",
  )
    .trim()
    .toLowerCase();
  const customerRefRestaurants =
    rawUser?.refRestaurants || fallbackUser?.refRestaurants || [];

  const baseUser = {
    ...(fallbackUser || {}),
    ...(rawUser || {}),
    roleName,
    avatar:
      avatar ??
      rawUser?.avatar ??
      rawUser?.avatarUrl ??
      fallbackUser?.avatar ??
      null,
    status: rawUser?.status || fallbackUser?.status || "active",
    employmentType:
      rawUser?.employmentType ||
      fallbackUser?.employmentType ||
      "",
    department:
      rawUser?.department ||
      fallbackUser?.department ||
      "",
    positionTitle:
      rawUser?.positionTitle ||
      fallbackUser?.positionTitle ||
      "",
    refRestaurants: customerRefRestaurants,
  };

  delete baseUser.restaurantForStaff;
  delete baseUser.restaurantId;
  delete baseUser.restaurantIds;

  if (roleName !== "customer") {
    delete baseUser.refRestaurants;
    delete baseUser.refRestaurant;
  }

  return baseUser;
}

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const apolloClient = useApolloClient();

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState("anonymous");
  const [sessionWarning, setSessionWarning] = useState("");
  const [restoreNeedsMeValidation, setRestoreNeedsMeValidation] = useState(false);
  const [brandMemberships, setBrandMemberships] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [refRestaurant, setRefRestaurant] = useState([]);
  const refreshRecoveryAttemptedRef = React.useRef(false);
  const refreshTimerRef = React.useRef(null);
  const accountCacheResetRef = React.useRef(Promise.resolve());
  const applyRefreshedSession = useCallback((payload) => {
    if (!payload?.token) return false;
    setAuth({ token: payload.token });
    setToken(payload.token);
    if (payload.user) setUser((prev) => normalizeUserModel(payload.user, prev));
    setSessionState("authenticated");
    setSessionWarning("");
    return true;
  }, []);

  useEffect(() => {
    let alive = true;
    clearLegacyAuthStorage();

    const existingToken = getToken();
    if (existingToken) {
      setAuth({ token: existingToken });
      setToken(existingToken);
      setSessionState("restoring");
      setRestoreNeedsMeValidation(true);
    } else {
      setSessionState("restoring");
    }

    refreshAccessTokenOnce()
      .then((payload) => {
        if (!alive) return;
        if (applyRefreshedSession(payload)) {
          setRestoreNeedsMeValidation(false);
          setLoading(false);
          return;
        }

        if (existingToken) {
          setSessionState("restoring");
          setRestoreNeedsMeValidation(true);
          return;
        }

        setSessionState("anonymous");
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        if (existingToken) {
          setSessionState("restoring");
          setRestoreNeedsMeValidation(true);
          return;
        }
        setSessionState("anonymous");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [applyRefreshedSession]);

  const isAuthenticated = !!token;
  const roleName = String(user?.roleName || user?.role?.slug || "").toLowerCase();
  const shouldLoadBusinessContext = Boolean(user?.id) && roleName !== "customer";
  const {
    data: businessContextData,
    loading: businessContextLoading,
    error: businessContextError,
  } = useQuery(GET_AUTH_BUSINESS_CONTEXT, {
    variables: { limit: 100 },
    skip: !shouldLoadBusinessContext,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const { loading: meLoading, refetch: refetchMe } = useQuery(ME_QUERY, {
    skip: !token,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      const me = data?.me;
      setRestoreNeedsMeValidation(false);
      setLoading(false);
      if (!me) {
        if (token) {
          setSessionState("network_unstable");
          setSessionWarning("Đang chờ khôi phục thông tin người dùng từ phiên hiện tại...");
        }
        return;
      }
      setSessionState("authenticated");
      setSessionWarning("");
      setUser((prev) => normalizeUserModel(me, prev));
    },
    onError: (error) => {
      if (isAuthFailure(error)) {
        if (!token || refreshRecoveryAttemptedRef.current) {
          clearAuth();
          clearPersistedCart();
          setToken(null);
          setUser(null);
          setBrandMemberships([]);
          setRestaurants([]);
          setRefRestaurant([]);
          setSessionState("anonymous");
          setSessionWarning("");
          setRestoreNeedsMeValidation(false);
          setLoading(false);
          return;
        }

        refreshRecoveryAttemptedRef.current = true;
        refreshAccessTokenOnce()
          .then((payload) => {
            if (!applyRefreshedSession(payload)) {
              clearAuth();
              clearPersistedCart();
              setToken(null);
              setUser(null);
              setBrandMemberships([]);
              setRestaurants([]);
              setRefRestaurant([]);
              setSessionState("anonymous");
              setSessionWarning("");
              setRestoreNeedsMeValidation(false);
              setLoading(false);
              return;
            }
            refetchMe().finally(() => {
              refreshRecoveryAttemptedRef.current = false;
            });
          })
          .catch(() => {
            clearAuth();
            clearPersistedCart();
            setToken(null);
            setUser(null);
            setBrandMemberships([]);
            setRestaurants([]);
            setRefRestaurant([]);
            setSessionState("anonymous");
            setSessionWarning("");
            setRestoreNeedsMeValidation(false);
            setLoading(false);
            refreshRecoveryAttemptedRef.current = false;
          });
        return;
      }
      setRestoreNeedsMeValidation(false);
      setLoading(false);
      setSessionState("network_unstable");
      setSessionWarning("Mạng không ổn định. Đang cố khôi phục phiên đăng nhập...");
    },
  });

  useEffect(() => {
    if (!token) return undefined;
    if (sessionState !== "network_unstable") return undefined;

    const handleOnline = () => {
      setSessionState("restoring");
      refetchMe().catch(() => {
        setSessionState("network_unstable");
        setSessionWarning("Mạng chưa ổn định. Vui lòng kiểm tra kết nối và thử lại.");
      });
    };

    window.addEventListener("online", handleOnline);
    const retryTimer = window.setTimeout(handleOnline, 5000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearTimeout(retryTimer);
    };
  }, [token, sessionState, refetchMe]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handlePageShow = (event) => {
      if (!event.persisted) return;

      const restoredToken = getToken();
      if (!restoredToken) return;

      setAuth({ token: restoredToken });
      setSessionState("restoring");
      setSessionWarning("");
      setRestoreNeedsMeValidation(true);
      setToken((currentToken) => currentToken || restoredToken);

      if (typeof refetchMe === "function") {
        refetchMe().catch(() => {
          setSessionState("network_unstable");
          setSessionWarning("Mạng chưa ổn định. Vui lòng kiểm tra kết nối và thử lại.");
        });
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [refetchMe]);

  useEffect(() => {
    if (roleName === "customer") {
      setBrandMemberships([]);
      return;
    }
    if (!shouldLoadBusinessContext) return;

    if (businessContextData) {
      setBrandMemberships(businessContextData.myBrandMemberships || []);
      setRestaurants(
        (businessContextData.scopedRestaurants?.edges || []).map((edge) => edge.node),
      );
      return;
    }

    if (!businessContextLoading && businessContextError) {
      setBrandMemberships([]);
      setRestaurants([]);
    }
  }, [
    businessContextData,
    businessContextError,
    businessContextLoading,
    roleName,
    shouldLoadBusinessContext,
  ]);

  useEffect(() => {
    if (roleName !== "customer") {
      setRefRestaurant([]);
    }
  }, [roleName]);

  const { error: recentRestaurantsError } = useQuery(GET_RECENT_RESTAURANTS, {
    variables: { limit: 12 },
    skip: !user?.id || roleName !== "customer",
    onCompleted: (data) => {
      if (roleName !== "customer") return;
      const recentRestaurants = data?.myRecentRestaurants || [];
      setRefRestaurant(recentRestaurants);
      setRestaurants(recentRestaurants);
    },
  });
  useEffect(() => {
    if (recentRestaurantsError && roleName === "customer") {
      setRefRestaurant([]);
      setRestaurants([]);
    }
  }, [recentRestaurantsError, roleName]);

  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!token) return undefined;

    const scheduleMs = (() => {
      try {
        const parts = token.split(".");
        if (parts.length < 2) return 10 * 60 * 1000;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(b64));
        const expMs = Number(payload?.exp) * 1000;
        if (!expMs) return 10 * 60 * 1000;
        return Math.max(5000, expMs - Date.now() - 60000);
      } catch {
        return 10 * 60 * 1000;
      }
    })();

    refreshTimerRef.current = window.setTimeout(async () => {
      const payload = await refreshAccessTokenOnce();
      if (payload?.token) applyRefreshedSession(payload);
    }, scheduleMs);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [token, applyRefreshedSession]);

  const login = useCallback(
    async (newToken, roleOrUser, avatar = null, options = {}) => {
      await accountCacheResetRef.current;
      const rawUser =
        typeof roleOrUser === "string" ? { roleName: roleOrUser } : roleOrUser;
      const newUser = normalizeUserModel(rawUser, null, avatar);

      setAuth({ token: newToken });
      setToken(newToken);
      setUser(newUser);
      setBrandMemberships([]);
      setRestaurants([]);
      setRefRestaurant([]);
      setSessionState("authenticated");
      setSessionWarning("");
    },
    []
  );

  const logout = useCallback(() => {
    fetch(getLogoutUrl(), { method: "POST", credentials: "include" }).catch(() => {});
    setToken(null);
    setUser(null);
    setBrandMemberships([]);
    setRestaurants([]);
    setRefRestaurant([]);
    setSessionState("anonymous");
    setSessionWarning("");
    clearAuth();
    clearPersistedCart();
    accountCacheResetRef.current = apolloClient.clearStore().catch(() => {});
    navigate("/login", { replace: true });
  }, [apolloClient, navigate]);

  const activeRestaurant = roleName === "customer" ? null : restaurants[0] || null;
  const restaurantsLoading = shouldLoadBusinessContext && businessContextLoading;
  const value = useMemo(
    () => ({
      token,
      user,
      loading:
        loading ||
        (!!token && sessionState === "restoring" && (meLoading || restoreNeedsMeValidation)) ||
        (!!token && roleName !== "customer" && businessContextLoading),
      sessionState,
      sessionWarning,
      isAuthenticated,
      login,
      logout,
      brandMemberships,
      restaurants,
      activeRestaurant,
      activeRestaurantId: activeRestaurant?.id || null,
      restaurantsLoading,
      refRestaurant,
      rememberedLoginIdentifier: readStorageValue(TOKEN_KEYS.rememberedIdentifier) || "",
    }),
    [
      token,
      user,
      loading,
      meLoading,
      restoreNeedsMeValidation,
      sessionState,
      sessionWarning,
      isAuthenticated,
      login,
      logout,
      brandMemberships,
      restaurants,
      activeRestaurant,
      restaurantsLoading,
      refRestaurant,
      roleName,
      businessContextLoading,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
