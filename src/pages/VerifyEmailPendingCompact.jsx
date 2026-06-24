import React from "react";
import { gql, useMutation } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import "./AccountVerification.product.css";

const RESEND_VERIFICATION = gql`
  mutation ResendVerification($email: String!) {
    resendVerification(email: $email)
  }
`;

function readSessionValue(key) {
  try {
    return window.sessionStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

export default function VerifyEmailPendingCompact() {
  const { user, logout, isAuthenticated } = React.useContext(AuthContext) || {};
  const location = useLocation();
  const navigate = useNavigate();
  const email =
    user?.email ||
    location.state?.email ||
    readSessionValue("pending_verify_email") ||
    "";
  const phone =
    user?.phone ||
    location.state?.phone ||
    readSessionValue("pending_verify_phone") ||
    "";
  const [feedback, setFeedback] = React.useState("");

  const [resendVerification, { loading }] = useMutation(RESEND_VERIFICATION, {
    onCompleted: () => {
      setFeedback("Đã gửi lại email xác minh nếu tài khoản còn cần xác minh. Hãy kiểm tra Inbox, Spam hoặc Promotions.");
    },
    onError: (err) => {
      setFeedback(err?.message || "Không thể gửi lại email xác minh.");
    },
  });

  const handleResendEmail = () => {
    setFeedback("");
    if (!email) {
      setFeedback("Thiếu email để gửi xác nhận. Vui lòng quay lại đăng nhập bằng email của tài khoản.");
      return;
    }
    resendVerification({ variables: { email } });
  };

  return (
    <main className="account-verification-page">
      <section className="account-verification-card">
        <div className="account-verification-icon" aria-hidden="true">✉️</div>
        <h1 className="account-verification-title">Xác minh tài khoản của bạn</h1>
        <p className="account-verification-text">
          Vui lòng xác minh email hoặc số điện thoại để hoàn tất kích hoạt tài khoản FoodHub.
        </p>

        {(email || phone) && (
          <div className="account-verification-contact">
            {email && <p><strong>Email:</strong> {email}</p>}
            {phone && <p><strong>SĐT:</strong> {phone}</p>}
          </div>
        )}

        <div className="account-verification-actions">
          <button
            className="account-verification-button is-primary"
            onClick={handleResendEmail}
            disabled={loading || !email || user?.emailVerified}
          >
            {loading ? "Đang gửi..." : "Gửi lại email"}
          </button>

          <button
            className="account-verification-button"
            disabled
            title="SMS chỉ khả dụng khi tài khoản có số điện thoại"
          >
            Gửi lại SMS
          </button>

          <button
            className="account-verification-button is-muted"
            onClick={() => {
              logout?.();
              navigate("/login", { replace: true });
            }}
          >
            {isAuthenticated ? "Đăng xuất" : "Đến đăng nhập"}
          </button>
        </div>

        {!email && !phone && (
          <p className="account-verification-feedback is-error">Thiếu email/SĐT để gửi xác nhận.</p>
        )}
        {!!feedback && (
          <p className={`account-verification-feedback ${feedback.includes("Không") || feedback.includes("Thiếu") ? "is-error" : "is-success"}`}>
            {feedback}
          </p>
        )}
      </section>
    </main>
  );
}
