// src/pages/Reviews/components/ReviewsHeader.jsx
import React from "react";
import "./ReviewsHeader.scss";

/**
 * Header tóm tắt cho trang quản lý đánh giá
 * - Tiêu đề + mô tả ngắn
 * - 3 ô thống kê có icon
 */
const ReviewsHeader = ({ total = 0, avg = "0.0", pending = 0 }) => {
  return (
    <section className="reviews-header-card">
      <div className="reviews-header-card__left">
        <div className="reviews-header-card__eyebrow">
          <span className="reviews-header-card__eyebrow-dot" />
          Tổng quan đánh giá khách hàng
        </div>
        <h1 className="reviews-header-card__title">
          Quản lý đánh giá &amp; phản hồi
        </h1>
        <p className="reviews-header-card__subtitle">
          Theo dõi chất lượng dịch vụ, xử lý phản hồi và tối ưu trải nghiệm
          khách hàng tại các chi nhánh.
        </p>
      </div>

      <div className="reviews-header-card__right">
        <div className="reviews-header-card__stat">
          <div className="reviews-header-card__stat-icon">📊</div>
          <div className="reviews-header-card__stat-text">
            <span className="reviews-header-card__stat-label">
              Tổng đánh giá
            </span>
            <span className="reviews-header-card__stat-value">{total}</span>
          </div>
        </div>

        <div className="reviews-header-card__stat">
          <div className="reviews-header-card__stat-icon">⭐</div>
          <div className="reviews-header-card__stat-text">
            <span className="reviews-header-card__stat-label">
              Điểm trung bình
            </span>
            <span className="reviews-header-card__stat-value">{avg}</span>
          </div>
        </div>

        <div className="reviews-header-card__stat">
          <div className="reviews-header-card__stat-icon">⏳</div>
          <div className="reviews-header-card__stat-text">
            <span className="reviews-header-card__stat-label">Đang xem xét</span>
            <span className="reviews-header-card__stat-value">{pending}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewsHeader;
