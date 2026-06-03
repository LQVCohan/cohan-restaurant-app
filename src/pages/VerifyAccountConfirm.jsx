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
  const [status, setStatus] = useState("loading");
  const isSms = channel === "SMS";

  const [verifyAccount] = useMutation(VERIFY_ACCOUNT, {
    onCompleted: (data) => {
      if (data.verifyAccountToken) {
        setStatus("success");
        logout?.();
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    },
    onError: () => setStatus("error"),
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    verifyAccount({ variables: { token, channel } });
  }, [channel, token, verifyAccount]);

  return (
    <main className="account-verification-page">
      <section className="account-verification-card">
        {status === "loading" && (
          <>
            <div className="account-verification-spinner" aria-hidden="true" />
            <div className="account-verification-icon" aria-hidden="true">{isSms ? "📱" : "📧"}</div>
            <h1 className="account-verification-title">Đang xác minh tài khoản</h1>
            <p className="account-verification-text">
              FoodHub đang kiểm tra liên kết xác minh của bạn. Quá trình này chỉ mất vài giây.
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="account-verification-icon is-success" aria-hidden="true">✓</div>
            <h1 className="account-verification-title">Xác minh thành công</h1>
            <p className="account-verification-text">
              Tài khoản đã được kích hoạt. Bạn sẽ được chuyển đến trang đăng nhập trong giây lát.
            </p>
            <div className="account-verification-actions">
              <button className="account-verification-button is-primary" onClick={() => navigate("/login", { replace: true })}>
                Đến đăng nhập
              </button>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="account-verification-icon is-error" aria-hidden="true">!</div>
            <h1 className="account-verification-title">Liên kết không hợp lệ</h1>
            <p className="account-verification-text">
              Liên kết xác minh có thể đã hết hạn hoặc không đúng. Vui lòng quay lại đăng nhập để yêu cầu gửi lại xác minh.
            </p>
            <div className="account-verification-actions">
              <button className="account-verification-button is-primary" onClick={() => navigate("/login")}>
                Quay lại đăng nhập
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
