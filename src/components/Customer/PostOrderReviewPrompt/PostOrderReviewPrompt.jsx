import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { MessageSquareHeart, Star, X } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import "./PostOrderReviewPrompt.scss";

const REVIEWED_STORAGE_KEY = "cohan.reviewedCompletedOrders.v1";
const REVIEW_PROMPT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PAID_ORDER_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);
const DEFAULT_REVIEW_CONTENT =
  "Trải nghiệm tốt, mình sẽ tiếp tục ủng hộ nhà hàng.";

const ORDERS_BY_USER_FOR_REVIEW = gql`
  query OrdersByUserForReviewPrompt($userId: ID!, $limit: Int = 12) {
    ordersByUser(userId: $userId, limit: $limit) {
      edges {
        node {
          id
          orderCode
          restaurantId
          currentStatus
          orderPaymentStatus
          createdAt
          updatedAt
          payment {
            status
            paidAt
          }
        }
      }
    }
  }
`;

const CREATE_REVIEW = gql`
  mutation CreatePostOrderReview($input: ReviewInput!) {
    createReview(input: $input) {
      id
      rating
      status
      createdAt
    }
  }
`;

const readReviewedIds = () => {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(REVIEWED_STORAGE_KEY) || "[]",
    );
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

const writeReviewedId = (id) => {
  if (typeof window === "undefined" || !id) return;
  const ids = readReviewedIds();
  ids.add(String(id));
  window.localStorage.setItem(REVIEWED_STORAGE_KEY, JSON.stringify([...ids]));
};

const getRoleName = (user) =>
  String(
    user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase();

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const getOrderCompletedAt = (order) =>
  order?.payment?.paidAt || order?.updatedAt || order?.createdAt || null;

export const isReviewableCompletedOrder = (order, now = Date.now()) => {
  const orderStatus = normalizeStatus(order?.currentStatus);
  const paymentStatus = normalizeStatus(
    order?.orderPaymentStatus || order?.payment?.status,
  );
  const hasCompletedExperience =
    orderStatus === "completed" || PAID_ORDER_STATUSES.has(paymentStatus);

  if (!hasCompletedExperience || !order?.restaurantId) return false;

  const completedAt = new Date(getOrderCompletedAt(order)).getTime();
  if (!Number.isFinite(completedAt)) return false;

  const age = now - completedAt;
  return age >= 0 && age <= REVIEW_PROMPT_MAX_AGE_MS;
};

export const buildReviewTarget = ({ orders, now = Date.now() }) => {
  const reviewed = readReviewedIds();
  const completedOrder = (orders || []).find(
    (order) =>
      isReviewableCompletedOrder(order, now) &&
      !reviewed.has(`order:${order.id}`),
  );

  if (!completedOrder) return null;

  return {
    kind: "order",
    storageId: `order:${completedOrder.id}`,
    id: completedOrder.id,
    code: completedOrder.orderCode || completedOrder.id,
    restaurantId: completedOrder.restaurantId,
    restaurantName: "Nhà hàng",
    title: "Bạn vừa hoàn tất đơn hàng",
    subtitle: "Đánh giá nhà hàng để giúp những khách sau chọn đúng nơi hơn.",
  };
};

export default function PostOrderReviewPrompt() {
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = getRoleName(user);
  const isCustomer = roleName === "customer";
  const userId = user?.id || user?._id;
  const [isHidden, setIsHidden] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submittedTargetId, setSubmittedTargetId] = useState(null);

  const { data: ordersData, refetch: refetchOrders } = useQuery(
    ORDERS_BY_USER_FOR_REVIEW,
    {
      variables: { userId, limit: 12 },
      skip: !isAuthenticated || !isCustomer || !userId,
      fetchPolicy: "cache-and-network",
    },
  );
  const [createReview, { loading }] = useMutation(CREATE_REVIEW);

  const target = useMemo(() => {
    if (submittedTargetId) return null;
    const orders = (ordersData?.ordersByUser?.edges || [])
      .map((edge) => edge?.node)
      .filter(Boolean);
    return buildReviewTarget({ orders });
  }, [ordersData, submittedTargetId]);

  if (!target || isHidden) return null;

  const handleSubmit = async () => {
    if (!target.restaurantId || loading) return;
    const trimmedContent = content.trim() || DEFAULT_REVIEW_CONTENT;
    setSubmitError("");

    try {
      const result = await createReview({
        variables: {
          input: {
            targetType: "restaurant",
            targetId: target.restaurantId,
            targetName: target.restaurantName,
            restaurantId: target.restaurantId,
            restaurantName: target.restaurantName,
            rating,
            title: "Đánh giá sau đơn hàng",
            content: trimmedContent,
            tags: [target.kind],
          },
        },
      });

      if (!result?.data?.createReview?.id) {
        throw new Error("Backend không xác nhận đánh giá vừa gửi.");
      }

      writeReviewedId(target.storageId);
      setSubmittedTargetId(target.storageId);
      setIsExpanded(false);
      setContent("");
      await refetchOrders?.();
    } catch (error) {
      setSubmitError(
        error?.message || "Không thể gửi đánh giá. Vui lòng thử lại.",
      );
    }
  };

  return (
    <section
      className={`post-order-review ${isExpanded ? "is-expanded" : ""}`}
      aria-label="Đánh giá nhà hàng sau đơn hoàn tất"
    >
      <button
        type="button"
        className="post-order-review__close"
        onClick={() => setIsHidden(true)}
        aria-label="Ẩn gợi ý đánh giá"
      >
        <X size={15} aria-hidden="true" />
      </button>
      <div className="post-order-review__icon" aria-hidden="true">
        <MessageSquareHeart size={19} />
      </div>
      <div className="post-order-review__copy">
        <p>{target.title}</p>
        <strong>{target.code}</strong>
        <span>{target.subtitle}</span>
      </div>
      {!isExpanded ? (
        <button
          type="button"
          className="post-order-review__action"
          onClick={() => {
            setSubmitError("");
            setIsExpanded(true);
          }}
        >
          Đánh giá
        </button>
      ) : (
        <div className="post-order-review__form">
          <div
            className="post-order-review__stars"
            role="radiogroup"
            aria-label="Chọn số sao"
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} sao`}
                className={rating >= star ? "active" : ""}
                onClick={() => setRating(star)}
              >
                <Star size={18} fill="currentColor" aria-hidden="true" />
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="post-order-review-content">
            Nội dung đánh giá
          </label>
          <textarea
            id="post-order-review-content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setSubmitError("");
            }}
            rows={3}
            maxLength={2000}
            placeholder="Bạn thấy món ăn, phục vụ và không gian nhà hàng như thế nào?"
          />
          {submitError && (
            <p className="post-order-review__error" role="alert">
              {submitError}
            </p>
          )}
          <button
            type="button"
            className="post-order-review__submit"
            disabled={loading || !target.restaurantId}
            onClick={handleSubmit}
          >
            {loading ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </div>
      )}
    </section>
  );
}
