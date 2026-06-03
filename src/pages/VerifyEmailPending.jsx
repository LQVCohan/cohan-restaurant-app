import React from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { AuthContext } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import "./AccountVerification.product.css";

const REQUEST_MY_VERIFICATION = gql`
  mutation RequestMyVerification($channel: VerificationChannel = AUTO) {
    requestMyVerification(channel: $channel) {
      ok
      status
      message
      errors
      email { status sent skipped error cooldownUntil }
      sms { status sent skipped error cooldownUntil }
    }
  }
`;

const RESEND_MUTATION = gql`
  mutation ResendVerification($email: String!) {
    resendVerification(email: $email)
  }
`;

function resultText(result, channelLabel) {
  if (!result) return "";
  if (result.status === "SENT") return `Đã gửi ${channelLabel} xác nhận.`;
  if (result.status === "ALREADY_VERIFIED") return "Tài khoản đã được xác minh, không cần gửi lại.";
  if (result.status === "COOLDOWN") return "Vui lòng chờ trước khi gửi lại xác nhận.";
  if (result.status === "NOT_CONFIGURED") return `${channelLabel} provider chưa được cấu hình. Tài khoản đã tạo nhưng chưa gửi xác nhận.`;
  if (result.status === "SKIPPED") return `Kênh ${channelLabel} đang tắt hoặc bị bỏ qua.`;
  return result.error || "Không thể gửi xác nhận.";
}

export default function VerifyEmailPending() {
  const { user, logout, isAuthenticated } = React.useContext(AuthContext) || {};
  const location = useLocation();
  const email = user?.email || location.state?.email || "";
  const phone = user?.phone || location.state?.phone || "";
  const navigate = useNavigate();
  const [feedback, setFeedback] = React.useState("");
  const [requestMyVerification, { loading: loadingMy }] = useMutation(REQUEST_MY_VERIFICATION, {
    onCompleted: ({ requestMyVerification: result }) => {
      const emailText = resultText(result?.email, "email");
      const smsText = resultText(result?.sms, "SMS");
      setFeedback([emailText, smsText, result?.message].filter(Boolean).join(" "));
    },
    onError: (err) => setFeedback(err?.message || "Không thể gửi lại xác minh."),
  });
  const [resend, { loading: loadingLegacy }] = useMutation(RESEND_MUTATION, {
    onCompleted: () => setFeedback("Đã gửi lại email xác minh."),
    onError: (err) => setFeedback(err?.message || "Không thể gửi lại email xác minh."),
  });

  const sendChannel = (channel) => {
    setFeedback("");
    if (channel === "EMAIL" && email && !isAuthenticated) {
      resend({ variables: { email } });
      return;
    }
    if (!isAuthenticated) {
      setFeedback("Vui lòng đăng nhập sau khi xác minh. Hiện chỉ có thể gửi lại email từ trang này.");
      return;
    }
    requestMyVerification({ variables: { channel } });
  };

  const loading = loadingMy || loadingLegacy;
  const isErrorFeedback = feedback.includes("Không") || feedback.includes("chưa") || feedback.includes("Thiếu");

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
            onClick={() => sendChannel("EMAIL")}
            disabled={loading || !email || user?.emailVerified}
          >
            {loading ? "Đang gửi..." : "Gửi lại email"}
          </button>

          <button
            className="account-verification-button"
            onClick={() => sendChannel("SMS")}
            disabled={loading || !phone || user?.phoneVerified}
          >
            {loading ? "Đang gửi..." : "Gửi lại SMS"}
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
          <p className={`account-verification-feedback ${isErrorFeedback ? "is-error" : "is-success"}`}>
            {feedback}
          </p>
        )}
      </section>
    </main>
  );
}
