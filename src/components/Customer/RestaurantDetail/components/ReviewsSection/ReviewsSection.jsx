import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import LoadingSpinner from "@/components/common/LoadingSpinner";

import "./ReviewsSection.scss";

const GET_RESTAURANT_REVIEWS = gql`
  query GetRestaurantReviews(
    $restaurantId: ID!
    $minRating: Int
    $maxRating: Int
    $limit: Int = 100
    $skip: Int = 0
  ) {
    reviews(
      restaurantId: $restaurantId
      targetType: "restaurant"
      status: "published"
      minRating: $minRating
      maxRating: $maxRating
      limit: $limit
      skip: $skip
    ) {
      total
      items {
        id
        customerName
        customerAvatar
        rating
        title
        content
        images
        tags
        createdAt
        likesCount
        helpfulCount
        commentsCount
        verifiedPurchase
      }
    }
  }
`;



const CREATE_REVIEW = gql`
  mutation CreateReview($input: ReviewInput!) {
    createReview(input: $input) {
      id
    }
  }
`;

const GET_PUBLIC_RESTAURANT_STAFF = gql`
  query GetPublicRestaurantStaff($restaurantId: ID!) {
    publicRestaurantStaff(restaurantId: $restaurantId) {
      id
      fullName
      positionTitle
      avatarUrl
    }
  }
`;

const GET_RESTAURANT_REVIEW_STATS = gql`
  query GetRestaurantReviewStats($restaurantId: ID!) {
    reviewStats(restaurantId: $restaurantId, targetType: "restaurant") {
      total
      avgRating
      pending
      ratingBreakdown
    }
  }
`;

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const ReviewsSection = ({ restaurantId }) => {
  const [sortBy, setSortBy] = useState("newest");
  const [filterRating, setFilterRating] = useState("all");
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, title: "", content: "", staffId: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const minRating = filterRating === "all" ? undefined : Number(filterRating);

  const { data, loading } = useQuery(GET_RESTAURANT_REVIEWS, {
    variables: {
      restaurantId,
      minRating,
      maxRating: 5,
      limit: 100,
      skip: 0,
    },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const { data: statsData } = useQuery(GET_RESTAURANT_REVIEW_STATS, {
    variables: { restaurantId },
    skip: !restaurantId,
  });

  const { data: staffData } = useQuery(GET_PUBLIC_RESTAURANT_STAFF, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-first",
  });
  const [createReview, { loading: creatingReview }] = useMutation(CREATE_REVIEW, {
    refetchQueries: [
      { query: GET_RESTAURANT_REVIEWS, variables: { restaurantId, minRating: undefined, maxRating: 5, limit: 100, skip: 0 } },
      { query: GET_RESTAURANT_REVIEW_STATS, variables: { restaurantId } },
    ],
    awaitRefetchQueries: true,
  });

  const reviews = useMemo(() => {
    return (data?.reviews?.items || []).map((review) => ({
      id: review.id,
      rating: review.rating,
      date: review.createdAt,
      comment: review.content,
      title: review.title || "",
      likes: review.likesCount || 0,
      helpful: review.helpfulCount || 0,
      replies: review.commentsCount || 0,
      verifiedPurchase: Boolean(review.verifiedPurchase),
      photos: parseJsonArray(review.images),
      tags: parseJsonArray(review.tags),
      user: {
        name: review.customerName,
        avatar: review.customerAvatar || "/default-avatar.png",
      },
    }));
  }, [data]);

  const filteredAndSortedReviews = useMemo(() => {
    const filtered = [...reviews];

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
  }, [reviews, sortBy]);

  const stats = statsData?.reviewStats;
  const averageRating = Number(stats?.avgRating || 0).toFixed(1);

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = Number(stats?.ratingBreakdown?.[rating] || 0);
    const total = Number(stats?.total || 0);
    return {
      rating,
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(0) : 0,
    };
  });

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

  const staffOptions = useMemo(
    () => staffData?.publicRestaurantStaff || [],
    [staffData],
  );

  const handleSubmitReview = async () => {
    setSubmitSuccess("");
    if (!newReview.content.trim()) {
      setSubmitError("Vui lòng nhập nội dung đánh giá.");
      return;
    }

    const selectedStaff = staffOptions.find((staff) => staff.id === newReview.staffId);

    try {
      setSubmitError("");
      const result = await createReview({
        variables: {
          input: {
            targetType: "restaurant",
            targetId: restaurantId,
            restaurantId,
            customerName: "Khách hàng",
            rating: Number(newReview.rating),
            title: newReview.title.trim(),
            content: newReview.content.trim(),
            staffId: selectedStaff?.id || null,
            staffName: selectedStaff?.fullName || "",
          },
        },
      });

      if (result?.errors?.length) {
        setSubmitError(result.errors[0]?.message || "Không thể gửi đánh giá.");
        return;
      }

      if (!result?.data?.createReview?.id) {
        setSubmitError("Không thể gửi đánh giá.");
        return;
      }

      setNewReview({ rating: 5, title: "", content: "", staffId: "" });
      setSubmitSuccess("Đánh giá đã được gửi và đang chờ duyệt.");
    } catch (error) {
      setSubmitError(error.message || "Không thể gửi đánh giá.");
    }
  };

  if (loading) {
    return (
      <div className="reviews-section">
        <div className="reviews-loading">
          <LoadingSpinner size="large" />
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

      <div className="reviews-summary">
        <div className="rating-overview">
          <div className="rating-score">
            <span className="score-number">{averageRating}</span>
            <div className="score-stars">
              {renderStars(Math.round(Number(averageRating)))}
            </div>
            <span className="score-count">({stats?.total || 0} đánh giá)</span>
          </div>
        </div>

        <div className="rating-distribution">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="rating-bar">
              <span className="rating-label">{rating} sao</span>
              <div className="rating-progress">
                <div className="rating-fill" style={{ width: `${percentage}%` }}></div>
              </div>
              <span className="rating-count">({count})</span>
            </div>
          ))}
        </div>
      </div>

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
          Hiển thị {filteredAndSortedReviews.length} / {stats?.total || 0} đánh giá
        </div>
      </div>

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
                      <div className="review-rating">{renderStars(review.rating)}</div>
                      <span className="review-date">{formatDate(review.date)}</span>
                      {review.verifiedPurchase && (
                        <span className="review-verified">✓ Đã xác thực</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="review-actions">
                  <button className="review-action" aria-label="Thích">
                    👍 {review.likes || 0}
                  </button>
                  <button className="review-action" aria-label="Hữu ích">
                    🤝 {review.helpful || 0}
                  </button>
                  <button className="review-action" aria-label="Bình luận">
                    💬 {review.replies || 0}
                  </button>
                </div>
              </div>

              <div className="review-content">
                {review.title && <h4 className="review-title">{review.title}</h4>}
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

                {review.tags.length > 0 && (
                  <div className="review-tags">
                    {review.tags.map((tag) => (
                      <span key={tag} className="review-tag">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

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
              <div className="form-group">
                <label>Điểm đánh giá</label>
                <select aria-label="Điểm đánh giá" value={newReview.rating} onChange={(e) => setNewReview((prev) => ({ ...prev, rating: Number(e.target.value) }))}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tiêu đề</label>
                <input aria-label="Tiêu đề" value={newReview.title} onChange={(e) => setNewReview((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Nội dung đánh giá</label>
                <textarea aria-label="Nội dung đánh giá" rows={4} value={newReview.content} onChange={(e) => setNewReview((prev) => ({ ...prev, content: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Nhân viên phục vụ (không bắt buộc)</label>
                <select aria-label="Nhân viên phục vụ (không bắt buộc)" value={newReview.staffId} onChange={(e) => setNewReview((prev) => ({ ...prev, staffId: e.target.value }))}>
                  <option value="">Chọn nhân viên nếu muốn đánh giá trực tiếp</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>{staff.fullName}</option>
                  ))}
                </select>
                <small>Đánh giá này chỉ là dữ liệu tham khảo cho quản lý khi đánh giá hiệu suất.</small>
              </div>
              {submitError ? <p style={{ color: "#dc2626" }}>{submitError}</p> : null}
              {submitSuccess ? <p style={{ color: "#15803d" }}>{submitSuccess}</p> : null}
              <button className="btn btn--primary" disabled={creatingReview} onClick={handleSubmitReview}>
                {creatingReview ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;
