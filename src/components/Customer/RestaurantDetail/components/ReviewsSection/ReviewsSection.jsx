import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { AuthContext } from "@/context/AuthContext";

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
        firstOfficialReply {
          id
          authorName
          content
          createdAt
        }
      }
    }
  }
`;



const REACT_REVIEW = gql`
  mutation ReactReview($id: ID!, $reaction: String!) {
    reactReview(id: $id, reaction: $reaction) { id likesCount reactions { like total } }
  }
`;

const HELPFUL_REVIEW = gql`
  mutation HelpfulReview($id: ID!) {
    incrementReviewHelpful(id: $id) { id helpfulCount }
  }
`;

const REPORT_REVIEW = gql`
  mutation ReportReview($id: ID!, $input: ReviewReportInput!) {
    reportReview(id: $id, input: $input) { id status reason }
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

const OfficialReply = ({ reply }) => {
  if (!reply) return null;
  return (
    <div className="review-official-replies">
      <div className="review-official-reply">
        <span className="review-official-badge">Phản hồi từ nhà hàng</span>
        <strong>{reply.authorName || "Nhà hàng"}</strong>
        <p>{reply.content}</p>
      </div>
    </div>
  );
};

const REVIEWS_PAGE_SIZE = 20;

const ReviewsSection = ({ restaurantId }) => {
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const [sortBy, setSortBy] = useState("newest");
  const [filterRating, setFilterRating] = useState("all");
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, title: "", content: "", staffId: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetail, setReportDetail] = useState("");
  const [reportedReviewIds, setReportedReviewIds] = useState(() => new Set());

  const minRating = filterRating === "all" ? undefined : Number(filterRating);

  const { data, loading, fetchMore } = useQuery(GET_RESTAURANT_REVIEWS, {
    variables: {
      restaurantId,
      minRating,
      maxRating: 5,
      limit: REVIEWS_PAGE_SIZE,
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
  const [reactReview] = useMutation(REACT_REVIEW);
  const [helpfulReview] = useMutation(HELPFUL_REVIEW);
  const [reportReview] = useMutation(REPORT_REVIEW);
  const [createReview, { loading: creatingReview }] = useMutation(CREATE_REVIEW, {
    refetchQueries: [
      { query: GET_RESTAURANT_REVIEWS, variables: { restaurantId, minRating: undefined, maxRating: 5, limit: REVIEWS_PAGE_SIZE, skip: 0 } },
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
      firstOfficialReply: review.firstOfficialReply || null,
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
  const totalReviews = Number(stats?.total || 0);
  const loadedReviewsTotal = Number(data?.reviews?.total || 0);
  const canLoadMore = reviews.length < loadedReviewsTotal;
  const hasReviews = totalReviews > 0;
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

  const requireReviewAuth = (actionName) => {
    if (isAuthenticated || user?.id) return true;
    setSubmitSuccess("");
    setSubmitError(`Vui lòng đăng nhập để ${actionName}.`);
    return false;
  };

  const handleReactReview = async (reviewId, reaction = "like") => {
    if (!requireReviewAuth("thích đánh giá")) return;
    try {
      setSubmitError("");
      await reactReview({ variables: { id: reviewId, reaction } });
    } catch (error) {
      setSubmitError(error?.message || "Không thể cập nhật tương tác đánh giá.");
    }
  };

  const handleHelpfulReview = async (reviewId) => {
    if (!requireReviewAuth("đánh dấu hữu ích")) return;
    try {
      setSubmitError("");
      await helpfulReview({ variables: { id: reviewId } });
    } catch (error) {
      setSubmitError(error?.message || "Không thể đánh dấu hữu ích.");
    }
  };

  const handleOpenReport = (review) => {
    if (reportedReviewIds.has(review.id)) {
      setSubmitSuccess("Bạn đã gửi báo cáo cho đánh giá này.");
      return;
    }
    if (!requireReviewAuth("báo cáo đánh giá")) return;
    setSubmitError("");
    setReportingReview(review);
  };

  const handleSubmitReport = async () => {
    if (!reportingReview?.id || !requireReviewAuth("báo cáo đánh giá")) return;
    try {
      setSubmitError("");
      await reportReview({ variables: { id: reportingReview.id, input: { reason: reportReason, detail: reportDetail } } });
      setReportedReviewIds((prev) => new Set([...prev, reportingReview.id]));
      setReportingReview(null);
      setReportDetail("");
      setSubmitSuccess("Đã gửi báo cáo đánh giá.");
    } catch (error) {
      setSubmitError(error?.message || "Không thể gửi báo cáo đánh giá.");
    }
  };

  const handleLoadMore = async () => {
    if (!canLoadMore) return;
    await fetchMore({
      variables: { skip: reviews.length, limit: REVIEWS_PAGE_SIZE },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.reviews) return prev;
        return {
          ...prev,
          reviews: {
            ...fetchMoreResult.reviews,
            items: [...(prev?.reviews?.items || []), ...(fetchMoreResult.reviews.items || [])],
          },
        };
      },
    });
  };

  const handleSubmitReview = async () => {
    setSubmitSuccess("");
    if (!newReview.content.trim()) {
      setSubmitError("Vui lòng nhập nội dung đánh giá.");
      return;
    }

    if (!isAuthenticated && !user?.id) {
      setSubmitError("Vui lòng đăng nhập để gửi đánh giá.");
      return;
    }

    try {
      setSubmitError("");
      const result = await createReview({
        variables: {
          input: {
            targetType: "restaurant",
            targetId: restaurantId,
            restaurantId,
            rating: Number(newReview.rating),
            title: newReview.title.trim(),
            content: newReview.content.trim(),
            staffId: newReview.staffId || null,
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
      setSubmitSuccess("Đánh giá đã gửi và đang chờ duyệt.");
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
    <div className="reviews-section tab-panel-shell">
      <div className="reviews-header">
        <h2 className="reviews-title">⭐ Đánh giá từ khách hàng</h2>
        <button
          className="btn btn--primary"
          onClick={() => {
            if (!isAuthenticated && !user?.id) {
              setSubmitError("Vui lòng đăng nhập để viết đánh giá.");
              setShowWriteReview(true);
              return;
            }
            setShowWriteReview(true);
          }}
        >
          ✍️ Viết đánh giá
        </button>
      </div>

      {(submitError || submitSuccess) && (
        <div className={`reviews-inline-message ${submitError ? "reviews-inline-message--error" : "reviews-inline-message--success"}`} role="status">
          {submitError || submitSuccess}
        </div>
      )}

      <div className="reviews-summary">
        <div className="rating-overview">
          <div className="rating-score">
            <span className={`score-number ${!hasReviews ? "score-number--empty" : ""}`}>
              {hasReviews ? averageRating : "—"}
            </span>
            <div className="score-stars">
              {hasReviews ? renderStars(Math.round(Number(averageRating))) : "☆☆☆☆☆"}
            </div>
            <span className="score-count">
              {hasReviews ? `(${totalReviews} đánh giá)` : "Chưa có đánh giá"}
            </span>
            {!hasReviews && (
              <p className="score-helper">Hãy là người đầu tiên chia sẻ trải nghiệm.</p>
            )}
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
          Hiển thị {filteredAndSortedReviews.length} / {loadedReviewsTotal || totalReviews} đánh giá
        </div>
      </div>

      <div className="reviews-list">
        {filteredAndSortedReviews.length === 0 ? (
          <div className="reviews-empty empty-state-card">
            <span className="empty-state-icon" aria-hidden="true">💬</span>
            <h3 className="empty-state-title">Chưa có đánh giá</h3>
            <p className="empty-state-description">Hãy là người đầu tiên chia sẻ trải nghiệm tại nhà hàng này.</p>
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
                  <button className="review-action" aria-label="Thích" onClick={() => handleReactReview(review.id, "like")}>
                    👍 {review.likes || 0}
                  </button>
                  <button className="review-action" aria-label="Hữu ích" onClick={() => handleHelpfulReview(review.id)}>
                    🤝 {review.helpful || 0}
                  </button>
                  <button className="review-action" aria-label="Bình luận">
                    💬 {review.replies || 0}
                  </button>
                  <button className="review-action" aria-label="Báo cáo" disabled={reportedReviewIds.has(review.id)} onClick={() => handleOpenReport(review)}>
                    {reportedReviewIds.has(review.id) ? "✅ Đã báo cáo" : "🚩 Báo cáo"}
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
                <OfficialReply reply={review.firstOfficialReply} />
              </div>
            </div>
          ))
        )}
      </div>

      {canLoadMore && (
        <div className="reviews-load-more">
          <button type="button" className="btn btn--secondary" onClick={handleLoadMore}>Xem thêm đánh giá</button>
        </div>
      )}

      {reportingReview && (
        <div className="review-modal-overlay" onClick={() => setReportingReview(null)}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header"><h3>Báo cáo đánh giá</h3><button onClick={() => setReportingReview(null)}>×</button></div>
            <div className="review-form">
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                <option value="spam">Spam/quảng cáo</option>
                <option value="abuse">Lạm dụng/quấy rối</option>
                <option value="offensive">Nội dung phản cảm</option>
                <option value="fake">Đánh giá giả mạo</option>
                <option value="privacy">Thông tin riêng tư</option>
                <option value="other">Khác</option>
              </select>
              <textarea rows={4} value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} placeholder="Mô tả thêm (không bắt buộc)" />
              <div className="review-modal-actions"><button className="btn btn--secondary" type="button" onClick={() => setReportingReview(null)}>Hủy</button><button className="btn btn--primary" onClick={handleSubmitReport}>Gửi báo cáo</button></div>
            </div>
          </div>
        </div>
      )}

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
                <div className="review-star-input" role="radiogroup" aria-label="Điểm đánh giá">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      role="radio"
                      aria-checked={Number(newReview.rating) === value}
                      aria-label={`${value} sao`}
                      className={value <= Number(newReview.rating) ? "active" : ""}
                      onClick={() => setNewReview((prev) => ({ ...prev, rating: value }))}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Tiêu đề</label>
                <input aria-label="Tiêu đề" value={newReview.title} onChange={(e) => setNewReview((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Nội dung đánh giá</label>
                <textarea aria-label="Nội dung đánh giá" rows={4} maxLength={1000} value={newReview.content} onChange={(e) => setNewReview((prev) => ({ ...prev, content: e.target.value }))} />
                <small>{newReview.content.length}/1000 ký tự</small>
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
