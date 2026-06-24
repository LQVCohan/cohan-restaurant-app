import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { MessageSquareHeart, Star, X } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import "./PostOrderReviewPrompt.scss";

const REVIEWED_STORAGE_KEY = "cohan.reviewedCompletedOrders.v1";

const ORDERS_BY_USER_FOR_REVIEW = gql`
  query OrdersByUserForReviewPrompt($userId: ID!, $limit: Int = 12) {
    ordersByUser(userId: $userId, limit: $limit) {
      edges {
        node {
          id
          orderCode
          restaurantId
          currentStatus
          createdAt
          items { name }
        }
      }
    }
  }
`;

const MY_RESERVATIONS_FOR_REVIEW = gql`
  query MyReservationsForReviewPrompt($limit: Int = 12) {
    myReservations(limit: $limit) {
      id
      orderCode
      restaurantId
      restaurantName
      status
      createdAt
      timeTo
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
    const parsed = JSON.parse(window.localStorage.getItem(REVIEWED_STORAGE_KEY) || "[]");
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
  String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase();

const isReviewableStatus = (value) =>
  ["completed", "seated"].includes(String(value || "").toLowerCase());

const buildReviewTarget = ({ orders, reservations }) => {
  const reviewed = readReviewedIds();

  const completedOrder = (orders || []).find(
    (order) => isReviewableStatus(order?.currentStatus) && !reviewed.has(`order:${order.id}`),
  );
  if (completedOrder) {
    return {
      kind: "order",
      storageId: `order:${completedOrder.id}`,
      id: completedOrder.id,
      code: completedOrder.orderCode || completedOrder.id,
      restaurantId: completedOrder.restaurantId,
      restaurantName: "Nhà hàng",
      title: "Đơn hàng của bạn đã hoàn tất",
      subtitle: "Chia sẻ trải nghiệm để nhà hàng phục vụ tốt hơn.",
    };
  }

  const completedReservation = (reservations || []).find(
    (reservation) => isReviewableStatus(reservation?.status) && !reviewed.has(`reservation:${reservation.id}`),
  );
  if (completedReservation) {
    return {
      kind: "reservation",
      storageId: `reservation:${completedReservation.id}`,
      id: completedReservation.id,
      code: completedReservation.orderCode || completedReservation.id,
      restaurantId: completedReservation.restaurantId,
      restaurantName: completedReservation.restaurantName || "Nhà hàng",
      title: "Bạn vừa hoàn tất trải nghiệm đặt bàn",
      subtitle: "Đánh giá nhanh giúp khách sau chọn đúng nơi hơn.",
    };
  }

  return null;
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
  const [submittedTargetId, setSubmittedTargetId] = useState(null);

  const { data: ordersData, refetch: refetchOrders } = useQuery(ORDERS_BY_USER_FOR_REVIEW, {
    variables: { userId, limit: 12 },
    skip: !isAuthenticated || !isCustomer || !userId,
    fetchPolicy: "cache-and-network",
  });
  const { data: reservationsData, refetch: refetchReservations } = useQuery(MY_RESERVATIONS_FOR_REVIEW, {
    variables: { limit: 12 },
    skip: !isAuthenticated || !isCustomer || !userId,
    fetchPolicy: "cache-and-network",
  });
  const [createReview, { loading }] = useMutation(CREATE_REVIEW);

  const target = useMemo(() => {
    if (submittedTargetId) return null;
    const orders = (ordersData?.ordersByUser?.edges || []).map((edge) => edge?.node).filter(Boolean);
    return buildReviewTarget({ orders, reservations: reservationsData?.myReservations || [] });
  }, [ordersData, reservationsData?.myReservations, submittedTargetId]);

  if (!target || isHidden) return null;

  const handleSubmit = async () => {
    if (!target.restaurantId) return;
    const trimmedContent = content.trim() || "Trải nghiệm tốt, mình sẽ tiếp tục ủng hộ nhà hàng.";
    await createReview({
      variables: {
        input: {
          targetType: "restaurant",
          targetId: target.restaurantId,
          targetName: target.restaurantName,
          restaurantId: target.restaurantId,
          restaurantName: target.restaurantName,
          rating,
          title: target.kind === "order" ? "Đánh giá sau đơn hàng" : "Đánh giá sau đặt bàn",
          content: trimmedContent,
          tags: [target.kind],
        },
      },
    });
    writeReviewedId(target.storageId);
    setSubmittedTargetId(target.storageId);
    setIsExpanded(false);
    setContent("");
    refetchOrders?.();
    refetchReservations?.();
  };

  return (
    <section className={`post-order-review ${isExpanded ? "is-expanded" : ""}`} aria-label="Đánh giá sau đơn hoàn tất">
      <button type="button" className="post-order-review__close" onClick={() => setIsHidden(true)} aria-label="Ẩn gợi ý đánh giá">
        <X size={15} />
      </button>
      <div className="post-order-review__icon"><MessageSquareHeart size={19} /></div>
      <div className="post-order-review__copy">
        <p>{target.title}</p>
        <strong>{target.code}</strong>
        <span>{target.subtitle}</span>
      </div>
      {!isExpanded ? (
        <button type="button" className="post-order-review__action" onClick={() => setIsExpanded(true)}>
          Đánh giá
        </button>
      ) : (
        <div className="post-order-review__form">
          <div className="post-order-review__stars" aria-label="Chọn số sao">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" className={rating >= star ? "active" : ""} onClick={() => setRating(star)}>
                <Star size={18} fill="currentColor" />
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            placeholder="Bạn thấy món ăn, phục vụ hoặc đặt bàn như thế nào?"
          />
          <button type="button" className="post-order-review__submit" disabled={loading} onClick={handleSubmit}>
            {loading ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </div>
      )}
    </section>
  );
}
