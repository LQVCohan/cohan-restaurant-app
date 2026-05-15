// src/routes/ProtectedRoute.tsx
import React, { JSX } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

/** ---- TYPINGS ---- */
// Nếu bạn đã export sẵn kiểu từ AuthContext, hãy import và dùng thay cho interface này.
interface UserLike {
  id?: string;
  email?: string;
  roleName?: string;
  role?: string;
  emailVerified?: boolean;
  restaurantForStaff?: string;
  [k: string]: unknown;
}

interface AuthContextValue {
  user: UserLike | null;
  token: string | null;
  loading: boolean;
  sessionState?: string;
  sessionWarning?: string;
  isAuthenticated: boolean;
  login: (
    token: string,
    role?: string | object,
    avatar?: string | null,
    options?: {
      persistSession?: boolean;
      rememberIdentifier?: boolean;
      identifier?: string;
    }
  ) => void;
  logout: () => void;
}

// Props cho RequireRole
interface RequireRoleProps {
  allowed?: string | string[];
  children?: React.ReactNode;
}

/** ---- UI nhỏ khi loading ---- */
function LoadingScreen(): JSX.Element {
  return (
    <div className="min-h-[40vh] w-full flex items-center justify-center">
      <div
        className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-r-transparent align-[-0.125em]"
        role="status"
        aria-label="Đang tải"
      />
      <span className="ml-2 text-sm text-gray-600">Đang xác minh phiên...</span>
    </div>
  );
}

function SessionNetworkWarning({
  message,
}: {
  message?: string;
}): JSX.Element {
  return (
    <div className="min-h-[40vh] w-full flex flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-amber-700">
        {message || "Mạng không ổn định. Đang chờ khôi phục phiên..."}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Bạn vẫn đang được giữ phiên tạm thời, vui lòng kiểm tra kết nối mạng.
      </p>
    </div>
  );
}

const shouldBlockForNetworkRecovery = ({
  token,
  sessionState,
  user,
}: {
  token: string | null;
  sessionState?: string;
  user: UserLike | null;
}) => Boolean(token && sessionState === "network_unstable" && !user);

/** ---- ProtectedRoute ----
 * - Yêu cầu đã đăng nhập
 * - Nếu chưa → chuyển /login (lưu from)
 * - Nếu chưa verify email → chuyển /verify-email
 */
export default function ProtectedRoute(): JSX.Element {
  // Cho TS biết kiểu của context (tránh {})
  const auth = React.useContext(AuthContext) as AuthContextValue | null;

  // Đưa default để tránh undefined khi context chưa sẵn
  const {
    loading = false,
    token = null,
    sessionState = "anonymous",
    sessionWarning = "",
    isAuthenticated = false,
    user = null,
  } = (auth || {}) as Partial<AuthContextValue>;

  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (shouldBlockForNetworkRecovery({ token, sessionState, user })) {
    return <SessionNetworkWarning message={sessionWarning} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user && user.emailVerified === false) {
    sessionStorage.setItem("verify_back_to", location.pathname);
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}

/** ---- RequireRole ----
 * - Chỉ cho phép những role nằm trong allowed
 */
export function RequireRole({
  allowed,
  children,
}: RequireRoleProps): JSX.Element {
  const auth = React.useContext(AuthContext) as AuthContextValue | null;
  const {
    loading = false,
    token = null,
    sessionState = "anonymous",
    sessionWarning = "",
    isAuthenticated = false,
    user = null,
  } = (auth || {}) as Partial<AuthContextValue>;

  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (shouldBlockForNetworkRecovery({ token, sessionState, user })) {
    return <SessionNetworkWarning message={sessionWarning} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user && user.emailVerified === false) {
    sessionStorage.setItem("verify_back_to", location.pathname);
    return <Navigate to="/verify-email" replace />;
  }

  const roleVal = String(user?.roleName || user?.role || "").toLowerCase();

  const allowedList: string[] = Array.isArray(allowed)
    ? allowed.map((r) => String(r).toLowerCase())
    : typeof allowed === "string"
    ? [String(allowed).toLowerCase()]
    : [];

  if (allowedList.length > 0 && !allowedList.includes(roleVal)) {
    return <Navigate to="/403" replace state={{ from: location }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
