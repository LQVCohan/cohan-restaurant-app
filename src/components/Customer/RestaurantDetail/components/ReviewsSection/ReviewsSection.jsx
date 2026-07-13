import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { AuthContext } from "@/context/AuthContext";
import { toUserFacingErrorMessage } from "@/utils/userFacingError";

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
        status
        reportsCount
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
    reactReview(id: $id, reaction: $reaction) {
      id
      likesCount
      reactions {
        like
        total
      }
    }
  }
`;

const HELPFUL_REVIEW = gql`
  mutation HelpfulReview($id: ID!) {
    incrementReviewHelpful(id: $id) {
      id
      helpfulCount
    }
  }
`;

const REPORT_REVIEW = gql`
  mutation ReportReview($id: ID!, $input: ReviewReportInput!) {
    reportReview(id: $id, input: $input) {
      id
      status
      reason
    }
  }
`;

const CREATE_REVIEW = gql`
  mutation CreateReview($input: ReviewInput!) {
    createReview(input: $input) {
      id
      status
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

const REVIEWS_PAGE_SIZE = 20;
const MIN_REVIEW_CONTENT_LENGTH = 10;
const MAX_REVIEW_CONTENT_LENGTH = 2000;
const MAX_REVIEW_TITLE_LENGTH = 120;

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getInitials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "KH";

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

const ReviewsSection = ({ restaurantId }) => {
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const [sortBy, setSortBy] = useState("newest");
  const [filterRating, setFilterRating] = useState("all");
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: "",
    content: "",
    staffId: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetail, setReportDetail] = useState("");
  const [reportedReviewIds, setReportedReviewIds] = useState(() => new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const minRating =
    filterRating === "all" ? undefined : Number(filterRating);
  const reviewVariables = useMemo(
    () => ({
      restaurantId,
      minRating,
      maxRating: 5,
      limit: REVIEWS_PAGE_SIZE,
      skip: 0,
    }),
    [minRating, restaurantId],
  );

  const {
    data,
    loading,
    error: reviewsError,
    fetchMore,
    refetch: refetchReviews,
  } = useQuery(GET_RESTAURANT_REVIEWS, {
    variables: reviewVariables,
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: statsData,
    refetch: refetchStats,
  } = useQuery(GET_RESTAURANT_REVIEW_STATS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const { data: staffData } = useQuery(GET_PUBLIC_RESTAURANT_STAFF, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-first",
  });

  const [reactReview] = useMutation(REACT_REVIEW);
  const [helpfulReview] = useMutation(HELPFUL_REVIEW);
  const [reportReview, { loading: reporting }] = useMutation(REPORT_REVIEW);
  const [createReview, { loading: creatingReview }] = useMutation(CREATE_REVIEW);

  useEffect(() => {
    if (!reportingReview && !showWriteReview) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setReportingReview(null);
      setShowWriteReview(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reportingReview, showWriteReview]);

  const reviews = useMemo(
    () =>
      (data?.reviews?.items || []).map((review) => ({
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
        status: review.status,
        reportsCount: review.reportsCount || 0,
        photos: parseJsonArray(review.images),
        tags: parseJsonArray(review.tags),
        user: {
          name: review.customerName || "Khách hàng",
          avatar: review.customerAvatar || "",
        },
      })),
    [data],
  );

  const filteredAndSortedReviews = useMemo(() => {
    const nextReviews = [...reviews];
    switch (sortBy) {
      case "oldest":
        nextReviews.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "highest":
        nextReviews.sort((a, b) => b.rating - a.rating);
        break;
      case "lowest":
        nextReviews.sort((a, b) => a.rating - b.rating);
        break;
      case "newest":
      default:
        nextReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
    }
    return nextReviews;
  }, [reviews, sortBy]);

  const stats = statsData?.reviewStats;
  const totalReviews = Number(stats?.total || 0);
  const loadedReviewsTotal = Number(data?.reviews?.total || 0);
  const canLoadMore = reviews.length < loadedReviewsTotal;
  const hasReviews = totalReviews > 0;
  const averageRating = Number(stats?.avgRating || 0).toFixed(1);
  const staffOptions = useMemo(
    () => staffData?.publicRestaurantStaff || [],
    [staffData],
  );

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = Number(stats?.ratingBreakdown?.[rating] || 0);
    const total = Number(stats?.total || 0);
    return {
      rating,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Chưa rõ ngày";
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`star ${index < rating ? "star--filled" : "star--empty"}`}
        aria-hidden="true"
      >
        ★
      </span>
    ));

  const requireReviewAuth = (actionName) => {
    if (isAuthenticated || user?.id) return true;
    setSubmitSuccess("");
    setSubmitError(`Vui lòng đăng nhập để ${actionName}.`);
    return false;
  };

  const refreshReviewSurface = async () => {
    await Promise.all([
      refetchReviews?.(),
      refetchStats?.(),
    ]);
  };

  const handleReactReview = async (reviewId, reaction = "like") => {
    if (!requireReviewAuth("thích đánh giá")) return;
    try {
      setSubmitError("");
      await reactReview({ variables: { id: reviewId, reaction } });
    } catch (error) {
      setSubmitError(
        toUserFacingErrorMessage(error, "Không thể cập nhật tương tác đánh giá."),
      );
    }
  };

  const handleHelpfulReview = async (reviewId) => {
    if (!requireReviewAuth("đánh dấu hữu ích")) return;
    try {
      setSubmitError("");
      await helpfulReview({ variables: { id: reviewId } });
    } catch (error) {
      setSubmitError(toUserFacingErrorMessage(error, "Không thể đánh dấu hữu ích."));
    }
  };

  const handleOpenReport = (review) => {
    if (reportedReviewIds.has(review.id)) {
      setSubmitSuccess("Bạn đã gửi báo cáo cho đánh giá này.");
      return;
    }
    if (!requireReviewAuth("báo cáo đánh giá")) return;
    setSubmitError("");
    setSubmitSuccess("");
    setReportingReview(review);
  };

  const handleSubmitReport = async () => {
    if (
      !reportingReview?.id ||
      reporting ||
      !requireReviewAuth("báo cáo đánh giá")
    ) {
      return;
    }

    try {
      setSubmitError("");
      const result = await reportReview({
        variables: {
          id: reportingReview.id,
          input: {
            reason: reportReason,
            detail: reportDetail.trim(),
          },
        },
      });
      if (!result?.data?.reportReview?.id) {
        throw new Error("Backend không xác nhận báo cáo vừa gửi.");
      }
      setReportedReviewIds(
        (current) => new Set([...current, reportingReview.id]),
      );
      setReportingReview(null);
      setReportDetail("");
      setSubmitSuccess("Đã gửi báo cáo đánh giá.");
      await refreshReviewSurface();
    } catch (error) {
      setSubmitError(toUserFacingErrorMessage(error, "Không thể gửi báo cáo đánh giá."));
    }
  };

  const handleLoadMore = async () => {
    if (!canLoadMore || isLoadingMore || !fetchMore) return;
    setIsLoadingMore(true);
    setSubmitError("");
    try {
      await fetchMore({
        variables: { skip: reviews.length, limit: REVIEWS_PAGE_SIZE },
        updateQuery: (previous, { fetchMoreResult }) => {
          if (!fetchMoreResult?.reviews) return previous;
          const existingItems = previous?.reviews?.items || [];
          const existingIds = new Set(existingItems.map((item) => item.id));
          const incomingItems = (fetchMoreResult.reviews.items || []).filter(
            (item) => !existingIds.has(item.id),
          );
          return {
            ...previous,
            reviews: {
              ...fetchMoreResult.reviews,
              items: [...existingItems, ...incomingItems],
            },
          };
        },
      });
    } catch (error) {
      setSubmitError(toUserFacingErrorMessage(error, "Không thể tải thêm đánh giá."));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmitSuccess("");
    const content = newReview.content.trim();
    const title = newReview.title.trim();

    if (!isAuthenticated && !user?.id) {
      setSubmitError("Vui lòng đăng nhập để gửi đánh giá.");
      return;
    }
    if (content.length < MIN_REVIEW_CONTENT_LENGTH) {
      setSubmitError(
        `Nội dung đánh giá phải có ít nhất ${MIN_REVIEW_CONTENT_LENGTH} ký tự.`,
      );
      return;
    }
    if (content.length > MAX_REVIEW_CONTENT_LENGTH) {
      setSubmitError(
        `Nội dung đánh giá tối đa ${MAX_REVIEW_CONTENT_LENGTH} ký tự.`,
      );
      return;
    }
    if (title.length > MAX_REVIEW_TITLE_LENGTH) {
      setSubmitError(
        `Tiêu đề đánh giá tối đa ${MAX_REVIEW_TITLE_LENGTH} ký tự.`,
      );
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
            title,
            content,
            staffId: newReview.staffId || null,
          },
        },
      });

      if (result?.errors?.length) {
        throw new Error(result.errors[0]?.message || "Không thể gửi đánh giá.");
      }
      if (!result?.data?.createReview?.id) {
        throw new Error("Không thể gửi đánh giá.");
      }

      setNewReview({ rating: 5, title: "", content: "", staffId: "" });
      setShowWriteReview(false);
      setSubmitSuccess(
        "Đánh giá của bạn đã được đăng. Cảm ơn bạn đã chia sẻ trải nghiệm.",
      );
      await refreshReviewSurface();
    } catch (error) {
      setSubmitError(toUserFacingErrorMessage(error, "Không thể gửi đánh giá."));
    }
  };

  if (loading && !data?.reviews) {
    return (
      <div className="reviews-section">
        <div className="reviews-loading" role="status" aria-live="polite">
          <LoadingSpinner size="large" />
          <p>Đang tải đánh giá...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reviews-section tab-panel-shell">
      <div className="reviews-header">
        <h2 className="reviews-title">Đánh giá từ khách hàng</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setSubmitSuccess("");
            if (!isAuthenticated && !user?.id) {
              setSubmitError("Vui lòng đăng nhập để viết đánh giá.");
            } else {
              setSubmitError("");
            }
            setShowWriteReview(true);
          }}
        >
          Viết đánh giá
        </button>
      </div>

      {(submitError || submitSuccess) && (
        <div
          className={`reviews-inline-message ${submitError ? "reviews-inline-message--error" : "reviews-inline-message--success"}`}
          role={submitError ? "alert" : "status"}
          aria-live="polite"
        >
          {submitError || submitSuccess}
        </div>
      )}

      {reviewsError && (
        <div className="reviews-inline-message reviews-inline-message--error" role="alert">
          <span>Chưa thể tải đánh giá. Vui lòng thử lại.</span>
          <button type="button" className="btn btn--secondary" onClick={() => refetchReviews?.()}>
            Thử lại
          </button>
        </div>
      )}

      <div className="reviews-summary">
        <div className="rating-overview">
          <div className="rating-score">
            <span
              className={`score-number ${!hasReviews ? "score-number--empty" : ""}`}
            >
              {hasReviews ? averageRating : "—"}
            </span>
            <div
              className="score-stars"
              aria-label={hasReviews ? `${averageRating} trên 5 sao` : "Chưa có điểm đánh giá"}
            >
              {hasReviews ? (
                renderStars(Math.round(Number(averageRating)))
              ) : (
                <span aria-hidden="true">☆☆☆☆☆</span>
              )}
            </div>
            <span className="score-count">
              {hasReviews ? `(${totalReviews} đánh giá)` : "Chưa có đánh giá"}
            </span>
            {!hasReviews && (
              <p className="score-helper">
                Hãy là người đầu tiên chia sẻ trải nghiệm.
              </p>
            )}
          </div>
        </div>

        <div className="rating-distribution">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="rating-bar">
              <span className="rating-label">{rating} sao</span>
              <div
                className="rating-progress"
                role="progressbar"
                aria-label={`${rating} sao`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={percentage}
              >
                <div
                  className="rating-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="rating-count">({count})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="reviews-controls">
        <div className="reviews-filters">
          <label>
            <span className="sr-only">Lọc theo số sao</span>
            <select
              value={filterRating}
              onChange={(event) => setFilterRating(event.target.value)}
              className="filter-select"
              aria-label="Lọc theo số sao"
            >
              <option value="all">Tất cả đánh giá</option>
              <option value="5">5 sao</option>
              <option value="4">4+ sao</option>
              <option value="3">3+ sao</option>
              <option value="2">2+ sao</option>
              <option value="1">1+ sao</option>
            </select>
          </label>

          <label>
            <span className="sr-only">Sắp xếp đánh giá</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="sort-select"
              aria-label="Sắp xếp đánh giá"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="highest">Điểm cao nhất</option>
              <option value="lowest">Điểm thấp nhất</option>
            </select>
          </label>
        </div>

        <div className="reviews-count" aria-live="polite">
          Hiển thị {filteredAndSortedReviews.length} /{" "}
          {loadedReviewsTotal || totalReviews} đánh giá
        </div>
      </div>

      <div className="reviews-list">
        {filteredAndSortedReviews.length === 0 ? (
          <div className="reviews-empty empty-state-card">
            <span className="empty-state-icon" aria-hidden="true">
              💬
            </span>
            <h3 className="empty-state-title">Chưa có đánh giá</h3>
            <p className="empty-state-description">
              Hãy là người đầu tiên chia sẻ trải nghiệm tại nhà hàng này.
            </p>
          </div>
        ) : (
          filteredAndSortedReviews.map((review) => (
            <article key={review.id} className="review-item">
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="reviewer-avatar">
                    {review.user.avatar ? (
                      <img
                        src={review.user.avatar}
                        alt={review.user.name}
                        width="48"
                        height="48"
                        loading="lazy"
                        decoding="async"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "/cohan_logo_icon.svg";
                          }}
                      />
                    ) : (
                      <span aria-label={review.user.name}>
                        {getInitials(review.user.name)}
                      </span>
                    )}
                  </div>
                  <div className="reviewer-details">
                    <h4 className="reviewer-name">{review.user.name}</h4>
                    <div className="review-meta">
                      <div
                        className="review-rating"
                        aria-label={`${review.rating} trên 5 sao`}
                      >
                        {renderStars(review.rating)}
                      </div>
                      <span className="review-date">
                        {formatDate(review.date)}
                      </span>
                      {review.verifiedPurchase && (
                        <span className="review-verified">✓ Đã xác thực</span>
                      )}
                      {review.status === "reported" && (
                        <span className="review-verified">
                          Đang được xem xét
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="review-actions">
                  <button
                    type="button"
                    className="review-action"
                    aria-label={`Thích đánh giá của ${review.user.name}`}
                    onClick={() => handleReactReview(review.id, "like")}
                  >
                    👍 {review.likes || 0}
                  </button>
                  <button
                    type="button"
                    className="review-action"
                    aria-label={`Đánh dấu đánh giá của ${review.user.name} là hữu ích`}
                    onClick={() => handleHelpfulReview(review.id)}
                  >
                    🤝 {review.helpful || 0}
                  </button>
                  <span
                    className="review-action review-action--static"
                    aria-label={`${review.replies || 0} phản hồi`}
                  >
                    💬 {review.replies || 0}
                  </span>
                  <button
                    type="button"
                    className="review-action"
                    aria-label={`Báo cáo đánh giá của ${review.user.name}`}
                    disabled={reportedReviewIds.has(review.id)}
                    onClick={() => handleOpenReport(review)}
                  >
                    {reportedReviewIds.has(review.id)
                      ? "Đã báo cáo"
                      : "Báo cáo"}
                  </button>
                </div>
              </div>

              <div className="review-content">
                {review.title && (
                  <h4 className="review-title">{review.title}</h4>
                )}
                <p className="review-text">{review.comment}</p>

                {review.photos.length > 0 && (
                  <div className="review-photos">
                    {review.photos.map((photo, index) => (
                      <div key={photo} className="review-photo">
                        <img
                          src={photo}
                          alt={`Ảnh đánh giá ${index + 1}`}
                          width="180"
                          height="135"
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "/cohan_logo_icon.svg";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {review.tags.length > 0 && (
                  <div className="review-tags">
                    {review.tags.map((tag) => (
                      <span key={tag} className="review-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <OfficialReply reply={review.firstOfficialReply} />
              </div>
            </article>
          ))
        )}
      </div>

      {canLoadMore && (
        <div className="reviews-load-more">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Đang tải..." : "Xem thêm đánh giá"}
          </button>
        </div>
      )}

      {reportingReview && (
        <div
          className="review-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reporting) {
              setReportingReview(null);
            }
          }}
        >
          <div
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-review-title"
          >
            <div className="review-modal-header">
              <h3 id="report-review-title">Báo cáo đánh giá</h3>
              <button
                type="button"
                onClick={() => setReportingReview(null)}
                aria-label="Đóng hộp báo cáo đánh giá"
                disabled={reporting}
              >
                ×
              </button>
            </div>
            <div className="review-form">
              <label htmlFor="review-report-reason">Lý do báo cáo</label>
              <select
                id="review-report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                <option value="spam">Spam/quảng cáo</option>
                <option value="abuse">Lạm dụng/quấy rối</option>
                <option value="offensive">Nội dung phản cảm</option>
                <option value="fake">Đánh giá giả mạo</option>
                <option value="privacy">Thông tin riêng tư</option>
                <option value="other">Khác</option>
              </select>
              <label htmlFor="review-report-detail">
                Mô tả thêm <span>(không bắt buộc)</span>
              </label>
              <textarea
                id="review-report-detail"
                rows={4}
                maxLength={1000}
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                placeholder="Nêu rõ vấn đề để nhà hàng kiểm tra chính xác hơn"
              />
              <small>{reportDetail.length}/1000 ký tự</small>
              <div className="review-modal-actions">
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => setReportingReview(null)}
                  disabled={reporting}
                >
                  Hủy
                </button>
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={reporting}
                >
                  {reporting ? "Đang gửi..." : "Gửi báo cáo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWriteReview && (
        <div
          className="review-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingReview) {
              setShowWriteReview(false);
            }
          }}
        >
          <div
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="write-review-title"
          >
            <div className="modal-header">
              <h3 id="write-review-title">Viết đánh giá</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowWriteReview(false)}
                aria-label="Đóng hộp viết đánh giá"
                disabled={creatingReview}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <span className="form-label">Điểm đánh giá</span>
                <div
                  className="review-star-input"
                  role="radiogroup"
                  aria-label="Điểm đánh giá"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      role="radio"
                      aria-checked={Number(newReview.rating) === value}
                      aria-label={`${value} sao`}
                      className={
                        value <= Number(newReview.rating) ? "active" : ""
                      }
                      onClick={() =>
                        setNewReview((current) => ({
                          ...current,
                          rating: value,
                        }))
                      }
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="review-title-input">Tiêu đề</label>
                <input
                  id="review-title-input"
                  aria-label="Tiêu đề"
                  maxLength={MAX_REVIEW_TITLE_LENGTH}
                  value={newReview.title}
                  onChange={(event) =>
                    setNewReview((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <small>
                  {newReview.title.length}/{MAX_REVIEW_TITLE_LENGTH} ký tự
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="review-content-input">Nội dung đánh giá</label>
                <textarea
                  id="review-content-input"
                  aria-label="Nội dung đánh giá"
                  rows={5}
                  minLength={MIN_REVIEW_CONTENT_LENGTH}
                  maxLength={MAX_REVIEW_CONTENT_LENGTH}
                  value={newReview.content}
                  onChange={(event) => {
                    setSubmitError("");
                    setNewReview((current) => ({
                      ...current,
                      content: event.target.value,
                    }));
                  }}
                />
                <small>
                  Tối thiểu {MIN_REVIEW_CONTENT_LENGTH} ký tự ·{" "}
                  {newReview.content.length}/{MAX_REVIEW_CONTENT_LENGTH}
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="review-staff-select">
                  Nhân viên phục vụ (không bắt buộc)
                </label>
                <select
                  id="review-staff-select"
                  aria-label="Nhân viên phục vụ (không bắt buộc)"
                  value={newReview.staffId}
                  onChange={(event) =>
                    setNewReview((current) => ({
                      ...current,
                      staffId: event.target.value,
                    }))
                  }
                >
                  <option value="">
                    Chọn nhân viên nếu muốn đánh giá trực tiếp
                  </option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName}
                    </option>
                  ))}
                </select>
                <small>
                  Đánh giá này chỉ là dữ liệu tham khảo cho quản lý khi đánh giá
                  hiệu suất.
                </small>
              </div>
              {submitError ? (
                <p className="reviews-inline-message reviews-inline-message--error" role="alert">
                  {submitError}
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn--primary"
                disabled={creatingReview}
                onClick={handleSubmitReview}
              >
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
