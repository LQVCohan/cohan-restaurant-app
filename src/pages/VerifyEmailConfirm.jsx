import React, { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useSearchParams, useNavigate } from "react-router-dom";

const CONFIRM_MUTATION = gql`
  mutation ConfirmEmail($token: String!) {
    verifyEmail(token: $token)
  }
`;

export default function VerifyEmailConfirm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");

  const [confirmEmail] = useMutation(CONFIRM_MUTATION, {
    onCompleted: (data) => {
      if (data.verifyEmail) {
        setStatus("success");
        setTimeout(() => navigate("/login"), 3000);
      }
    },
    onError: () => setStatus("error"),
  });

  useEffect(() => {
    if (token) confirmEmail({ variables: { token } });
  }, [confirmEmail, token]);

  return (
    <div className="flex flex-col items-center justify-center h-[100vh] bg-gray-100 text-center">
      {status === "loading" && (
        <>
          <div className="text-3xl mb-4 animate-pulse">📧</div>
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
