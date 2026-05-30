import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

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
  const [status, setStatus] = useState("loading");
  const isSms = channel === "SMS";

  const [verifyAccount] = useMutation(VERIFY_ACCOUNT, {
    onCompleted: (data) => {
      if (data.verifyAccountToken) {
        setStatus("success");
        setTimeout(() => navigate("/login"), 3000);
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
    <div className="flex flex-col items-center justify-center h-[100vh] bg-gray-100 text-center px-4">
      {status === "loading" && (
        <>
          <div className="text-3xl mb-4 animate-pulse">{isSms ? "📱" : "📧"}</div>
          <p className="text-gray-600">Đang xác minh tài khoản...</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-semibold">Xác minh thành công!</h2>
          <p>Bạn sẽ được chuyển đến trang đăng nhập...</p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-red-600">
            Liên kết không hợp lệ hoặc đã hết hạn
          </h2>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Quay lại đăng nhập
          </button>
        </>
      )}
    </div>
  );
}
