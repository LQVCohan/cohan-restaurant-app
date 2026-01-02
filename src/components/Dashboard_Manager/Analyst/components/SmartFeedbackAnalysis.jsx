import React, { useState, useMemo } from "react";
import {
  Star,
  MoreHorizontal,
  Reply,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Filter,
  Sparkles,
} from "lucide-react";
import "./SmartFeedbackAnalysis.scss";

const SmartFeedbackAnalysis = () => {
  const [filter, setFilter] = useState("all"); // 'all' | 'negative' | 'positive' | 'attention'

  // Dữ liệu giả lập nhiều hơn để test scroll
  const reviews = [
    {
      id: 1,
      user: "Trần Minh Tuấn",
      avatar: "https://i.pravatar.cc/150?u=3",
      rating: 2,
      time: "15 phút trước",
      comment:
        "Đợi món quá lâu, hơn 45 phút mới có đồ ăn. Nhân viên thì lơ là không fill nước.",
      sentiment: "negative",
      tags: ["wait_time", "service"],
      insight: "Khách phàn nàn về tốc độ ra món vào giờ cao điểm.",
      suggestion:
        "Kiểm tra lại quy trình Bếp nóng & Tăng cường 1 Runner khu vực lầu 2.",
    },
    {
      id: 2,
      user: "Nguyễn Thu Hà",
      avatar: "https://i.pravatar.cc/150?u=4",
      rating: 5,
      time: "2 giờ trước",
      comment:
        "Món Bò Wagyu nướng đá cực ngon, sốt tiêu đen rất vừa miệng. Sẽ quay lại!",
      sentiment: "positive",
      tags: ["food_quality", "flavor"],
    },
    {
      id: 3,
      user: "Lê Văn Cường",
      avatar: "https://i.pravatar.cc/150?u=8",
      rating: 3,
      time: "1 ngày trước",
      comment: "Không gian đẹp nhưng nhạc hơi ồn, khó nói chuyện với đối tác.",
      sentiment: "neutral",
      tags: ["ambience", "noise"],
      insight: "Vấn đề về môi trường âm thanh.",
      suggestion:
        "Điều chỉnh volume nhạc xuống mức 40% hoặc đổi playlist 'Jazz Chill'.",
    },
    {
      id: 4,
      user: "Phạm Hương",
      avatar: "https://i.pravatar.cc/150?u=12",
      rating: 1,
      time: "2 ngày trước",
      comment: "Thái độ nhân viên bảo vệ rất tệ, quát nạt khách khi gửi xe.",
      sentiment: "negative",
      tags: ["service", "staff_attitude"],
      insight: "Sự cố nghiêm trọng về thái độ phục vụ tại cửa ra vào.",
      suggestion:
        "Cần training lại đội ngũ bảo vệ hoặc thay đổi nhân sự ca tối.",
    },
    {
      id: 5,
      user: "Hoàng Đức",
      avatar: "https://i.pravatar.cc/150?u=20",
      rating: 4,
      time: "3 ngày trước",
      comment: "Đồ ăn ngon nhưng giá hơi cao so với mặt bằng chung.",
      sentiment: "neutral",
      tags: ["price"],
    },
    {
      id: 6,
      user: "Lisa Nguyen",
      avatar: "https://i.pravatar.cc/150?u=25",
      rating: 5,
      time: "3 ngày trước",
      comment: "Tuyệt vời! Không gian check-in sang chảnh.",
      sentiment: "positive",
      tags: ["ambience"],
    },
  ];

  // Logic lọc dữ liệu thông minh
  const filteredReviews = useMemo(() => {
    if (filter === "all") return reviews;
    if (filter === "negative") return reviews.filter((r) => r.rating <= 2);
    if (filter === "positive") return reviews.filter((r) => r.rating >= 4);
    if (filter === "attention")
      return reviews.filter((r) => r.insight || r.suggestion); // Chỉ hiện cái cần xử lý
    return reviews;
  }, [filter]);

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={12}
        fill={i < rating ? "#f59e0b" : "#e2e8f0"}
        stroke="none"
      />
    ));
  };

  const getTagLabel = (tag) => {
    const map = {
      wait_time: "⏳ Chờ lâu",
      service: "User Service",
      food_quality: "🥩 Chất lượng",
      flavor: "😋 Hương vị",
      ambience: "🏠 Không gian",
      noise: "🔊 Tiếng ồn",
      staff_attitude: "😡 Thái độ",
      price: "💰 Giá cả",
    };
    return map[tag] || tag;
  };

  return (
    <div className="widget-card feedback-analysis-widget">
      {/* 1. HEADER & AI SUMMARY */}
      <div className="widget-header">
        <div className="header-top">
          <div>
            <h4>Phân Tích & Phản Hồi</h4>
            <span className="subtitle">Real-time Customer Sentiment</span>
          </div>
          <div className="rating-badge">
            <span className="score">4.2</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={8} fill="#fff" stroke="none" />
              ))}
            </div>
          </div>
        </div>

        {/* AI Quick Insight Banner */}
        <div className="ai-daily-summary">
          <Sparkles size={14} className="sparkle-icon" />
          <p>
            <strong>Hôm nay:</strong> 65% phản hồi tích cực. Cần chú ý vấn đề
            <span className="highlight-issue"> Thời gian chờ</span> vào giờ
            trưa.
          </p>
        </div>

        {/* Smart Filters */}
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`negative ${filter === "negative" ? "active" : ""}`}
            onClick={() => setFilter("negative")}
          >
            Tiêu cực (2)
          </button>
          <button
            className={`attention ${filter === "attention" ? "active" : ""}`}
            onClick={() => setFilter("attention")}
          >
            Cần xử lý AI 🤖
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE LIST */}
      <div className="feedback-scroll-area">
        <div className="feedback-list">
          {filteredReviews.length === 0 ? (
            <div className="empty-state">Không có đánh giá nào phù hợp.</div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review.id} className="feedback-item">
                {/* User Info Line */}
                <div className="item-header">
                  <img
                    src={review.avatar}
                    alt={review.user}
                    className="avatar"
                  />
                  <div className="meta-info">
                    <div className="user-row">
                      <span className="username">{review.user}</span>
                      <span className="time">{review.time}</span>
                    </div>
                    <div className="rating-row">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <button className="btn-more">
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="item-body">
                  <div className="comment-bubble">{review.comment}</div>

                  <div className="tags-list">
                    {review.tags.map((tag) => (
                      <span key={tag} className={`tag ${tag}`}>
                        {getTagLabel(tag)}
                      </span>
                    ))}
                  </div>

                  {/* AI Action Box - Chỉ hiện khi có suggestion */}
                  {(review.insight || review.suggestion) && (
                    <div className="ai-action-card">
                      <div className="card-left-border"></div>
                      <div className="card-content">
                        <div className="ai-title">
                          <Lightbulb size={14} /> AI Recommendation
                        </div>
                        <p className="ai-text">
                          {review.suggestion || review.insight}
                        </p>
                        <div className="ai-actions">
                          <button className="action-btn reply">
                            <Reply size={12} /> Phản hồi nhanh
                          </button>
                          <button className="action-btn report">
                            <AlertTriangle size={12} /> Báo cáo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {/* Fake loader bottom để tạo cảm giác scroll vô tận */}
          <div className="list-footer-loader">
            Đang hiển thị {filteredReviews.length} đánh giá mới nhất
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartFeedbackAnalysis;
