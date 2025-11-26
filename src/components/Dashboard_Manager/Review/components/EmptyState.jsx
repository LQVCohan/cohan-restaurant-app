import React from "react";
import "./EmptyState.scss";

const EmptyState = ({ type = "default" }) => {
  const contentMap = {
    default: {
      title: "Không có đánh giá nào",
      desc: "Không tìm thấy đánh giá nào phù hợp với bộ lọc hiện tại.",
      icon: "📭",
    },
    service: {
      title: "Chưa có đánh giá dịch vụ",
      desc: "Chưa có khách hàng nào để lại đánh giá cho mục này.",
      icon: "💬",
    },
    pending: {
      title: "Không có đánh giá chờ duyệt",
      desc: "Tất cả đánh giá đã được xử lý. Tuyệt vời!",
      icon: "✨",
    },
  };

  const data = contentMap[type] || contentMap.default;

  return (
    <div className="reviews-empty">
      <div className="reviews-empty__icon">{data.icon}</div>
      <h3 className="reviews-empty__title">{data.title}</h3>
      <p className="reviews-empty__desc">{data.desc}</p>
    </div>
  );
};

export default EmptyState;
