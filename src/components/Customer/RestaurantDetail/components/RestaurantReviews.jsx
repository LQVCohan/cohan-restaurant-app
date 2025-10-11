import React from "react";

export default function RestaurantReviews() {
  const demo = [
    {
      name: "Nguyễn Văn A",
      date: "2 ngày trước",
      rating: 5,
      text: "Đồ ăn ngon, phục vụ chu đáo. Sẽ quay lại.",
    },
    {
      name: "Trần Thị B",
      date: "1 tuần trước",
      rating: 5,
      text: "Không gian ấm cúng, giá hợp lý.",
    },
    {
      name: "Lê Văn C",
      date: "2 tuần trước",
      rating: 4,
      text: "Ngon nhưng giờ cao điểm hơi đông.",
    },
  ];

  return (
    <div className="card">
      <h2>⭐ Đánh Giá Khách Hàng</h2>
      {demo.map((r, i) => (
        <div key={i} className="review-item">
          <div className="review-header">
            <span className="reviewer-name">{r.name}</span>
            <span className="review-date">{r.date}</span>
          </div>
          <div className="review-rating">{"⭐".repeat(r.rating)}</div>
          <div className="review-text">{r.text}</div>
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          className="btn btn-secondary"
          onClick={() => alert("🚧 Chưa hỗ trợ")}
        >
          📝 Viết đánh giá
        </button>
        <button
          className="btn btn-secondary"
          style={{ marginLeft: 8 }}
          onClick={() => alert("🚧 Chưa hỗ trợ")}
        >
          👁️ Xem tất cả
        </button>
      </div>
    </div>
  );
}
