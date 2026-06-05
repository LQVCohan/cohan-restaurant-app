import React from "react";
import "./EmptyState.scss";

const EmptyState = ({ type = "default" }) => {
  const contentMap = {
    default: {
      title: "Chưa có đánh giá",
      desc: "Khi khách hàng gửi đánh giá, phản hồi sẽ xuất hiện tại đây để manager theo dõi và xử lý.",
      icon: "📭",
    },
    filtered: {
      title: "Không có đánh giá phù hợp",
      desc: "Không có đánh giá phù hợp với bộ lọc hiện tại.",
      icon: "🔎",
    },
    service: {
      title: "Chưa có đánh giá dịch vụ",
      desc: "Chưa có khách hàng nào để lại đánh giá cho mục này.",
      icon: "💬",
    },
    reported: {
      title: "Không có đánh giá đang được xem xét",
      desc: "Hiện không có báo cáo hoặc đánh giá rủi ro cao cần hậu kiểm.",
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
