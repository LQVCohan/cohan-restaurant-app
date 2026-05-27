import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { isStaffOperationalRole } from "@/utils/frontendRoleAccess";
import { readStorageValue } from "@/lib/browserStorage";
import { clearPersistedCart } from "@/hooks/useCart";
import { clearAuth, clearLegacyAuthStorage, setAuth } from "@/lib/authStorage";
import { buildBackendAuthUrl } from "@/lib/apiBase";

const AUTH_ERROR_CODES = new Set(["UNAUTHENTICATED", "FORBIDDEN", "INVALID_TOKEN", "TOKEN_EXPIRED", "TOKEN_REVOKED", "UNAUTHORIZED"]);
const isStaffAccessRole = (roleName) => isStaffOperationalRole(roleName);

const GET_USER_REFRESTAURANTS = gql`query GetRestaurants($userId: ID!) { restaurantsByUser(userId: $userId) { id name location description image } }`;
const GET_MANAGER_RESTAURANTS = gql`query ManagerRestaurants($managerId: ID!, $limit: Int = 50, $cursor: ID) { restaurantsByManager(managerId: $managerId, limit: $limit, cursor: $cursor) { edges { cursor node { id name avatar address { city } } } pageInfo { endCursor hasNextPage } } }`;
const ME_QUERY = gql`query Me { me { id fullName email phone username avatarUrl roleName emailVerified wallet { provider status balance currency updatedAt } refRestaurants { id name } restaurantForStaff employmentType department positionTitle } }`;

function getNetworkStatusCode(error) { return error?.networkError?.statusCode || error?.networkError?.response?.status || error?.networkError?.status || null; }
function isAuthFailure(error) { const gqlErrors = Array.isArray(error?.graphQLErrors) ? error.graphQLErrors : []; if (gqlErrors.some((item) => AUTH_ERROR_CODES.has(String(item?.extensions?.code || "").toUpperCase()))) return true; const status = getNetworkStatusCode(error); return status === 401 || status === 403; }
function normalizeUserModel(rawUser, fallbackUser = null, avatar = null) { const roleName = String(rawUser?.roleName || rawUser?.role?.slug || fallbackUser?.roleName || fallbackUser?.role?.slug || "customer").trim().toLowerCase(); const baseUser = { ...(fallbackUser || {}), ...(rawUser || {}), roleName, avatar: avatar ?? rawUser?.avatar ?? rawUser?.avatarUrl ?? fallbackUser?.avatar ?? null, status: rawUser?.status || fallbackUser?.status || "active" }; if (roleName !== "customer") { delete baseUser.refRestaurants; delete baseUser.refRestaurant; } if (!isStaffAccessRole(roleName)) delete baseUser.restaurantForStaff; return baseUser; }

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(null); const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState("anonymous"); const [sessionWarning, setSessionWarning] = useState("");
  const [restaurants, setRestaurants] = useState([]); const [refRestaurant, setRefRestaurant] = useState([]);

  useEffect(() => { clearLegacyAuthStorage(); fetch(buildBackendAuthUrl("/api/auth/refresh"), { method: "POST", credentials: "include" }).then(async (res) => (res.ok ? res.json() : null)).then((payload) => { if (payload?.token) { setAuth({ token: payload.token }); setToken(payload.token); setUser(normalizeUserModel(payload.user)); setSessionState("authenticated"); } else setSessionState("anonymous"); }).finally(() => setLoading(false)); }, []);

  const roleName = String(user?.roleName || user?.role?.slug || "").toLowerCase();
  const { data: mgrData } = useQuery(GET_MANAGER_RESTAURANTS, { variables: { managerId: user?.id, limit: 50 }, skip: !user?.id || !["manager", "admin", "hr", "accountant"].includes(roleName) });
  const { loading: meLoading, refetch: refetchMe } = useQuery(ME_QUERY, { skip: !token, fetchPolicy: "network-only", notifyOnNetworkStatusChange: true, onCompleted: (data) => { if (data?.me) { setSessionState("authenticated"); setSessionWarning(""); setUser((prev) => normalizeUserModel(data.me, prev)); } }, onError: (error) => { if (isAuthFailure(error)) { clearLegacyAuthStorage(); clearPersistedCart(); setToken(null); setUser(null); setRestaurants([]); setRefRestaurant([]); setSessionState("anonymous"); setSessionWarning(""); return; } setSessionState("network_unstable"); setSessionWarning("Mạng không ổn định. Đang cố khôi phục phiên đăng nhập..."); } });

  useEffect(() => { if (!token || sessionState !== "network_unstable") return; const handleOnline = () => { setSessionState("restoring"); refetchMe().catch(() => { setSessionState("network_unstable"); setSessionWarning("Mạng chưa ổn định. Vui lòng kiểm tra kết nối và thử lại."); }); }; window.addEventListener("online", handleOnline); const retryTimer = window.setTimeout(handleOnline, 5000); return () => { window.removeEventListener("online", handleOnline); window.clearTimeout(retryTimer); }; }, [token, sessionState, refetchMe]);

  useEffect(() => { if (isStaffAccessRole(roleName)) { const id = user?.restaurantForStaff?.id || user?.restaurantForStaff || null; setRestaurants(id ? [{ id }] : []); return; } if (mgrData?.restaurantsByManager) { setRestaurants(mgrData.restaurantsByManager.edges.map((e) => e.node)); return; } if (roleName !== "customer") setRestaurants([]); }, [mgrData, roleName, user?.restaurantForStaff]);
  useEffect(() => { if (roleName !== "customer") setRefRestaurant([]); }, [roleName]);
  const { data: urrData, error: urrError } = useQuery(GET_USER_REFRESTAURANTS, { variables: { userId: user?.id }, skip: user?.roleName !== "customer", onCompleted: (d) => setRefRestaurant(d.restaurantsByUser || []) });
  useEffect(() => { if (urrError) setRefRestaurant([]); }, [urrError]);
  useEffect(() => { if (urrData?.restaurantsByUser) setRestaurants(urrData.restaurantsByUser); }, [urrData]);

  const login = useCallback((newToken, roleOrUser, avatar = null) => { const rawUser = typeof roleOrUser === "string" ? { roleName: roleOrUser } : roleOrUser; setAuth({ token: newToken }); setToken(newToken); setUser(normalizeUserModel(rawUser, user, avatar)); setSessionState("authenticated"); setSessionWarning(""); }, [user]);
  const logout = useCallback(() => { fetch(buildBackendAuthUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {}); setToken(null); setUser(null); setRestaurants([]); setRefRestaurant([]); setSessionState("anonymous"); setSessionWarning(""); clearAuth(); clearPersistedCart(); navigate("/login", { replace: true }); }, [navigate]);

  const value = useMemo(() => ({ token, user, loading: loading || (!!token && sessionState === "restoring" && meLoading), sessionState, sessionWarning, isAuthenticated: !!token, login, logout, restaurants, refRestaurant, rememberedLoginIdentifier: readStorageValue("remembered_login_identifier") || "" }), [token, user, loading, meLoading, sessionState, sessionWarning, login, logout, restaurants, refRestaurant]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
