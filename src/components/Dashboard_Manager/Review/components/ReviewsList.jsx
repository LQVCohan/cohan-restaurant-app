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
    .map((part) => part[0])
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
  ["like", "Thích"],
  ["love", "Yêu thích"],
  ["care", "Quan tâm"],
  ["haha", "Vui vẻ"],
  ["wow", "Ấn tượng"],
  ["sad", "Không hài lòng"],
  ["angry", "Bức xúc"],
];

const serviceTargetLabels = {
  service_quality: "Chất lượng phục vụ",
  serving_speed: "Tốc độ phục vụ",
  cleanliness: "Vệ sinh không gian",
  payment: "Thanh toán",
  booking: "Đặt bàn",
  delivery: "Giao hàng",
};

const getTargetLabel = (review) =>
  serviceTargetLabels[review.target_name] ||
  serviceTargetLabels[review.target_id] ||
  review.target_name ||
  "Chưa phân loại";

const getStatusLabel = (status) => {
  const labels = {
    published: "Đang hiển thị",
    pending: "Chờ kiểm tra",
    hidden: "Đã ẩn",
    reported: "Đang xem xét",
    rejected: "Đã từ chối",
  };
  return labels[status] || status || "Chưa rõ";
};

const ReviewsList = ({
  isLoading,
  reviews,
  currentTab,
  onView,
  onEdit,
  permissions = {},
  emptyType,
}) => {
  if (isLoading) {
    return (
      <div className="reviews-loading" aria-label="Đang tải đánh giá">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="reviews-loading__skeleton" key={index}>
            <span />
            <strong />
            <p />
            <p />
          </div>
        ))}
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <EmptyState
        type={
          emptyType ||
          (currentTab === "service"
            ? "service"
            : currentTab === "reported"
              ? "reported"
              : "default")
        }
      />
    );
  }

  return (
    <div className="reviews-list">
      {reviews.map((review) => {
        const images = parseImages(review.images);
        const tags = parseTags(review.tags);
        const activeReactions = reactionMeta.filter(
          ([key]) => Number(review.reactions?.[key] || 0) > 0,
        );

        const statusClass =
          review.status === "published"
            ? "reviews-review-card__status--published"
            : review.status === "pending"
              ? "reviews-review-card__status--pending"
              : review.status === "hidden"
                ? "reviews-review-card__status--hidden"
                : review.status === "reported"
                  ? "reviews-review-card__status--reported"
                  : review.status === "rejected"
                    ? "reviews-review-card__status--rejected"
                    : "";

        const numericRating = Number(review.rating || 0);
        const needsReply =
          ["published", "reported"].includes(review.status) &&
          numericRating <= 2 &&
          !review.first_official_reply;
        const isHighRisk =
          Number(review.reports_count || 0) >= 3 ||
          (numericRating <= 2 && Number(review.reports_count || 0) > 0);
        const sentimentTone =
          numericRating >= 4
            ? "Tích cực"
            : numericRating === 3
              ? "Trung lập"
              : "Cần chú ý";

        return (
          <article
            key={review.id}
            className={`reviews-review-card ${numericRating <= 2 ? "reviews-review-card--negative" : ""} ${isHighRisk ? "reviews-review-card--high-risk" : ""}`}
          >
            <div className="reviews-review-card__header">
              <div className="reviews-review-card__reviewer">
                <div className="reviews-review-card__avatar">
                  {review.customer_avatar ? (
                    <img
                      src={review.customer_avatar}
                      alt={review.customer_name || "Khách hàng"}
                      width="44"
                      height="44"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    getInitials(review.customer_name)
                  )}
                </div>
                <div>
                  <div className="reviews-review-card__name">
                    {review.customer_name || "Khách hàng"}
                  </div>
                  <div className="reviews-review-card__meta">
                    <span>{review.location}</span>
                    <span aria-hidden="true">•</span>
                    <span>{formatDate(review.created_at)}</span>
                    {review.verified_purchase && (
                      <span className="reviews-review-card__verified">
                        Đã xác thực
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="reviews-review-card__actions">
                <button
                  type="button"
                  className="reviews-review-card__action-btn"
                  onClick={() => onView(review)}
                >
                  Xem chi tiết
                </button>
                {permissions.canModerate &&
                  review.status !== "reported" &&
                  Number(review.reports_count || 0) > 0 && (
                    <button
                      type="button"
                      className="reviews-review-card__action-btn"
                      onClick={() => onEdit(review, "reported")}
                    >
                      Chuyển sang xem xét
                    </button>
                  )}
                {permissions.canAdminModerate && review.status !== "hidden" && (
                  <button
                    type="button"
                    className="reviews-review-card__action-btn"
                    onClick={() => onEdit(review, "hidden")}
                  >
                    Ẩn đánh giá
                  </button>
                )}
              </div>
            </div>

            <div className="reviews-review-card__rating-row">
              <div className="reviews-review-card__stars" aria-label={`${review.rating} trên 5 sao`}>
                <span className="star" aria-hidden="true">
                  {getStarRating(review.rating)}
                </span>
              </div>
              <span className="reviews-review-card__rating-number">
                {review.rating}/5
              </span>
              <span className="reviews-review-card__target">
                {getTargetLabel(review)}
              </span>
              <span
                className={`reviews-review-card__sentiment reviews-review-card__sentiment--${numericRating >= 4 ? "positive" : numericRating === 3 ? "neutral" : "negative"}`}
              >
                {sentimentTone}
              </span>
              {review.restaurant_name && (
                <span className="reviews-review-card__restaurant">
                  {review.restaurant_name}
                </span>
              )}
              {needsReply && (
                <span className="reviews-review-card__needs-reply">
                  Cần phản hồi
                </span>
              )}
              {isHighRisk && (
                <span className="reviews-review-card__high-risk">
                  Ưu tiên xử lý
                </span>
              )}
            </div>

            <div className="reviews-review-card__content">
              <h3 className="reviews-review-card__title">{review.title}</h3>
              <p className="reviews-review-card__text">{review.content}</p>
              <p className="reviews-review-card__text">
                <strong>Nhân viên được nhắc đến:</strong>{" "}
                {review.staff_name || "Chưa gắn nhân viên"}
              </p>
              <p className="reviews-review-card__text reviews-review-card__text--note">
                Đánh giá này giúp nhà hàng cải thiện trải nghiệm phục vụ trong
                những lần tiếp theo.
              </p>

              {images.length > 0 && (
                <div className="reviews-review-card__images">
                  {images.map((image, index) => (
                    <img
                      key={image}
                      src={image}
                      alt={`Ảnh đánh giá ${index + 1}`}
                      className="reviews-review-card__image"
                      width="160"
                      height="120"
                      loading="lazy"
                      decoding="async"
                    />
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
                  <span>{review.replies} phản hồi</span>
                </div>
                <div className="reviews-review-card__stat">
                  <span>{review.helpful_count} hữu ích</span>
                </div>
                <div className="reviews-review-card__stat">
                  <span>{review.likes} tương tác</span>
                </div>
                <div className="reviews-review-card__stat">
                  <span>{review.reports_count || 0} báo cáo</span>
                </div>
              </div>

              <div className={`reviews-review-card__status ${statusClass}`}>
                {getStatusLabel(review.status)}
              </div>
            </footer>

            {!!activeReactions.length && (
              <div className="reviews-review-card__meta reviews-review-card__meta--reactions">
                {activeReactions.map(([key, label]) => (
                  <span key={key}>
                    {label}: {review.reactions?.[key]}
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
