import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./AccountVerification.product.css";

const VERIFY_ACCOUNT = gql`
  mutation VerifyAccountToken($token: String!, $channel: VerificationChannel!) {
    verifyAccountToken(token: $token, channel: $channel)
  }
`;

const pathChannel = (pathname) => {
  if (pathname.includes("verify-phone")) return "SMS";
  return "EMAIL";
};

function resolveVerifyError(error) {
  const first = error?.graphQLErrors?.[0];
  const code = first?.extensions?.code || "";
  const message = first?.message || error?.message || "";

  if (code === "BAD_USER_INPUT" || /expired|invalid/i.test(message)) {
    return "Liên kết xác minh không hợp lệ hoặc đã hết hạn. Vui lòng quay lại trang đăng nhập để yêu cầu gửi lại email xác minh.";
  }

  if (error?.networkError) {
    return "Không thể kết nối backend để xác minh. Vui lòng kiểm tra kết nối hoặc thử lại sau.";
  }

  return message || "Không thể xác minh tài khoản. Vui lòng thử lại hoặc yêu cầu gửi lại email xác minh.";
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
  const { logout } = useContext(AuthContext) || {};
  const [status, setStatus] = useState(token ? "ready" : "error");
  const [errorMessage, setErrorMessage] = useState("");
  const isSms = channel === "SMS";

  const [verifyAccount, { loading }] = useMutation(VERIFY_ACCOUNT, {
    onCompleted: (data) => {
      if (data.verifyAccountToken) {
        setStatus("success");
        setErrorMessage("");
        logout?.();
        window.history.replaceState(null, "", isSms ? "/verify-phone/confirm" : "/verify-email/confirm");
      } else {
        setStatus("error");
        setErrorMessage("Không thể xác minh tài khoản. Vui lòng yêu cầu gửi lại liên kết xác minh.");
      }
    },
    onError: (err) => {
      setStatus("error");
      setErrorMessage(resolveVerifyError(err));
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Thiếu mã xác minh trong liên kết. Vui lòng mở lại link từ email hoặc yêu cầu gửi lại email xác minh.");
      return;
    }
    setStatus((current) => (current === "error" ? "ready" : current));
  }, [token]);

  const handleConfirm = () => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Thiếu mã xác minh trong liên kết. Vui lòng mở lại link từ email hoặc yêu cầu gửi lại email xác minh.");
      return;
    }
    setStatus("verifying");
    setErrorMessage("");
    verifyAccount({ variables: { token, channel } });
  };

  return (
    <main className="account-verification-page">
      <section className="account-verification-card">
        {status === "ready" && (
          <>
            <div className="account-verification-icon" aria-hidden="true">{isSms ? "📱" : "📧"}</div>
            <h1 className="account-verification-title">Xác nhận kích hoạt tài khoản</h1>
            <p className="account-verification-text">
              FoodHub đã nhận được liên kết xác minh. Nhấn nút bên dưới để kiểm tra mã xác minh và kích hoạt tài khoản của bạn.
            </p>
            <div className="account-verification-contact">
              <p><strong>Kênh xác minh:</strong> {isSms ? "Số điện thoại" : "Email"}</p>
              <p><strong>Hiệu lực:</strong> Liên kết chỉ dùng được một lần và có thời hạn.</p>
            </div>
            <div className="account-verification-actions">
              <button className="account-verification-button is-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? "Đang xác minh..." : "Xác nhận kích hoạt"}
              </button>
              <button className="account-verification-button is-muted" onClick={() => navigate("/login", { replace: true })}>
                Để sau
              </button>
            </div>
          </>
        )}

        {status === "verifying" && (
          <>
            <div className="account-verification-spinner" aria-hidden="true" />
            <div className="account-verification-icon" aria-hidden="true">{isSms ? "📱" : "📧"}</div>
            <h1 className="account-verification-title">Đang xác minh tài khoản</h1>
            <p className="account-verification-text">
              FoodHub đang kiểm tra mã xác minh, thời hạn liên kết và trạng thái tài khoản. Quá trình này chỉ mất vài giây.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="account-verification-icon is-success" aria-hidden="true">✓</div>
            <h1 className="account-verification-title">Xác minh thành công</h1>
            <p className="account-verification-text">
              Tài khoản đã được kích hoạt. Bạn có thể đăng nhập và sử dụng FoodHub ngay bây giờ.
            </p>
            <div className="account-verification-actions">
              <button className="account-verification-button is-primary" onClick={() => navigate("/login", { replace: true })}>
                Đăng nhập ngay
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="account-verification-icon is-error" aria-hidden="true">!</div>
            <h1 className="account-verification-title">Không thể xác minh</h1>
            <p className="account-verification-text">
              {errorMessage || "Liên kết xác minh có thể đã hết hạn hoặc không đúng. Vui lòng quay lại đăng nhập để yêu cầu gửi lại xác minh."}
            </p>
            <div className="account-verification-actions">
              <button className="account-verification-button is-primary" onClick={() => navigate("/login")}>Quay lại đăng nhập</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
