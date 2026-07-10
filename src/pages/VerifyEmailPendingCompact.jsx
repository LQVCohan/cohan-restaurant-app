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

const RESEND_SMS_VERIFICATION = gql`
  mutation ResendSmsVerification($phone: String!) {
    resendSmsVerification(phone: $phone)
  }
`;

function readSessionValue(key) {
  try {
    return window.sessionStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function resolveVerificationError(error, channel = "email") {
  const first = error?.graphQLErrors?.[0];
  const code = String(first?.extensions?.code || "").toUpperCase();
  const isSms = channel === "sms";
  const contactLabel = isSms ? "SMS" : "email";

  if (code.endsWith("PROVIDER_NOT_CONFIGURED") || code.endsWith("NOT_SENT")) {
    return `Hiện chưa thể gửi ${contactLabel} xác minh. Vui lòng thử lại sau hoặc chọn phương thức xác minh khác.`;
  }

  if (code.endsWith("DELIVERY_FAILED")) {
    return `Gửi ${contactLabel} xác minh chưa thành công. Vui lòng kiểm tra lại thông tin liên hệ hoặc thử lại sau.`;
  }

  if (code === "TOO_MANY_REQUESTS") {
    return `Bạn vừa yêu cầu gửi lại ${contactLabel}. Vui lòng đợi ít phút rồi thử lại.`;
  }

  if (error?.networkError) {
    return "Kết nối không ổn định. Vui lòng kiểm tra mạng và thử lại.";
  }

  return `Không thể gửi lại ${contactLabel} xác minh lúc này. Vui lòng thử lại sau.`;
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
  const mustChangePassword =
    user?.forcePasswordChange || user?.status === "force_password_change";

  const [resendVerification, { loading: emailLoading }] = useMutation(RESEND_VERIFICATION, {
    errorPolicy: "none",
    onCompleted: () => {
      setFeedbackType("success");
      setFeedback("Đã gửi email xác minh. Vui lòng kiểm tra Hộp thư đến, Spam hoặc Quảng cáo.");
    },
    onError: (err) => {
      setFeedbackType("error");
      setFeedback(resolveVerificationError(err, "email"));
    },
  });

  const [resendSmsVerification, { loading: smsLoading }] = useMutation(RESEND_SMS_VERIFICATION, {
    errorPolicy: "none",
    onCompleted: () => {
      setFeedbackType("success");
      setFeedback("Đã gửi SMS xác minh. Vui lòng kiểm tra tin nhắn trên điện thoại.");
    },
    onError: (err) => {
      setFeedbackType("error");
      setFeedback(resolveVerificationError(err, "sms"));
    },
  });

  React.useEffect(() => {
    if (!mustChangePassword) return;
    navigate("/verify-account/confirm?forcePasswordChange=1", { replace: true });
  }, [mustChangePassword, navigate]);

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

  const handleResendSms = () => {
    setFeedback("");
    setFeedbackType("success");
    if (!phone) {
      setFeedbackType("error");
      setFeedback("Thiếu số điện thoại để gửi SMS xác nhận. Vui lòng cập nhật số điện thoại hoặc quay lại đăng nhập.");
      return;
    }
    resendSmsVerification({ variables: { phone } });
  };

  if (mustChangePassword) return null;

  return (
    <main className="account-verification-page" aria-labelledby="account-verification-title">
      <section className="account-verification-card" aria-labelledby="account-verification-title">
        <div className="account-verification-icon" aria-hidden="true">✉️</div>
        <h1 className="account-verification-title" id="account-verification-title">Xác minh tài khoản của bạn</h1>
        <p className="account-verification-text">
          Vui lòng xác minh email hoặc số điện thoại để hoàn tất kích hoạt tài khoản Cohan.
        </p>

        {(email || phone) && (
          <div className="account-verification-contact" aria-label="Thông tin cần xác minh">
            {email && <p><strong>Email:</strong> {email}</p>}
            {phone && <p><strong>SĐT:</strong> {phone}</p>}
          </div>
        )}

        <div className="account-verification-actions">
          <button
            type="button"
            className="account-verification-button is-primary"
            onClick={handleResendEmail}
            disabled={emailLoading || !email || user?.emailVerified}
          >
            {emailLoading ? "Đang gửi..." : "Gửi lại email"}
          </button>

          <button
            type="button"
            className="account-verification-button"
            onClick={handleResendSms}
            disabled={smsLoading || !phone || user?.phoneVerified}
            title={phone ? "Gửi lại SMS xác minh" : "SMS chỉ khả dụng khi tài khoản có số điện thoại"}
          >
            {smsLoading ? "Đang gửi..." : "Gửi lại SMS"}
          </button>

          <button
            type="button"
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
          <p className="account-verification-feedback is-error" role="alert">Thiếu email/SĐT để gửi xác nhận.</p>
        )}
        {!!feedback && (
          <p
            className={`account-verification-feedback ${feedbackType === "error" ? "is-error" : "is-success"}`}
            role={feedbackType === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback}
          </p>
        )}
      </section>
    </main>
  );
}
