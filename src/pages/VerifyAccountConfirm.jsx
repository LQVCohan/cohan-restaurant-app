import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toApiUrl } from "@/lib/apiBaseUrl";
import { getRoleHomeRoute, resolveRoleName } from "@/routes/routeGuard";
import { isAccountVerified } from "@/utils/accountVerification";
import "./AccountVerification.product.css";

const pathChannel = (pathname) => {
  if (pathname.includes("verify-phone")) return "SMS";
  return "EMAIL";
};

function resolveVerifyError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = error?.message || "";

  if (code === "BAD_USER_INPUT" || /expired|invalid/i.test(message)) {
    return "Liên kết xác minh không hợp lệ hoặc đã hết hạn. Vui lòng quay lại trang đăng nhập để yêu cầu gửi lại email xác minh.";
  }

  if (code === "NETWORK_ERROR") {
    return "Không thể kết nối backend để xác minh. Vui lòng kiểm tra kết nối hoặc thử lại sau.";
  }

  return message || "Không thể xác minh tài khoản. Vui lòng thử lại hoặc yêu cầu gửi lại email xác minh.";
}

async function verifyAccountByToken({ token, channel }) {
  let response;
  try {
    response = await fetch(toApiUrl("/auth/verify-account"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, channel }),
    });
  } catch (err) {
    const error = new Error(err?.message || "Network error");
    error.code = "NETWORK_ERROR";
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || "Verification failed");
    error.code = data?.code || response.status;
    throw error;
  }
  return data;
}

export default function VerifyAccountConfirm({ forcedChannel }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get("token");
  const channel = useMemo(
    () => forcedChannel || String(searchParams.get("channel") || pathChannel(location.pathname)).toUpperCase(),
    [forcedChannel, location.pathname, searchParams],
  );
  const navigate = useNavigate();
  const {
    login: authLogin,
    token: currentToken,
    user,
    isAuthenticated,
    loading: authLoading,
  } = useContext(AuthContext) || {};
  const [status, setStatus] = useState(token ? "ready" : "checking-session");
  const [errorMessage, setErrorMessage] = useState("");
  const [redirectPath, setRedirectPath] = useState("/");
  const [verifying, setVerifying] = useState(false);
  const isSms = channel === "SMS";

  useEffect(() => {
    if (token) {
      setStatus((current) => (current === "error" || current === "checking-session" ? "ready" : current));
      return;
    }

    if (authLoading) {
      setStatus("checking-session");
      return;
    }

    if (isAuthenticated && user && isAccountVerified(user)) {
      setRedirectPath(getRoleHomeRoute(resolveRoleName(user)));
      setStatus("success");
      setErrorMessage("");
      return;
    }

    setStatus("error");
    setErrorMessage("Thiếu mã xác minh trong liên kết. Vui lòng mở lại link từ email hoặc yêu cầu gửi lại email xác minh.");
  }, [authLoading, isAuthenticated, token, user]);

  const handleConfirm = async () => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Thiếu mã xác minh trong liên kết. Vui lòng mở lại link từ email hoặc yêu cầu gửi lại email xác minh.");
      return;
    }

    setVerifying(true);
    setStatus("verifying");
    setErrorMessage("");

    try {
      const payload = await verifyAccountByToken({ token, channel });
      const verifiedUser = payload?.user;
      const issuedToken = payload?.token || currentToken;

      if (issuedToken && verifiedUser) {
        authLogin?.(issuedToken, verifiedUser, null, {
          persistSession: true,
          rememberIdentifier: true,
          identifier: verifiedUser.email || verifiedUser.phone || verifiedUser.username,
        });
        setRedirectPath(getRoleHomeRoute(resolveRoleName(verifiedUser)));
      } else if (currentToken && user) {
        const fallbackUser = {
          ...user,
          status: "active",
          emailVerified: channel === "EMAIL" ? true : user.emailVerified,
          phoneVerified: channel === "SMS" ? true : user.phoneVerified,
          verifiedAt: new Date().toISOString(),
        };
        authLogin?.(currentToken, fallbackUser, null, { persistSession: true });
        setRedirectPath(getRoleHomeRoute(resolveRoleName(fallbackUser)));
      } else {
        setRedirectPath("/login");
      }

      setStatus("success");
      window.history.replaceState(null, "", isSms ? "/verify-phone/confirm" : "/verify-email/confirm");
    } catch (err) {
      setStatus("error");
      setErrorMessage(resolveVerifyError(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="account-verification-page" aria-labelledby="account-verification-title">
      <section className="account-verification-card" aria-labelledby="account-verification-title" aria-live="polite">
        {status === "checking-session" && (
          <>
            <div className="account-verification-spinner" aria-hidden="true" />
            <div className="account-verification-icon" aria-hidden="true">{isSms ? "📱" : "📧"}</div>
            <h1 className="account-verification-title" id="account-verification-title">Đang kiểm tra phiên đăng nhập</h1>
            <p className="account-verification-text">
              Cohan đang kiểm tra xem tài khoản đã được xác minh và đăng nhập trên thiết bị này chưa.
            </p>
          </>
        )}

        {status === "ready" && (
          <>
            <div className="account-verification-icon" aria-hidden="true">{isSms ? "📱" : "📧"}</div>
            <h1 className="account-verification-title" id="account-verification-title">Xác nhận kích hoạt tài khoản</h1>
            <p className="account-verification-text">
              Cohan đã nhận được liên kết xác minh. Nhấn nút bên dưới để kiểm tra mã xác minh, kích hoạt tài khoản và đăng nhập tự động.
            </p>
            <div className="account-verification-contact" aria-label="Thông tin liên kết xác minh">
              <p><strong>Kênh xác minh:</strong> {isSms ? "Số điện thoại" : "Email"}</p>
              <p><strong>Hiệu lực:</strong> Liên kết chỉ dùng được một lần và có thời hạn.</p>
            </div>
            <div className="account-verification-actions">
              <button type="button" className="account-verification-button is-primary" onClick={handleConfirm} disabled={verifying}>
                {verifying ? "Đang xác minh..." : "Xác nhận & đăng nhập"}
              </button>
              <button type="button" className="account-verification-button is-muted" onClick={() => navigate("/login", { replace: true })}>
                Để sau
              </button>
            </div>
          </>
        )}

        {status === "verifying" && (
          <>
            <div className="account-verification-spinner" aria-hidden="true" />
            <div className="account-verification-icon" aria-hidden="true">{isSms ? "📱" : "📧"}</div>
            <h1 className="account-verification-title" id="account-verification-title">Đang xác minh tài khoản</h1>
            <p className="account-verification-text">
              Cohan đang kiểm tra mã xác minh, kích hoạt tài khoản và tạo phiên đăng nhập cho bạn.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="account-verification-icon is-success" aria-hidden="true">✓</div>
            <h1 className="account-verification-title" id="account-verification-title">Xác minh thành công</h1>
            <p className="account-verification-text">
              Tài khoản đã được kích hoạt và đăng nhập tự động trên thiết bị này.
            </p>
            <div className="account-verification-actions">
              <button type="button" className="account-verification-button is-primary" onClick={() => navigate(redirectPath, { replace: true })}>
                Vào Cohan ngay
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="account-verification-icon is-error" aria-hidden="true">!</div>
            <h1 className="account-verification-title" id="account-verification-title">Không thể xác minh</h1>
            <p className="account-verification-text" role="alert">
              {errorMessage || "Liên kết xác minh có thể đã hết hạn hoặc không đúng. Vui lòng quay lại đăng nhập để yêu cầu gửi lại xác minh."}
            </p>
            <div className="account-verification-actions">
              <button type="button" className="account-verification-button is-primary" onClick={() => navigate("/login")}>Quay lại đăng nhập</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
