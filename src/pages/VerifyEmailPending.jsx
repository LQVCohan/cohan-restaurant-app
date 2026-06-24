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
      email {
        status
        sent
        skipped
        provider
        messageId
        error
        lastSentAt
        cooldownUntil
      }
      sms {
        status
        sent
        skipped
        provider
        messageId
        error
        lastSentAt
        cooldownUntil
      }
    }
  }
`;

const RESEND_MUTATION = gql`
  mutation ResendVerification($email: String!) {
    resendVerification(email: $email)
  }
`;

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .replace(/-/g, "_")
    .toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusMeta(status, channelLabel = "email") {
  const normalized = normalizeStatus(status);
  if (normalized === "SENT") {
    return {
      tone: "success",
      title: `Backend đã gửi ${channelLabel} xác minh`,
      text: `SMTP/provider đã nhận lệnh gửi ${channelLabel}. Nếu hộp thư chưa thấy ngay, kiểm tra Spam/Promotions hoặc chờ vài phút.`,
    };
  }
  if (normalized === "ALREADY_VERIFIED" || normalized === "VERIFIED") {
    return {
      tone: "success",
      title: "Tài khoản đã được xác minh",
      text: "Không cần gửi lại liên kết xác minh.",
    };
  }
  if (normalized === "COOLDOWN") {
    return {
      tone: "warning",
      title: "Đang trong thời gian chờ gửi lại",
      text: "Hệ thống đã chặn gửi liên tục để tránh spam. Đợi hết cooldown rồi gửi lại.",
    };
  }
  if (normalized === "NOT_CONFIGURED") {
    return {
      tone: "error",
      title: `Chưa gửi được ${channelLabel}: provider chưa cấu hình`,
      text: "Backend chưa có cấu hình SMTP/SMS hợp lệ. Với email, cần kiểm tra SMTP_USER, SMTP_PASS, SMTP_HOST/SMTP_PORT hoặc App Password Gmail trong file .env backend.",
    };
  }
  if (normalized === "FAILED") {
    return {
      tone: "error",
      title: `Gửi ${channelLabel} thất bại`,
      text: "Backend đã thử gửi nhưng provider trả lỗi. Xem mã lỗi bên dưới hoặc console backend để biết nguyên nhân.",
    };
  }
  if (normalized === "SKIPPED") {
    return {
      tone: "warning",
      title: `Kênh ${channelLabel} đang bị bỏ qua`,
      text: "Kênh xác minh đang tắt hoặc không được chọn trong cấu hình backend.",
    };
  }
  return {
    tone: "muted",
    title: "Chưa có trạng thái gửi xác minh",
    text: "Nhấn Gửi lại email để backend trả về trạng thái gửi chính xác.",
  };
}

function resultText(result, channelLabel) {
  if (!result) return "";
  const meta = statusMeta(result.status, channelLabel);
  const detail = result.messageId ? ` Mã message: ${result.messageId}.` : "";
  const error = result.error ? ` Lỗi: ${result.error}.` : "";
  return `${meta.title}. ${meta.text}${detail}${error}`;
}

function getInitialVerification(user, locationState) {
  return {
    status: user?.verificationLastStatus || locationState?.verificationLastStatus,
    channel: user?.verificationLastChannel || locationState?.verificationLastChannel,
    requestedAt:
      user?.verificationLastRequestedAt || locationState?.verificationLastRequestedAt,
    emailLastSentAt:
      user?.emailVerifyLastSentAt || locationState?.emailVerifyLastSentAt,
    phoneLastSentAt:
      user?.phoneVerifyLastSentAt || locationState?.phoneVerifyLastSentAt,
  };
}

function DeliveryDiagnostics({ dispatchResult, initialVerification }) {
  const emailDelivery = dispatchResult?.email || null;
  const smsDelivery = dispatchResult?.sms || null;
  const status =
    emailDelivery?.status ||
    smsDelivery?.status ||
    dispatchResult?.status ||
    initialVerification?.status;
  const channelLabel = emailDelivery ? "email" : smsDelivery ? "SMS" : "email";
  const meta = statusMeta(status, channelLabel);

  if (!status && !dispatchResult) return null;

  const rows = [];
  if (status) rows.push(["Trạng thái", normalizeStatus(status)]);
  if (dispatchResult?.message) rows.push(["Thông báo backend", dispatchResult.message]);
  if (emailDelivery?.provider) rows.push(["Email provider", emailDelivery.provider]);
  if (emailDelivery?.messageId) rows.push(["Email messageId", emailDelivery.messageId]);
  if (emailDelivery?.lastSentAt) rows.push(["Email gửi lúc", formatDateTime(emailDelivery.lastSentAt)]);
  if (emailDelivery?.cooldownUntil) rows.push(["Cooldown đến", formatDateTime(emailDelivery.cooldownUntil)]);
  if (emailDelivery?.error) rows.push(["Email error", emailDelivery.error]);
  if (smsDelivery?.provider) rows.push(["SMS provider", smsDelivery.provider]);
  if (smsDelivery?.messageId) rows.push(["SMS messageId", smsDelivery.messageId]);
  if (smsDelivery?.error) rows.push(["SMS error", smsDelivery.error]);
  if (!dispatchResult && initialVerification?.requestedAt) {
    rows.push(["Lần yêu cầu gần nhất", formatDateTime(initialVerification.requestedAt)]);
  }
  if (!dispatchResult && initialVerification?.emailLastSentAt) {
    rows.push(["Email token tạo lúc", formatDateTime(initialVerification.emailLastSentAt)]);
  }
  if (dispatchResult?.errors?.length) {
    rows.push(["Errors", dispatchResult.errors.join(", ")]);
  }

  return (
    <section className={`account-verification-diagnostics is-${meta.tone}`}>
      <div className="account-verification-diagnostics__header">
        <span className="account-verification-status-dot" />
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.text}</p>
        </div>
      </div>
      {!!rows.length && (
        <dl className="account-verification-diagnostics__grid">
          {rows.map(([label, value]) => (
            <React.Fragment key={`${label}-${value}`}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}

export default function VerifyEmailPending() {
  const { user, logout, isAuthenticated } = React.useContext(AuthContext) || {};
  const location = useLocation();
  const email = user?.email || location.state?.email || "";
  const phone = user?.phone || location.state?.phone || "";
  const initialVerification = React.useMemo(
    () => getInitialVerification(user, location.state || {}),
    [user, location.state],
  );
  const navigate = useNavigate();
  const [feedback, setFeedback] = React.useState("");
  const [dispatchResult, setDispatchResult] = React.useState(null);

  const [requestMyVerification, { loading: loadingMy }] = useMutation(REQUEST_MY_VERIFICATION, {
    onCompleted: ({ requestMyVerification: result }) => {
      setDispatchResult(result || null);
      const emailText = resultText(result?.email, "email");
      const smsText = resultText(result?.sms, "SMS");
      setFeedback([emailText, smsText, result?.message].filter(Boolean).join(" "));
    },
    onError: (err) => {
      setDispatchResult(null);
      setFeedback(err?.message || "Không thể gửi lại xác minh.");
    },
  });

  const [resend, { loading: loadingLegacy }] = useMutation(RESEND_MUTATION, {
    onCompleted: () => {
      setDispatchResult(null);
      setFeedback(
        "Yêu cầu gửi lại đã được nhận, nhưng phiên hiện tại chưa đăng nhập nên endpoint cũ chỉ trả Boolean. Đăng nhập hoặc đăng ký lại để xem provider/messageId chi tiết.",
      );
    },
    onError: (err) => {
      setDispatchResult(null);
      setFeedback(err?.message || "Không thể gửi lại email xác minh.");
    },
  });

  const sendChannel = (channel) => {
    setFeedback("");
    setDispatchResult(null);
    if (isAuthenticated) {
      requestMyVerification({ variables: { channel } });
      return;
    }
    if (channel === "EMAIL" && email) {
      resend({ variables: { email } });
      return;
    }
    setFeedback("Vui lòng đăng nhập sau khi xác minh. Hiện chỉ có thể gửi lại email từ trang này.");
  };

  const loading = loadingMy || loadingLegacy;
  const statusForTone = normalizeStatus(dispatchResult?.status || initialVerification?.status);
  const isErrorFeedback =
    ["FAILED", "NOT_CONFIGURED"].includes(statusForTone) ||
    feedback.includes("Không") ||
    feedback.includes("chưa") ||
    feedback.includes("Thiếu") ||
    feedback.includes("thất bại");

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

        <DeliveryDiagnostics
          dispatchResult={dispatchResult}
          initialVerification={initialVerification}
        />

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
