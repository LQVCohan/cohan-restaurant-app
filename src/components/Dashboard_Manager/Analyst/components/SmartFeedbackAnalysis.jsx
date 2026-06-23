import React, { useMemo, useState } from "react";
import { ArrowRight, Star, Sparkles } from "lucide-react";
import "./SmartFeedbackAnalysis.scss";

const goReviews = () => window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page: "reviews", source: "manager-analytics" } }));

const SmartFeedbackAnalysis = ({ summary, feedbacks = [], loading }) => {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return feedbacks;
    return feedbacks.filter((x) => x.sentiment === filter);
  }, [feedbacks, filter]);
  const totalReviews = Number(summary?.total || 0);
  const hasReviews = totalReviews > 0;

  return (
    <div className="widget-card feedback-analysis-widget">
      <div className="widget-header">
        <div className="header-top">
          <div>
            <h4>Phân tích phản hồi</h4>
            <span className="subtitle">Ý kiến thật từ khách hàng</span>
          </div>
          <div className={`rating-badge ${hasReviews ? "" : "is-empty"}`}>
            <span className="score">{hasReviews ? summary?.avgRating || 0 : "—"}</span>
            {hasReviews ? (
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={8} fill="#fff" stroke="none" />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ai-daily-summary">
          <Sparkles size={14} className="sparkle-icon" />
          <p>
            Tổng {totalReviews} đánh giá • Tích cực {summary?.positive || 0} • Tiêu cực {summary?.negative || 0}
          </p>
        </div>
        <div className="filter-tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tất cả</button>
          <button className={filter === "positive" ? "active" : ""} onClick={() => setFilter("positive")}>Tích cực</button>
          <button className={filter === "negative" ? "active" : ""} onClick={() => setFilter("negative")}>Tiêu cực</button>
        </div>
      </div>
      <div className="feedback-scroll-area">
        <div className="feedback-list">
          {loading ? <div className="empty-state">Đang tải đánh giá...</div> : null}
          {!loading && filtered.length === 0 ? (
            <div className="empty-state analytics-action-empty">
              <strong>Không có phản hồi phù hợp</strong>
              <p>Phản hồi mới sẽ xuất hiện tại đây sau khi khách gửi đánh giá.</p>
              <button type="button" className="widget-cta" onClick={goReviews}>Xem phản hồi <ArrowRight size={14} /></button>
            </div>
          ) : null}
          {!loading &&
            filtered.map((review) => (
              <div key={review.id} className="feedback-item">
                <div className="item-header">
                  <div className="meta-info">
                    <div className="user-row">
                      <span className="username">{review.customerName}</span>
                      <span className="time">
                        {review.createdAt ? new Date(review.createdAt).toLocaleString("vi-VN") : "—"}
                      </span>
                    </div>
                    <div className="rating-row">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} fill={i < review.rating ? "#8a633f" : "#d9d2c4"} stroke="none" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="item-body">
                  <div className="comment-bubble">{review.content}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SmartFeedbackAnalysis;
