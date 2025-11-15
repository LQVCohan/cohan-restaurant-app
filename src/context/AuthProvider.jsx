import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const TOKEN_KEYS = { token: "auth_token", legacy: "token", user: "auth_user" };

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
      roleName
      emailVerified
      refRestaurant
    }
  }
`;

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
  const [restaurants, setRestaurants] = useState([]);
  const [refRestaurant, setRefRestaurant] = useState([]);
  useEffect(() => {
    const { token: t, user: u } = readStoredAuth();
    if (t) {
      setToken(t);
      setUser(u);
    }
    setLoading(false);
  }, []);

  const isAuthenticated = !!token;
  const managerId = user?.id;
  const {
    data: mgrData,
    loading: mgrLoading,
    error: mgrError,
  } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId,
  });

  useEffect(() => {
    if (mgrData && mgrData.restaurantsByManager) {
      setRestaurants(mgrData.restaurantsByManager.edges.map((e) => e.node));
    }
  }, [mgrData]);
  const {
    data: urrData,
    loading: urrLoading,
    error: urrError,
  } = useQuery(GET_USER_REFRESTAURANTS, {
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

  // ✅ Lấy danh sách nhà hàng mà khách hàng có thể truy cập

  // ✅ Logout
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setRestaurants([]);
    setRefRestaurant([]);
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
      restaurants,
      refRestaurant,
    }),
    [
      token,
      user,
      loading,
      isAuthenticated,
      login,
      logout,
      restaurants,
      refRestaurant,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
