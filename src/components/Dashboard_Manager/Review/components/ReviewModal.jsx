import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  gql,
  useApolloClient,
  useMutation,
  useQuery,
} from "@apollo/client";
import "./ReviewModal.scss";

const GET_REVIEW_DETAIL = gql`
  query GetReviewDetail($id: ID!) {
    review(id: $id) {
      id
      targetType
      targetName
      restaurantId
      customerName
      staffId
      staffName
      customerAvatar
      rating
      title
      content
      images
      location
      verifiedPurchase
      status
      likesCount
      commentsCount
      helpfulCount
      createdAt
    }
  }
`;

const GET_REVIEW_COMMENTS = gql`
  query GetReviewComments($reviewId: ID!, $limit: Int = 100, $skip: Int = 0) {
    reviewComments(reviewId: $reviewId, limit: $limit, skip: $skip) {
      total
      items {
        id
        reviewId
        restaurantId
        parentId
        authorUserId
        authorName
        authorAvatar
        officialReply
        authorType
        content
        status
        repliesCount
        createdAt
      }
    }
  }
`;

const GET_REVIEW_TIMELINE = gql`
  query GetReviewTimeline($reviewId: ID!) {
    reviewTimeline(reviewId: $reviewId) {
      id
      actorUserId
      verb
      status
      meta
      diff
      at
      createdAt
    }
  }
`;

const CREATE_REVIEW_COMMENT = gql`
  mutation CreateReviewComment($input: ReviewCommentInput!) {
    createReviewComment(input: $input) {
      id
      reviewId
      restaurantId
      authorName
      officialReply
      content
      status
      createdAt
    }
  }
`;

function getStarRating(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating || 0)));
  return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
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

function formatDate(dateString) {
  if (!dateString) return "Chưa rõ thời gian";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  return date.toLocaleString("vi-VN");
}

function parseImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const ReviewModal = ({ visible, review, canReply = false, onClose }) => {
  const client = useApolloClient();
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState("");
  const [replySuccess, setReplySuccess] = useState("");

  const reviewId = review?.id;
  const { data: detailData, loading: detailLoading } = useQuery(
    GET_REVIEW_DETAIL,
    {
      variables: { id: reviewId },
      skip: !visible || !reviewId,
      fetchPolicy: "network-only",
    },
  );
  const {
    data: commentData,
    loading: commentLoading,
    refetch: refetchComments,
  } = useQuery(GET_REVIEW_COMMENTS, {
    variables: { reviewId },
    skip: !visible || !reviewId,
    fetchPolicy: "network-only",
  });
  const { data: timelineData, loading: timelineLoading } = useQuery(
    GET_REVIEW_TIMELINE,
    {
      variables: { reviewId },
      skip: !visible || !reviewId,
      fetchPolicy: "network-only",
    },
  );
  const [createReviewComment, { loading: creatingReply }] = useMutation(
    CREATE_REVIEW_COMMENT,
  );

  useEffect(() => {
    if (!visible) {
      setReplyText("");
      setReplyError("");
      setReplySuccess("");
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, visible]);

  const detail = detailData?.review || review;
  const comments = useMemo(
    () =>
      (commentData?.reviewComments?.items || []).filter(
        (item) => !item.parentId,
      ),
    [commentData],
  );
  const timeline = timelineData?.reviewTimeline || [];
  const images = parseImages(detail?.images || review?.images);

  if (!visible) return null;

  const handleCreateReply = async () => {
    const content = replyText.trim();
    if (!content || !detail?.id || !detail?.restaurantId || creatingReply) return;

    setReplyError("");
    setReplySuccess("");
    try {
      const result = await createReviewComment({
        variables: {
          input: {
            reviewId: detail.id,
            restaurantId: detail.restaurantId,
            officialReply: true,
            content,
          },
        },
      });
      if (!result?.data?.createReviewComment?.id) {
        throw new Error("Backend không xác nhận phản hồi vừa tạo.");
      }

      setReplyText("");
      setReplySuccess("Đã gửi phản hồi chính thức.");
      await refetchComments();
      await client.refetchQueries({
        include: [
          "GetReviews",
          "GetReviewStats",
          "GetReviewAnalytics",
          "GetRestaurantReviews",
          "GetRestaurantReviewStats",
        ],
      });
    } catch (error) {
      setReplyError(
        error?.message || "Không thể gửi phản hồi. Vui lòng thử lại.",
      );
    }
  };

  return (
    <div
      className="reviews-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="reviews-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
      >
        <div className="reviews-modal__header">
          <h3 className="reviews-modal__title" id="review-detail-title">
            Chi tiết đánh giá
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            className="reviews-modal__close"
            onClick={onClose}
            aria-label="Đóng chi tiết đánh giá"
          >
            ×
          </button>
        </div>

        <div className="reviews-modal__body">
          {detailLoading ? (
            <div role="status">Đang tải chi tiết...</div>
          ) : (
            <>
              <div className="reviews-modal__summary">
                <div className="reviews-review-card__meta">
                  <span>
                    Khách hàng: {detail?.customerName || review?.customer_name}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>
                    {formatDate(detail?.createdAt || review?.created_at)}
                  </span>
                </div>
                <div
                  className="reviews-modal__rating"
                  aria-label={`${detail?.rating || review?.rating} trên 5 sao`}
                >
                  <span aria-hidden="true">
                    {getStarRating(detail?.rating || review?.rating)}
                  </span>{" "}
                  <strong>{detail?.rating || review?.rating}/5</strong>
                </div>
              </div>

              <h4 className="reviews-modal__review-title">
                {detail?.title || review?.title}
              </h4>
              <p className="reviews-modal__review-content">
                {detail?.content || review?.content}
              </p>
              <p className="reviews-modal__staff-line">
                <strong>Nhân viên được khách đánh giá:</strong>{" "}
                {detail?.staffName ||
                  review?.staff_name ||
                  "Không gắn nhân viên"}
              </p>
              <p className="reviews-modal__performance-note">
                Đánh giá công khai được dùng làm dữ liệu tham khảo hiệu suất ở
                lần tính lại tiếp theo.
              </p>

              {!!images.length && (
                <div className="reviews-modal__image-preview">
                  {images.map((image, index) => (
                    <img
                      key={image}
                      src={image}
                      alt={`Ảnh đánh giá ${index + 1}`}
                      width="220"
                      height="160"
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </div>
              )}

              <div className="reviews-modal__reply-section">
                <h4>Phản hồi của nhà hàng</h4>
                {commentLoading ? (
                  <div role="status">Đang tải phản hồi...</div>
                ) : comments.length === 0 ? (
                  <div className="reviews-empty-note">
                    Chưa có phản hồi nào.
                  </div>
                ) : (
                  <div className="reviews-comments">
                    {comments.map((comment) => (
                      <div key={comment.id} className="reviews-comment-item">
                        <div className="reviews-comment-item__avatar">
                          {comment.authorAvatar ? (
                            <img
                              src={comment.authorAvatar}
                              alt={comment.authorName || "Người phản hồi"}
                              width="40"
                              height="40"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            getInitials(comment.authorName)
                          )}
                        </div>
                        <div className="reviews-comment-item__content">
                          <strong>{comment.authorName}</strong>
                          {comment.officialReply && (
                            <span className="reviews-official-badge">
                              Phản hồi từ nhà hàng
                            </span>
                          )}
                          <div>{comment.content}</div>
                          <small>{formatDate(comment.createdAt)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="reviews-modal__timeline">
                <h4>Lịch sử xử lý</h4>
                {timelineLoading ? (
                  <div className="reviews-empty-note" role="status">
                    Đang tải lịch sử...
                  </div>
                ) : timeline.length ? (
                  <ol>
                    {timeline.map((event) => (
                      <li key={event.id}>
                        <strong>{event.verb}</strong>
                        <span>{formatDate(event.at || event.createdAt)}</span>
                        {event.meta?.reason && (
                          <small>Lý do: {event.meta.reason}</small>
                        )}
                        {event.diff && (
                          <small>{JSON.stringify(event.diff)}</small>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="reviews-empty-note">
                    Chưa có lịch sử xử lý cho đánh giá này.
                  </div>
                )}
              </div>

              {canReply && (
                <div className="reviews-modal__reply-box">
                  <label htmlFor="official-review-reply">
                    Phản hồi chính thức
                  </label>
                  <textarea
                    id="official-review-reply"
                    rows={3}
                    maxLength={2000}
                    placeholder="Nhập phản hồi từ nhà hàng..."
                    value={replyText}
                    onChange={(event) => {
                      setReplyText(event.target.value);
                      setReplyError("");
                      setReplySuccess("");
                    }}
                  />
                  <small>{replyText.length}/2000 ký tự</small>
                </div>
              )}

              {replyError && (
                <div className="reviews-error-box" role="alert">
                  {replyError}
                </div>
              )}
              {replySuccess && (
                <div className="reviews-inline-message" role="status">
                  {replySuccess}
                </div>
              )}
            </>
          )}
        </div>

        <div className="reviews-modal__footer">
          <button
            className="reviews-btn reviews-btn-secondary"
            type="button"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="reviews-btn reviews-btn-primary"
            disabled={!canReply || creatingReply || !replyText.trim()}
            onClick={handleCreateReply}
          >
            {!canReply
              ? "Không có quyền phản hồi"
              : creatingReply
                ? "Đang gửi..."
                : "Gửi phản hồi"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
