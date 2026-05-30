import React from "react";
import EmptyState from "./EmptyState";
import "./ReviewsList.scss";

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} tuần trước`;
  return date.toLocaleDateString("vi-VN");
}

function getStarRating(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function parseImages(imagesString) {
  try {
    return imagesString ? JSON.parse(imagesString) : [];
  } catch {
    return [];
  }
}

function parseTags(tagsString) {
  try {
    return tagsString ? JSON.parse(tagsString) : [];
  } catch {
    return [];
  }
}

const reactionMeta = [
  ["like", "👍"],
  ["love", "❤️"],
  ["care", "🤗"],
  ["haha", "😆"],
  ["wow", "😮"],
  ["sad", "😢"],
  ["angry", "😡"],
];

const ReviewsList = ({ isLoading, reviews, currentTab, onView, onDelete, onEdit, permissions = {} }) => {
  if (isLoading) {
    return (
      <div className="reviews-loading">
        <div className="reviews-loading__spinner" />
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <EmptyState
        type={
          currentTab === "service" ? "service" : currentTab === "pending" ? "pending" : "default"
        }
      />
    );
  }

  return (
    <div className="reviews-list">
      {reviews.map((review) => {
        const images = parseImages(review.images);
        const tags = parseTags(review.tags);
        const activeReactions = reactionMeta.filter(([key]) => Number(review.reactions?.[key] || 0) > 0);

        const statusClass =
          review.status === "published"
            ? "reviews-review-card__status--published"
            : review.status === "pending"
            ? "reviews-review-card__status--pending"
            : review.status === "hidden"
            ? "reviews-review-card__status--hidden"
            : review.status === "reported"
            ? "reviews-review-card__status--reported"
            : "";

        return (
          <article key={review.id} className="reviews-review-card">
            <div className="reviews-review-card__header">
              <div className="reviews-review-card__reviewer">
                <div className="reviews-review-card__avatar">
                  {review.customer_avatar ? <img src={review.customer_avatar} alt={review.customer_name} /> : getInitials(review.customer_name)}
                </div>
                <div>
                  <div className="reviews-review-card__name">{review.customer_name}</div>
                  <div className="reviews-review-card__meta">
                    <span>📍 {review.location}</span>
                    <span>•</span>
                    <span>🕒 {formatDate(review.created_at)}</span>
                    {review.verified_purchase && <span className="reviews-review-card__verified">✓ Đã xác thực</span>}
                  </div>
                </div>
              </div>

              <div className="reviews-review-card__actions">
                <button type="button" className="reviews-review-card__action-btn" title="Xem chi tiết" onClick={() => onView(review)}>
                  👁️
                </button>
                {permissions.canModerate && review.status !== "published" && (
                  <button type="button" className="reviews-review-card__action-btn" title="Duyệt" onClick={() => onEdit(review, "published")}>✅</button>
                )}
                {permissions.canModerate && review.status !== "hidden" && (
                  <button type="button" className="reviews-review-card__action-btn" title="Ẩn" onClick={() => onEdit(review, "hidden")}>🙈</button>
                )}
                {permissions.canModerate && review.status !== "reported" && (
                  <button type="button" className="reviews-review-card__action-btn" title="Đánh dấu bị báo cáo" onClick={() => onEdit(review, "reported")}>🚩</button>
                )}
                {permissions.canDelete && (
                  <button type="button" className="reviews-review-card__action-btn" title="Xóa" onClick={() => onDelete(review)}>
                    🗑️
                  </button>
                )}
              </div>
            </div>

            <div className="reviews-review-card__rating-row">
              <div className="reviews-review-card__stars">
                <span className="star">{getStarRating(review.rating)}</span>
              </div>
              <span className="reviews-review-card__rating-number">{review.rating}/5</span>
              <span className="reviews-review-card__target">{review.target_name}</span>
              {review.restaurant_name && <span className="reviews-review-card__restaurant">🏪 {review.restaurant_name}</span>}
            </div>

            <div className="reviews-review-card__content">
              <h3 className="reviews-review-card__title">{review.title}</h3>
              <p className="reviews-review-card__text">{review.content}</p>
              <p className="reviews-review-card__text">
                <strong>Nhân viên được đánh giá:</strong>{" "}
                {review.staff_name || "Không gắn nhân viên"}
              </p>
              <p className="reviews-review-card__text" style={{ fontStyle: "italic" }}>
                Review đã duyệt sẽ được dùng làm dữ liệu tham khảo hiệu suất ở lần tính lại tiếp theo.
              </p>

              {images.length > 0 && (
                <div className="reviews-review-card__images">
                  {images.map((img) => (
                    <img key={img} src={img} alt="Review" className="reviews-review-card__image" />
                  ))}
                </div>
              )}

              {tags.length > 0 && (
                <div className="reviews-review-card__tags">
                  {tags.map((tag) => (
                    <span key={tag} className="reviews-review-card__tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <footer className="reviews-review-card__footer">
              <div className="reviews-review-card__stats">
                <div className="reviews-review-card__stat">
                  <span>💬</span>
                  <span>{review.replies} bình luận</span>
                </div>
                <div className="reviews-review-card__stat">
                  <span>🤝</span>
                  <span>{review.helpful_count} hữu ích</span>
                </div>
                <div className="reviews-review-card__stat">
                  <span>📣</span>
                  <span>{review.likes} tương tác</span>
                </div>
                <div className="reviews-review-card__stat">
                  <span>🚩</span>
                  <span>{review.reports_count || 0} báo cáo</span>
                </div>
              </div>

              <div className={"reviews-review-card__status " + statusClass}>
                {review.status === "published"
                  ? "✅ Đã xuất bản"
                  : review.status === "pending"
                  ? "⏳ Chờ duyệt"
                  : review.status === "hidden"
                  ? "🚫 Đã ẩn"
                  : review.status === "reported"
                  ? "🚩 Bị báo cáo"
                  : review.status}
              </div>
            </footer>

            {!!activeReactions.length && (
              <div className="reviews-review-card__meta" style={{ marginTop: 8 }}>
                {activeReactions.map(([key, emoji]) => (
                  <span key={key}>
                    {emoji} {review.reactions?.[key]}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default ReviewsList;
