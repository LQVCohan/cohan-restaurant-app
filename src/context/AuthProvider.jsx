import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { isStaffOperationalRole } from "@/utils/frontendRoleAccess";
import {
  readStorageValue,
} from "@/lib/browserStorage";
import { clearPersistedCart } from "@/hooks/useCart";
import { clearAuth, clearLegacyAuthStorage, setAuth } from "@/lib/authStorage";
import { getLogoutUrl, getRefreshUrl } from "@/lib/apiBaseUrl";

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
const isStaffAccessRole = (roleName) => isStaffOperationalRole(roleName);

// GraphQL query để lấy danh sách nhà hàng của người quản lý
const GET_USER_REFRESTAURANTS = gql`
  query GetRestaurants($userId: ID!) {
    restaurantsByUser(userId: $userId) {
      id
      name
      location
      description
      image
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
      emailVerified
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
  const isStaffUser = isStaffAccessRole(roleName);

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
  const [restaurants, setRestaurants] = useState([]);
  const [refRestaurant, setRefRestaurant] = useState([]);
  useEffect(() => {
    clearLegacyAuthStorage();
    fetch(getRefreshUrl(), { method: "POST", credentials: "include" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.token) {
          setAuth({ token: payload.token });
          setToken(payload.token);
          setUser(normalizeUserModel(payload.user));
          setSessionState("authenticated");
        } else {
          setSessionState("anonymous");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const isAuthenticated = !!token;
  const roleName = String(user?.roleName || user?.role?.slug || "").toLowerCase();
  const managerId = user?.id;
  const { data: mgrData } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId || !["manager", "admin", "hr", "accountant"].includes(roleName),
  });

  const { loading: meLoading, refetch: refetchMe } = useQuery(ME_QUERY, {
    skip: !token,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      const me = data?.me;
      if (!me) return;
      setSessionState("authenticated");
      setSessionWarning("");
      setUser((prev) => {
        const merged = normalizeUserModel(me, prev);
                return merged;
      });
    },
    onError: (error) => {
      if (isAuthFailure(error)) {
        clearLegacyAuthStorage();
        clearPersistedCart();
        setToken(null);
        setUser(null);
        setRestaurants([]);
        setRefRestaurant([]);
        setSessionState("anonymous");
        setSessionWarning("");
        return;
      }
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
    if (isStaffAccessRole(roleName)) {
      const staffRestaurantId = user?.restaurantForStaff?.id || user?.restaurantForStaff || null;
      if (staffRestaurantId) {
        setRestaurants([{ id: staffRestaurantId }]);
        return;
      }
      setRestaurants([]);
      return;
    }

    if (mgrData?.restaurantsByManager) {
      setRestaurants(mgrData.restaurantsByManager.edges.map((e) => e.node));
      return;
    }
    if (roleName !== "customer") {
      setRestaurants([]);
    }
  }, [mgrData, roleName, user?.restaurantForStaff]);

  useEffect(() => {
    if (roleName !== "customer") {
      setRefRestaurant([]);
    }
  }, [roleName]);

  const { data: urrData, error: urrError } = useQuery(GET_USER_REFRESTAURANTS, {
    variables: { userId: user?.id },
    skip: user?.roleName !== "customer",
    onCompleted: (urrData) => {
      setRefRestaurant(urrData.restaurantsByUser || []);
    },
  });
  useEffect(() => {
    if (urrError) {
      setRefRestaurant([]);
    }
  }, [urrError]);
  useEffect(() => {
    if (urrData && urrData.restaurantsByUser) {
      setRestaurants(urrData.restaurantsByUser);
    }
  }, [urrData]);
  // ✅ Lấy token từ storage khi khởi động

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
      loading: loading || (!!token && sessionState === "restoring" && meLoading),
      sessionState,
      sessionWarning,
      isAuthenticated,
      login,
      logout,
      restaurants,
      refRestaurant,
      rememberedLoginIdentifier: readStorageValue(TOKEN_KEYS.rememberedIdentifier) || "",
    }),
    [
      token,
      user,
      loading,
      meLoading,
      sessionState,
      sessionWarning,
      isAuthenticated,
      login,
      logout,
      restaurants,
      refRestaurant,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
