import React from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const RESEND_MUTATION = gql`
  mutation ResendVerification($email: String!) {
    resendVerification(email: $email)
  }
`;

export default function VerifyEmailPending() {
  const { user, logout } = React.useContext(AuthContext) || {};
  const email = user?.email || "";
  const navigate = useNavigate();
  const [feedback, setFeedback] = React.useState("");
  const [resend, { loading, data }] = useMutation(RESEND_MUTATION, {
    onError: (err) => setFeedback(err?.message || "Không thể gửi lại email xác minh."),
  });

  return (
    <div style={centerStyle()}>
      <div style={cardStyle()}>
        <h2 style={titleStyle()}>Xác minh email của bạn</h2>
        <p style={textStyle()}>
          Chúng tôi đã gửi liên kết xác minh tới địa chỉ email:{" "}
          <strong>{email}</strong>. Vui lòng kiểm tra hộp thư (và cả thư rác) để
          hoàn tất đăng ký.
        </p>

        <div>
          <button
            style={btnStyle("#0ea5e9")}
            onClick={() => {
              setFeedback("");
              resend({ variables: { email } });
            }}
            disabled={loading}
          >
            {loading ? "Đang gửi lại..." : "Gửi lại email xác minh"}
          </button>

          <button
            style={btnStyle("#6b7280")}
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Đăng xuất
          </button>
        </div>

        {data?.resendVerification && (
          <p style={{ color: "#059669", marginTop: 18 }}>
            ✅ Đã gửi lại email xác minh!
          </p>
        )}
        {!!feedback && <p style={{ color: "#dc2626", marginTop: 12 }}>{feedback}</p>}
      </div>
    </div>
  );
}

// ---- Các style helper ----
function centerStyle() {
  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
  };
}
function cardStyle() {
  return {
    background: "white",
    padding: "40px 50px",
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.56)",
    maxWidth: 420,
    textAlign: "center",
  };
}

function titleStyle() {
  return {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#111827",
    marginBottom: 12,
  };
}

function textStyle() {
  return {
    fontSize: "1rem",
    color: "#4b5563",
    marginBottom: 24,
    lineHeight: 1.5,
  };
}

function btnStyle(bg = "#0ea5e9") {
  return {
    background: bg,
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,.08)",
    margin: "6px",
    transition: "background 0.25s",
  };
}
