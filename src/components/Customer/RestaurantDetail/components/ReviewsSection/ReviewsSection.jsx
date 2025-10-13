import React, { useState, useEffect } from "react";

import "./ReviewsSection.scss";

const ReviewsSection = ({ restaurantId }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [filterRating, setFilterRating] = useState("all");
  const [showWriteReview, setShowWriteReview] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        // const reviewsData = await getReviewsByRestaurantId(restaurantId);
        // setReviews(reviewsData);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [restaurantId]);

  const filteredAndSortedReviews = React.useMemo(() => {
    let filtered = reviews;

    // Filter by rating
    if (filterRating !== "all") {
      filtered = filtered.filter(
        (review) => review.rating >= parseInt(filterRating)
      );
    }

    // Sort reviews
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case "oldest":
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "highest":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "lowest":
        filtered.sort((a, b) => a.rating - b.rating);
        break;
      default:
        break;
    }

    return filtered;
  }, [reviews, sortBy, filterRating]);

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => review.rating === rating).length,
    percentage:
      reviews.length > 0
        ? (
            (reviews.filter((review) => review.rating === rating).length /
              reviews.length) *
            100
          ).toFixed(0)
        : 0,
  }));

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`star ${index < rating ? "star--filled" : "star--empty"}`}
      >
        ⭐
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="reviews-section">
        <div className="reviews-loading">
          <div className="spinner"></div>
          <p>Đang tải đánh giá...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reviews-section">
      <div className="reviews-header">
        <h2 className="reviews-title">⭐ Đánh giá từ khách hàng</h2>
        <button
          className="btn btn--primary"
          onClick={() => setShowWriteReview(true)}
        >
          ✍️ Viết đánh giá
        </button>
      </div>

      {/* Reviews Summary */}
      <div className="reviews-summary">
        <div className="rating-overview">
          <div className="rating-score">
            <span className="score-number">{averageRating}</span>
            <div className="score-stars">
              {renderStars(Math.round(averageRating))}
            </div>
            <span className="score-count">({reviews.length} đánh giá)</span>
          </div>
        </div>

        <div className="rating-distribution">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="rating-bar">
              <span className="rating-label">{rating} sao</span>
              <div className="rating-progress">
                <div
                  className="rating-fill"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <span className="rating-count">({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="reviews-controls">
        <div className="reviews-filters">
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả đánh giá</option>
            <option value="5">5 sao</option>
            <option value="4">4+ sao</option>
            <option value="3">3+ sao</option>
            <option value="2">2+ sao</option>
            <option value="1">1+ sao</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="highest">Điểm cao nhất</option>
            <option value="lowest">Điểm thấp nhất</option>
          </select>
        </div>

        <div className="reviews-count">
          Hiển thị {filteredAndSortedReviews.length} / {reviews.length} đánh giá
        </div>
      </div>

      {/* Reviews List */}
      <div className="reviews-list">
        {filteredAndSortedReviews.length === 0 ? (
          <div className="reviews-empty">
            <span className="empty-icon">💬</span>
            <h3>Chưa có đánh giá nào</h3>
            <p>Hãy là người đầu tiên đánh giá nhà hàng này!</p>
          </div>
        ) : (
          filteredAndSortedReviews.map((review) => (
            <div key={review.id} className="review-item">
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="reviewer-avatar">
                    <img src={review.user.avatar} alt={review.user.name} />
                  </div>
                  <div className="reviewer-details">
                    <h4 className="reviewer-name">{review.user.name}</h4>
                    <div className="review-meta">
                      <div className="review-rating">
                        {renderStars(review.rating)}
                      </div>
                      <span className="review-date">
                        {formatDate(review.date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="review-actions">
                  <button className="review-action" aria-label="Thích">
                    👍 {review.likes || 0}
                  </button>
                  <button className="review-action" aria-label="Báo cáo">
                    🚩
                  </button>
                </div>
              </div>

              <div className="review-content">
                <p className="review-text">{review.comment}</p>

                {review.photos && review.photos.length > 0 && (
                  <div className="review-photos">
                    {review.photos.map((photo, index) => (
                      <div key={index} className="review-photo">
                        <img src={photo} alt={`Ảnh đánh giá ${index + 1}`} />
                      </div>
                    ))}
                  </div>
                )}

                {review.visitType && (
                  <div className="review-tags">
                    <span className="review-tag">
                      {review.visitType === "family" && "👨‍👩‍👧‍👦 Gia đình"}
                      {review.visitType === "couple" && "💑 Cặp đôi"}
                      {review.visitType === "friends" && "👥 Bạn bè"}
                      {review.visitType === "business" && "💼 Công việc"}
                      {review.visitType === "solo" && "🙋‍♂️ Một mình"}
                    </span>
                  </div>
                )}
              </div>

              {review.response && (
                <div className="restaurant-response">
                  <div className="response-header">
                    <span className="response-icon">🏪</span>
                    <span className="response-label">Phản hồi từ nhà hàng</span>
                    <span className="response-date">
                      {formatDate(review.response.date)}
                    </span>
                  </div>
                  <p className="response-text">{review.response.text}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Write Review Modal */}
      {showWriteReview && (
        <div
          className="review-modal-overlay"
          onClick={() => setShowWriteReview(false)}
        >
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✍️ Viết đánh giá</h3>
              <button
                className="modal-close"
                onClick={() => setShowWriteReview(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <p>Tính năng viết đánh giá sẽ được cập nhật sớm!</p>
              <button
                className="btn btn--primary"
                onClick={() => setShowWriteReview(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
