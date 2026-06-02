import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
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
    }
  }
`;

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

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN");
}

const ReviewModal = ({ visible, review, me, canReply = false, onClose }) => {
  const [replyText, setReplyText] = useState("");

  const reviewId = review?.id;
  const { data: detailData, loading: detailLoading } = useQuery(GET_REVIEW_DETAIL, {
    variables: { id: reviewId },
    skip: !visible || !reviewId,
    fetchPolicy: "network-only",
  });
  const { data: commentData, loading: commentLoading, refetch: refetchComments } = useQuery(
    GET_REVIEW_COMMENTS,
    {
      variables: { reviewId },
      skip: !visible || !reviewId,
      fetchPolicy: "network-only",
    },
  );
  const { data: timelineData, loading: timelineLoading } = useQuery(GET_REVIEW_TIMELINE, {
    variables: { reviewId },
    skip: !visible || !reviewId,
    fetchPolicy: "network-only",
  });
  const [createReviewComment, { loading: creatingReply }] = useMutation(
    CREATE_REVIEW_COMMENT,
  );

  const detail = detailData?.review || review;
  const comments = useMemo(
    () => (commentData?.reviewComments?.items || []).filter((item) => !item.parentId),
    [commentData],
  );
  const timeline = timelineData?.reviewTimeline || [];

  if (!visible) return null;

  const handleCreateReply = async () => {
    if (!replyText.trim() || !detail?.id || !detail?.restaurantId) return;
    await createReviewComment({
      variables: {
        input: {
          reviewId: detail.id,
          restaurantId: detail.restaurantId,
          officialReply: true,
          content: replyText.trim(),
        },
      },
    });
    setReplyText("");
    await refetchComments();
  };

  const images = detail?.images || JSON.parse(review?.images || "[]");

  return (
    <div className="reviews-modal-overlay">
      <div className="reviews-modal">
        <div className="reviews-modal__header">
          <h3 className="reviews-modal__title">Chi tiết đánh giá</h3>
          <button type="button" className="reviews-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="reviews-modal__body">
          {detailLoading ? (
            <div>Đang tải chi tiết...</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div className="reviews-review-card__meta">
                  <span>Khách hàng: {detail?.customerName || review?.customer_name}</span>
                  <span>•</span>
                  <span>{formatDate(detail?.createdAt || review?.created_at)}</span>
                </div>
                <div style={{ marginTop: 6, color: "#f59e0b", fontSize: "1rem" }}>
                  {getStarRating(detail?.rating || review?.rating)}{" "}
                  <strong>{detail?.rating || review?.rating}/5</strong>
                </div>
              </div>

              <h4 style={{ marginBottom: 6 }}>{detail?.title || review?.title}</h4>
              <p style={{ marginBottom: 10 }}>{detail?.content || review?.content}</p>
              <p style={{ marginBottom: 8 }}>
                <strong>Nhân viên được khách đánh giá:</strong>{" "}
                {detail?.staffName || review?.staff_name || "Không gắn nhân viên"}
              </p>
              <p style={{ marginBottom: 12, fontStyle: "italic", color: "#4b5563" }}>
                Review công khai được dùng làm dữ liệu tham khảo hiệu suất ở lần tính lại tiếp theo.
              </p>

              {!!images?.length && (
                <div className="reviews-modal__image-preview">
                  {images.map((img) => (
                    <img key={img} src={img} alt="Review" />
                  ))}
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <h4>Phản hồi của nhà hàng</h4>
                {commentLoading ? (
                  <div>Đang tải phản hồi...</div>
                ) : comments.length === 0 ? (
                  <div className="reviews-empty-note">Chưa có phản hồi nào.</div>
                ) : (
                  <div className="reviews-comments">
                    {comments.map((comment) => (
                      <div key={comment.id} className="reviews-comment-item">
                        <div className="reviews-comment-item__avatar">
                          {comment.authorAvatar ? (
                            <img src={comment.authorAvatar} alt={comment.authorName} />
                          ) : (
                            getInitials(comment.authorName)
                          )}
                        </div>
                        <div className="reviews-comment-item__content">
                          <strong>{comment.authorName}</strong>
                          {comment.officialReply && <span className="reviews-official-badge">Phản hồi từ nhà hàng</span>}
                          <div>{comment.content}</div>
                          <small>{formatDate(comment.createdAt)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <div className="reviews-modal__timeline">
                <h4>Audit timeline</h4>
                {timelineLoading ? (
                  <div className="reviews-empty-note">Đang tải timeline...</div>
                ) : timeline.length ? (
                  <ol>
                    {timeline.map((event) => (
                      <li key={event.id}>
                        <strong>{event.verb}</strong>
                        <span>{formatDate(event.at || event.createdAt)}</span>
                        {event.meta?.reason && <small>Lý do: {event.meta.reason}</small>}
                        {event.diff && <small>{JSON.stringify(event.diff)}</small>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="reviews-empty-note">Chưa có event audit cho review này.</div>
                )}
              </div>

              {canReply && (
                <div style={{ marginTop: 14 }}>
                <textarea
                  rows={3}
                  placeholder="Nhập phản hồi từ nhà hàng..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </div>
              )}
            </>
          )}
        </div>

        <div className="reviews-modal__footer">
          <button className="reviews-btn reviews-btn-secondary" type="button" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="reviews-btn reviews-btn-primary"
            disabled={!canReply || creatingReply || !replyText.trim()}
            onClick={handleCreateReply}
          >
            {!canReply ? "Không có quyền phản hồi" : creatingReply ? "Đang gửi..." : "Gửi phản hồi"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
