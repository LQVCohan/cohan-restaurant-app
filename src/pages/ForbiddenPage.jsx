// src/pages/ForbiddenPage.jsx
import React from "react";
import { useRouter } from "../hooks/useRouter";
import "./ForbiddenPage.scss";
import "./ForbiddenPage.product.css";

const ForbiddenPage = () => {
  const { goBack } = useRouter();

  return (
    <main className="forbidden-page-product" aria-labelledby="forbidden-title">
      <section className="forbidden-page-product__card" aria-labelledby="forbidden-title" role="alert">
        <div className="forbidden-page-product__icon" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
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
        <h1 className="forbidden-page-product__title" id="forbidden-title">Truy cập bị từ chối</h1>
        <p className="forbidden-page-product__text">
          Tài khoản hiện không có quyền mở trang này. Bạn có thể quay lại trang trước hoặc dùng tài khoản phù hợp hơn.
        </p>
        <div className="forbidden-page-product__actions">
          <button type="button" onClick={goBack} className="forbidden-page-product__button">
            Quay lại trang trước
          </button>
          <a href="/login" className="forbidden-page-product__link">
            Đăng nhập tài khoản khác
          </a>
        </div>
      </section>
    </main>
  );
};

export default ForbiddenPage;
