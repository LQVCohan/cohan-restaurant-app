import React from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { AuthContext } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

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

  return (
    <div style={centerStyle()}>
      <div style={cardStyle()}>
        <h2 style={titleStyle()}>Xác minh tài khoản của bạn</h2>
        <p style={textStyle()}>
          Vui lòng xác minh email hoặc số điện thoại để hoàn tất kích hoạt tài khoản.
        </p>
        {email && <p style={textStyle()}><strong>Email:</strong> {email}</p>}
        {phone && <p style={textStyle()}><strong>SĐT:</strong> {phone}</p>}

        <div>
          <button
            style={btnStyle("#0ea5e9")}
            onClick={() => sendChannel("EMAIL")}
            disabled={loading || !email || user?.emailVerified}
          >
            {loading ? "Đang gửi..." : "Gửi lại email xác minh"}
          </button>

          <button
            style={btnStyle("#16a34a")}
            onClick={() => sendChannel("SMS")}
            disabled={loading || !phone || user?.phoneVerified}
          >
            {loading ? "Đang gửi..." : "Gửi lại SMS xác minh"}
          </button>

          <button
            style={btnStyle("#6b7280")}
            onClick={() => {
              logout?.();
              navigate("/login", { replace: true });
            }}
          >
            {isAuthenticated ? "Đăng xuất" : "Đến đăng nhập"}
          </button>
        </div>

        {!email && !phone && (
          <p style={{ color: "#b45309", marginTop: 18 }}>Thiếu email/SĐT để gửi xác nhận.</p>
        )}
        {!!feedback && <p style={{ color: feedback.includes("Không") || feedback.includes("chưa") ? "#dc2626" : "#059669", marginTop: 12 }}>{feedback}</p>}
      </div>
    </div>
  );
}

function centerStyle() {
  return { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: 16 };
}
function cardStyle() {
  return { background: "white", padding: "40px 50px", borderRadius: 16, boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)", maxWidth: 520, textAlign: "center" };
}
function titleStyle() {
  return { fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: 12 };
}
function textStyle() {
  return { fontSize: "1rem", color: "#4b5563", marginBottom: 14, lineHeight: 1.5 };
}
function btnStyle(bg = "#0ea5e9") {
  return { background: bg, color: "white", border: "none", padding: "10px 14px", borderRadius: 10, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,.08)", margin: "6px" };
}
