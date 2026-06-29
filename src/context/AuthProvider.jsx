import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { isRestaurantScopedRole } from "@/utils/frontendRoleAccess";
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
const isRestaurantScopedAccessRole = (roleName) => isRestaurantScopedRole(roleName);

// GraphQL query để lấy danh sách nhà hàng của người quản lý
const GET_USER_REFRESTAURANTS = gql`
  query GetRestaurants($userId: ID!) {
    refRestaurants(userId: $userId) {
      id
      name
      description
      avatar
    }
  }
`;
const GET_ADMIN_RESTAURANTS = gql`
  query AdminRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        cursor
        node {
          id
          name
          avatar
          brandId
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

const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 50, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        cursor
        node {
          id
          name
          avatar
          brandId
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

// GraphQL query: thông tin người dùng
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
      restaurantForStaff
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
  const isStaffUser = isRestaurantScopedAccessRole(roleName);

  const restaurantForStaff =
    rawUser?.restaurantForStaff?.id ||
    rawUser?.restaurantForStaff ||
    fallbackUser?.restaurantForStaff?.id ||
    fallbackUser?.restaurantForStaff ||
    null;
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
    restaurantForStaff,
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

  if (roleName !== "customer") {
    delete baseUser.refRestaurants;
    delete baseUser.refRestaurant;
  }

  if (!isStaffUser) {
    delete baseUser.restaurantForStaff;
  }

  return baseUser;
}

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState("anonymous");
  const [sessionWarning, setSessionWarning] = useState("");
  const [restoreNeedsMeValidation, setRestoreNeedsMeValidation] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [refRestaurant, setRefRestaurant] = useState([]);
  const refreshRecoveryAttemptedRef = React.useRef(false);
  const refreshTimerRef = React.useRef(null);
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
  const managerId = user?.id;
  const { data: adminRestaurantsData, loading: adminRestaurantsLoading } = useQuery(
    GET_ADMIN_RESTAURANTS,
    {
      variables: { limit: 100 },
      skip: roleName !== "admin",
    }
  );
  const { data: mgrData, loading: managerRestaurantsLoading } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip:
      !managerId ||
      roleName !== "manager",
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
      setUser((prev) => {
        const merged = normalizeUserModel(me, prev);
        return merged;
      });
    },
    onError: (error) => {
      if (isAuthFailure(error)) {
        if (!token || refreshRecoveryAttemptedRef.current) {
          clearAuth();
          clearPersistedCart();
          setToken(null);
          setUser(null);
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

  const restaurantsLoading =
    (roleName === "admin" && adminRestaurantsLoading) ||
    (roleName === "manager" && managerRestaurantsLoading);

  useEffect(() => {
    if (isRestaurantScopedAccessRole(roleName)) {
      const staffRestaurantId = user?.restaurantForStaff?.id || user?.restaurantForStaff || null;
      if (staffRestaurantId) {
        setRestaurants([{ id: staffRestaurantId }]);
        return;
      }
      setRestaurants([]);
      return;
    }

    if (roleName === "admin") {
      if (adminRestaurantsData?.restaurants) {
        setRestaurants(adminRestaurantsData.restaurants.edges.map((e) => e.node));
        return;
      }
      if (!adminRestaurantsLoading) setRestaurants([]);
      return;
    }

    if (roleName === "manager") {
      if (mgrData?.restaurantsByManager) {
        setRestaurants(mgrData.restaurantsByManager.edges.map((e) => e.node));
        return;
      }
      if (!managerRestaurantsLoading) setRestaurants([]);
      return;
    }

    if (roleName !== "customer") {
      setRestaurants([]);
    }
  }, [
    adminRestaurantsData,
    adminRestaurantsLoading,
    managerRestaurantsLoading,
    mgrData,
    roleName,
    user?.restaurantForStaff,
  ]);

  useEffect(() => {
    if (roleName !== "customer") {
      setRefRestaurant([]);
    }
  }, [roleName]);

  const { error: recentRestaurantsError } = useQuery(GET_USER_REFRESTAURANTS, {
    variables: { userId: user?.id },
    skip: !user?.id || roleName !== "customer",
    onCompleted: (data) => {
      if (roleName !== "customer") return;
      const recentRestaurants = data?.refRestaurants || [];
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
  // ✅ Lấy token từ storage khi khởi động

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

  // ✅ Hàm login được gọi từ LoginPage
  const login = useCallback(
    (newToken, roleOrUser, avatar = null, options = {}) => {
      const rawUser =
        typeof roleOrUser === "string" ? { roleName: roleOrUser } : roleOrUser;
      const newUser = normalizeUserModel(rawUser, user, avatar);

      setAuth({ token: newToken });
      setToken(newToken);
      setUser(newUser);
      setSessionState("authenticated");
      setSessionWarning("");
    },
    [user]
  );

  // ✅ Lấy danh sách nhà hàng mà khách hàng có thể truy cập

  // ✅ Logout
  const logout = useCallback(() => {
    fetch(getLogoutUrl(), { method: "POST", credentials: "include" }).catch(() => {});
    setToken(null);
    setUser(null);
    setRestaurants([]);
    setRefRestaurant([]);
    setSessionState("anonymous");
    setSessionWarning("");
    clearAuth();
    clearPersistedCart();
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading: loading || (!!token && sessionState === "restoring" && (meLoading || restoreNeedsMeValidation)),
      sessionState,
      sessionWarning,
      isAuthenticated,
      login,
      logout,
      restaurants,
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
      restaurants,
      restaurantsLoading,
      refRestaurant,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
