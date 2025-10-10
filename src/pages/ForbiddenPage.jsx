// src/pages/ForbiddenPage.jsx
import React from "react";
import { useRouter } from "../hooks/useRouter";
import "../styles/Forbidden.scss"; // nếu bạn muốn style riêng

const ForbiddenPage = () => {
  const { goBack } = useRouter();

  return (
    <div className="forbidden-page flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
      <div className="max-w-md">
        <div className="icon text-red-500 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-24 w-24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          403 - Truy cập bị từ chối
        </h1>
        <p className="text-gray-600 mb-6">
          Bạn không có quyền truy cập vào trang này.
          <br />
          Vui lòng liên hệ quản trị viên hoặc quay lại trang trước.
        </p>

        <button
          onClick={goBack}
          className="px-5 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          Quay lại trang trước
        </button>
      </div>
    </div>
  );
};

export default ForbiddenPage;
