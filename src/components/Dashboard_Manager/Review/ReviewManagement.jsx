import React, { useMemo, useState, useCallback, useEffect } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

import "./ReviewManagement.scss";

import ReviewsSidebarFilters from "./components/ReviewsSidebarFilters";
import ReviewsList from "./components/ReviewsList";
import ReviewModal from "./components/ReviewModal";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";
import { hasPermission } from "@/utils/frontendPermissionAccess";

const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      avatarUrl
      roleName
      role {
        slug
        permissions { code }
        directPermissions { code }
        parentRole { slug permissions { code } }
      }
    }
  }
`;

const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 100, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query AllRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_REVIEWS = gql`
  query GetReviews(
    $restaurantId: ID
    $targetType: String
    $status: String
    $minRating: Int
    $maxRating: Int
  ) {
    reviews(
      restaurantId: $restaurantId
      targetType: $targetType
      status: $status
      minRating: $minRating
      maxRating: $maxRating
      limit: 100
      skip: 0
    ) {
      total
      items {
        id
        targetType
        targetId
        targetName
        restaurantId
        restaurantName
        customerId
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
        tags
        status
        likesCount
        commentsCount
        reportsCount
        helpfulCount
        reactions {
          like
          love
          care
          haha
          wow
          sad
          angry
          total
        }
        createdAt
      }
    }
  }
`;

const GET_REVIEW_STATS = gql`
  query GetReviewStats($restaurantId: ID, $targetType: String) {
    reviewStats(restaurantId: $restaurantId, targetType: $targetType) {
      total
      avgRating
      pending
      ratingBreakdown
    }
  }
`;

const DELETE_REVIEW = gql`
  mutation DeleteReview($id: ID!) {
    deleteReview(id: $id)
  }
`;

const SET_REVIEW_STATUS = gql`
  mutation SetReviewStatus($id: ID!, $status: String!, $reason: String, $moderationNote: String) {
    setReviewStatus(id: $id, status: $status, reason: $reason, moderationNote: $moderationNote) {
      id
      status
    }
  }
`;

const normalizeReview = (review) => ({
  id: review.id,
  type: review.targetType,
  target_id: review.targetId,
  target_name: review.targetName,
  restaurant_id: review.restaurantId,
  restaurant_name: review.restaurantName,
  customer_id: review.customerId,
  customer_name: review.customerName,
  staff_id: review.staffId || null,
  staff_name: review.staffName || "",
  customer_avatar: review.customerAvatar,
  rating: review.rating,
  title: review.title || "(Không tiêu đề)",
  content: review.content,
  images: JSON.stringify(review.images || []),
  status: review.status,
  location: review.location || "Không rõ",
  verified_purchase: Boolean(review.verifiedPurchase),
  tags: JSON.stringify(review.tags || []),
  likes: review.likesCount || 0,
  replies: review.commentsCount || 0,
  reports_count: review.reportsCount || 0,
  helpful_count: review.helpfulCount || 0,
  reactions: review.reactions || {},
  created_at: review.createdAt,
});

function getModerationSuccessMessage(review, status) {
  if (status === "published") {
    return review?.staff_id
      ? "Đã duyệt đánh giá. Đánh giá này sẽ được dùng làm dữ liệu tham khảo hiệu suất ở lần tính lại tiếp theo."
      : "Đã duyệt đánh giá";
  }

  return status === "reported"
    ? "Đã chuyển về trạng thái bị báo cáo"
    : "Đã chuyển đánh giá sang trạng thái ẩn";
}

const ReviewManagement = () => {
  const [currentTab, setCurrentTab] = useState("all");
  const [filters, setFilters] = useState({
    ratings: [5, 4, 3, 2, 1],
    status: "",
    time: "",
    image: "",
    restaurant: "",
    verified: "",
    staffAssigned: "",
    sort: "newest",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [notification, setNotification] = useState(null);
  const [reviewPendingDelete, setReviewPendingDelete] = useState(null);
  const [isDeletingReview, setIsDeletingReview] = useState(false);

  const notify = useCallback((message, type = "success") => {
    setNotification({ message, type });
  }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;

  const { data: managerRestaurantsData } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId: me?.id, limit: 100 },
    skip: !me?.id || (me?.roleName !== "manager" && me?.roleName !== "staff"),
    fetchPolicy: "network-only",
  });

  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: me?.roleName !== "admin",
    fetchPolicy: "network-only",
  });

  const restaurantOptions = useMemo(() => {
    if (me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map((edge) => edge.node);
    }
    return (managerRestaurantsData?.restaurantsByManager?.edges || []).map(
      (edge) => edge.node,
    );
  }, [allRestaurantsData, managerRestaurantsData, me?.roleName]);

  useEffect(() => {
    if (!me || me.roleName === "admin" || filters.restaurant || !restaurantOptions.length) return;
    setFilters((prev) => (prev.restaurant ? prev : { ...prev, restaurant: restaurantOptions[0].id }));
  }, [filters.restaurant, me, restaurantOptions]);

  const gqlTargetType = ["all", "pending", "reported", "hidden", "rejected"].includes(currentTab)
    ? undefined
    : currentTab;
  const gqlStatus = currentTab === "pending"
    ? "pending"
    : currentTab === "reported"
      ? "reported"
      : currentTab === "hidden"
        ? "hidden"
        : currentTab === "rejected"
          ? "rejected"
          : filters.status || undefined;
  const gqlMinRating = filters.ratings?.length ? Math.min(...filters.ratings) : undefined;
  const gqlMaxRating = filters.ratings?.length ? Math.max(...filters.ratings) : undefined;

  const { data, loading, error, refetch } = useQuery(GET_REVIEWS, {
    variables: {
      restaurantId: filters.restaurant || undefined,
      targetType: gqlTargetType,
      status: gqlStatus,
      minRating: gqlMinRating,
      maxRating: gqlMaxRating,
    },
    fetchPolicy: "cache-and-network",
  });

  const { data: statsData } = useQuery(GET_REVIEW_STATS, {
    variables: {
      restaurantId: filters.restaurant || undefined,
      targetType: gqlTargetType,
    },
  });

  const [deleteReview] = useMutation(DELETE_REVIEW);
  const [setReviewStatus] = useMutation(SET_REVIEW_STATUS);

  const reviews = useMemo(
    () => (data?.reviews?.items || []).map(normalizeReview),
    [data],
  );
  const reviewsTotal = Number(data?.reviews?.total || 0);
  const isPartialReviewList = reviewsTotal > reviews.length;

  const filteredReviews = useMemo(() => {
    let list = [...reviews];

    if (filters.ratings?.length) {
      list = list.filter((r) => filters.ratings.includes(r.rating));
    }

    if (filters.time) {
      const now = new Date();
      const cutoff = new Date();
      if (filters.time === "today") cutoff.setHours(0, 0, 0, 0);
      if (filters.time === "week") cutoff.setDate(now.getDate() - 7);
      if (filters.time === "month") cutoff.setMonth(now.getMonth() - 1);
      if (filters.time === "quarter") cutoff.setMonth(now.getMonth() - 3);
      list = list.filter((r) => new Date(r.created_at) >= cutoff);
    }

    if (filters.image === "with-images") {
      list = list.filter((r) => JSON.parse(r.images || "[]").length > 0);
    }
    if (filters.image === "no-images") {
      list = list.filter((r) => JSON.parse(r.images || "[]").length === 0);
    }

    if (filters.verified === "verified") {
      list = list.filter((r) => r.verified_purchase);
    }
    if (filters.verified === "unverified") {
      list = list.filter((r) => !r.verified_purchase);
    }

    if (filters.staffAssigned === "with-staff") {
      list = list.filter((r) => Boolean(r.staff_id));
    }
    if (filters.staffAssigned === "without-staff") {
      list = list.filter((r) => !r.staff_id);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          (r.customer_name || "").toLowerCase().includes(term) ||
          (r.title || "").toLowerCase().includes(term) ||
          (r.content || "").toLowerCase().includes(term) ||
          (r.staff_name || "").toLowerCase().includes(term) ||
          (r.target_name || "").toLowerCase().includes(term) ||
          (r.restaurant_name || "").toLowerCase().includes(term),
      );
    }

    if (filters.sort === "oldest") {
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (filters.sort === "rating_desc") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (filters.sort === "rating_asc") {
      list.sort((a, b) => a.rating - b.rating);
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [filters, reviews, searchTerm]);

  const stats = useMemo(() => {
    const apiStats = statsData?.reviewStats;
    if (apiStats) {
      return {
        total: apiStats.total,
        avg: Number(apiStats.avgRating || 0).toFixed(1),
        pending: apiStats.pending,
      };
    }

    const total = reviews.length;
    const avg = total ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : "0.0";
    const pending = reviews.filter((r) => r.status === "pending").length;
    return { total, avg, pending };
  }, [reviews, statsData]);

  const handleViewReview = useCallback((review) => {
    setSelectedReview(review);
    setModalVisible(true);
  }, []);

  const handleDeleteReview = useCallback((review) => {
    setReviewPendingDelete(review);
  }, []);

  const handleCancelDeleteReview = useCallback(() => {
    if (isDeletingReview) return;
    setReviewPendingDelete(null);
  }, [isDeletingReview]);

  const handleConfirmDeleteReview = useCallback(async () => {
    if (!reviewPendingDelete?.id || isDeletingReview) return;
    setIsDeletingReview(true);
    try {
      await deleteReview({ variables: { id: reviewPendingDelete.id } });
      await refetch();
      setReviewPendingDelete(null);
      notify("Đã xóa đánh giá");
    } catch (err) {
      notify(err?.message || "Không thể xóa đánh giá. Vui lòng thử lại.", "error");
    } finally {
      setIsDeletingReview(false);
    }
  }, [deleteReview, isDeletingReview, notify, refetch, reviewPendingDelete]);

  const handleModerate = useCallback(
    async (review, status) => {
      try {
        const reason = ["hidden", "rejected"].includes(status) ? window.prompt("Nhập lý do kiểm duyệt (không bắt buộc):", "") || "" : "";
        await setReviewStatus({ variables: { id: review.id, status, reason, moderationNote: reason } });
        await refetch();
        notify(getModerationSuccessMessage(review, status));
      } catch (err) {
        notify(err?.message || "Không thể cập nhật trạng thái đánh giá.", "error");
      }
    },
    [notify, refetch, setReviewStatus],
  );

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const handleExport = () => {
    if (!permissions.canExport) return;
    const header = [
      "ID",
      "Khách hàng",
      "Nhân viên được đánh giá",
      "Đánh giá",
      "Tiêu đề",
      "Nội dung",
      "Nhà hàng",
      "Loại",
      "Trạng thái",
      "Xác thực",
      "Báo cáo",
      "Thời gian",
    ].join(",");
    const rows = filteredReviews.map((r) =>
      [
        r.id,
        escapeCsv(r.customer_name),
        escapeCsv(r.staff_name || "Không gắn nhân viên"),
        r.rating,
        escapeCsv(r.title),
        escapeCsv(r.content),
        escapeCsv(r.restaurant_name),
        r.type,
        r.status,
        r.verified_purchase ? "yes" : "no",
        r.reports_count || 0,
        escapeCsv(new Date(r.created_at).toLocaleString("vi-VN")),
      ].join(","),
    );
    const csv = `\uFEFF${[header, ...rows].join("\n")}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `reviews_export_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const permissions = {
    canModerate: hasPermission(me, "review.moderate"),
    canDelete: hasPermission(me, "review.delete"),
    canExport: hasPermission(me, "review.export"),
    canReply: hasPermission(me, "review.reply"),
  };

  const titleMap = {
    all: "Tất cả đánh giá",
    restaurant: "Đánh giá nhà hàng",
    food: "Đánh giá món ăn",
    service: "Đánh giá dịch vụ",
    pending: "Chờ duyệt",
    reported: "Bị báo cáo",
    hidden: "Đã ẩn",
    rejected: "Từ chối",
  };

  return (
    <div className="reviews-page">
      {notification && (
        <div className={`reviews-toast reviews-toast--${notification.type}`} role="status">
          {notification.message}
        </div>
      )}

      <div className="reviews-container">
        <ManagementPageHeader
          density="compact"
          showTimeWidget={false}
          eyebrow="REVIEW MANAGER"
          title="Đánh giá khách hàng"
          subtitle="Xem đánh giá, phản hồi và kiểm duyệt nội dung review."
          icon="⭐"
          stats={[
            { id: "total", icon: "🧾", label: "Tổng đánh giá", value: stats.total },
            { id: "avg", icon: "⭐", label: "Điểm trung bình", value: stats.avg },
            { id: "pending", icon: "⏳", label: "Chờ duyệt", value: stats.pending },
            { id: "bad", icon: "⚠️", label: "Tiêu cực", value: filteredReviews.filter((r) => Number(r.rating || 0) <= 2).length },
          ]}
          secondaryActions={permissions.canExport ? [{ label: "Xuất báo cáo", icon: "📊", onClick: handleExport }] : []}
        />

        <ManagerCommandBar
          tabs={[
            { id: "all", label: "Tất cả" },
            { id: "restaurant", label: "Nhà hàng" },
            { id: "food", label: "Món ăn" },
            { id: "service", label: "Dịch vụ" },
            { id: "pending", label: "Chờ duyệt" },
            { id: "reported", label: "Bị báo cáo" },
            { id: "hidden", label: "Đã ẩn" },
            { id: "rejected", label: "Từ chối" },
          ]}
          activeTab={currentTab}
          onTabChange={setCurrentTab}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm khách hàng, nhân viên, tiêu đề, nội dung..."
        />


        <main className="reviews-main-content">
          <div className="reviews-content-grid">
            <ReviewsSidebarFilters
              filters={filters}
              onChange={setFilters}
              restaurantOptions={restaurantOptions}
            />

            <section className="reviews-content-area">
              <div className="reviews-content-header">
                <h2 className="reviews-content-header__title">{titleMap[currentTab]}</h2>
                <div className="reviews-content-header__meta">
                  Hiển thị {reviews.length} / {reviewsTotal} đánh giá
                  {isPartialReviewList && " · Đang hiển thị 100 đánh giá mới nhất, hãy dùng bộ lọc để thu hẹp kết quả."}
                </div>
              </div>

              {error ? (
                <div className="reviews-error-box">
                  Không thể tải dữ liệu đánh giá. Vui lòng thử lại.
                </div>
              ) : (
                <ReviewsList
                  isLoading={loading}
                  reviews={filteredReviews}
                  currentTab={currentTab}
                  onView={handleViewReview}
                  onDelete={handleDeleteReview}
                  onEdit={handleModerate}
                  permissions={permissions}
                />
              )}
            </section>
          </div>
        </main>
      </div>

      {reviewPendingDelete && (
        <div className="reviews-confirm-overlay" role="presentation">
          <div className="reviews-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="review-delete-title">
            <h3 id="review-delete-title">Xóa đánh giá?</h3>
            <p>
              Bạn đang xóa đánh giá của <strong>{reviewPendingDelete.customer_name || "khách hàng"}</strong>.
              Hành động này không thể hoàn tác.
            </p>
            <div className="reviews-confirm-dialog__actions">
              <button
                type="button"
                className="reviews-btn reviews-btn-secondary"
                disabled={isDeletingReview}
                onClick={handleCancelDeleteReview}
              >
                Hủy
              </button>
              <button
                type="button"
                className="reviews-btn reviews-btn-danger"
                disabled={isDeletingReview}
                onClick={handleConfirmDeleteReview}
              >
                {isDeletingReview ? "Đang xóa..." : "Xóa đánh giá"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReviewModal
        visible={modalVisible}
        review={selectedReview}
        me={me}
        canReply={permissions.canReply}
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
};

export default ReviewManagement;
