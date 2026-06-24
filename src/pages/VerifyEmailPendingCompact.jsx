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

function resolveVerificationError(error) {
  const first = error?.graphQLErrors?.[0];
  const extensions = first?.extensions || {};
  const code = String(extensions.code || "").toUpperCase();
  const provider = extensions.provider ? ` Provider: ${extensions.provider}.` : "";
  const detail = extensions.error ? ` Chi tiết: ${extensions.error}.` : "";

  if (code === "EMAIL_PROVIDER_NOT_CONFIGURED") {
    return `Chưa gửi được email xác minh: backend chưa cấu hình SMTP hoặc App Password Gmail.${provider}${detail}`;
  }

  if (code === "EMAIL_DELIVERY_FAILED") {
    return `Gửi email xác minh thất bại: provider trả lỗi.${provider}${detail}`;
  }

  if (code === "TOO_MANY_REQUESTS") {
    return "Bạn vừa yêu cầu gửi lại email. Vui lòng đợi hết thời gian cooldown rồi thử lại.";
  }

  if (code === "EMAIL_NOT_SENT") {
    return `Email xác minh chưa được gửi. Trạng thái: ${extensions.deliveryStatus || "UNKNOWN"}.${provider}${detail}`;
  }

  if (error?.networkError) {
    return "Không kết nối được backend. Hãy kiểm tra backend đã chạy và GraphQL endpoint đúng chưa.";
  }

  return first?.message || error?.message || "Không thể gửi lại email xác minh.";
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
  const [feedbackType, setFeedbackType] = React.useState("success");

  const [resendVerification, { loading }] = useMutation(RESEND_VERIFICATION, {
    errorPolicy: "none",
    onCompleted: () => {
      setFeedbackType("success");
      setFeedback("Email xác minh đã được backend gửi thành công. Hãy kiểm tra Inbox, Spam hoặc Promotions.");
    },
    onError: (err) => {
      setFeedbackType("error");
      setFeedback(resolveVerificationError(err));
    },
  });

  const handleResendEmail = () => {
    setFeedback("");
    setFeedbackType("success");
    if (!email) {
      setFeedbackType("error");
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
          <p className={`account-verification-feedback ${feedbackType === "error" ? "is-error" : "is-success"}`}>
            {feedback}
          </p>
        )}
      </section>
    </main>
  );
}
