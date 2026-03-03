import React, { useMemo, useState, useCallback } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

import "./ReviewManagement.scss";

import ReviewsHeader from "./components/ReviewsHeader";
import ReviewsNavTabs from "./components/ReviewsNavTabs";
import ReviewsSidebarFilters from "./components/ReviewsSidebarFilters";
import ReviewsList from "./components/ReviewsList";
import ReviewModal from "./components/ReviewModal";

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
      limit: 200
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
        customerName
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

const DELETE_REVIEW = gql`
  mutation DeleteReview($id: ID!) {
    deleteReview(id: $id)
  }
`;

const SET_REVIEW_STATUS = gql`
  mutation SetReviewStatus($id: ID!, $status: String!) {
    setReviewStatus(id: $id, status: $status) {
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
  customer_name: review.customerName,
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
  helpful_count: review.helpfulCount || 0,
  reactions: review.reactions || {},
  created_at: review.createdAt,
});

function showNotification(msg) {
  window.alert(msg);
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
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const [selectedReview, setSelectedReview] = useState(null);

  const gqlTargetType = currentTab === "all" || currentTab === "pending" ? undefined : currentTab;
  const gqlStatus = currentTab === "pending" ? "pending" : filters.status || undefined;
  const gqlMinRating = filters.ratings?.length ? Math.min(...filters.ratings) : undefined;
  const gqlMaxRating = filters.ratings?.length ? Math.max(...filters.ratings) : undefined;

  const { data, loading, refetch } = useQuery(GET_REVIEWS, {
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

  const [createReview, { loading: creating }] = useMutation(CREATE_REVIEW);
  const [deleteReview] = useMutation(DELETE_REVIEW);
  const [setReviewStatus] = useMutation(SET_REVIEW_STATUS);

  const reviews = useMemo(
    () => (data?.reviews?.items || []).map(normalizeReview),
    [data]
  );

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

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(t) ||
          r.title.toLowerCase().includes(t) ||
          r.content.toLowerCase().includes(t) ||
          (r.target_name || "").toLowerCase().includes(t)
      );
    }

    return list;
  }, [reviews, filters, searchTerm]);

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
    const avg = total ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : "0.0";
    const pending = reviews.filter((r) => r.status === "pending").length;
    return { total, avg, pending };
  }, [reviews, statsData]);

  const handleViewReview = useCallback((review) => {
    setSelectedReview(review);
    setModalMode("view");
    setModalVisible(true);
  }, []);

  const handleDeleteReview = useCallback(
    async (review) => {
      if (!window.confirm("Xóa đánh giá này?")) return;
      await deleteReview({ variables: { id: review.id } });
      await refetch();
      showNotification("Đã xóa đánh giá");
    },
    [deleteReview, refetch]
  );

  const handleSaveNewReview = useCallback(
    async (formData) => {
      await createReview({
        variables: {
          input: {
            targetType: formData.type,
            targetId: formData.target_id,
            targetName: formData.target_name,
            restaurantId: formData.restaurant_id,
            restaurantName: formData.restaurant_name,
            customerName: formData.customer_name,
            customerAvatar: formData.customer_avatar,
            rating: formData.rating,
            title: formData.title,
            content: formData.content,
            images: [],
            location: formData.location,
            verifiedPurchase: formData.verified_purchase,
            tags: [],
          },
        },
      });
      await refetch();
      showNotification("Đã tạo đánh giá mới (trạng thái chờ duyệt)");
    },
    [createReview, refetch]
  );

  const handleModerate = useCallback(
    async (review, status) => {
      await setReviewStatus({ variables: { id: review.id, status } });
      await refetch();
      showNotification(
        status === "published" ? "Đã duyệt đánh giá" : "Đã chuyển đánh giá sang trạng thái ẩn"
      );
    },
    [refetch, setReviewStatus]
  );

  const handleExport = () => {
    const csv = filteredReviews
      .map((r) =>
        [r.id, r.customer_name, r.rating, `"${r.title}"`, `"${r.content}"`, new Date(r.created_at).toLocaleString("vi-VN")].join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reviews_export.csv";
    a.click();
  };

  const titleMap = {
    all: "Tất cả đánh giá",
    restaurant: "Đánh giá nhà hàng",
    food: "Đánh giá món ăn",
    service: "Đánh giá dịch vụ",
    pending: "Chờ duyệt",
  };

  return (
    <div className="reviews-page">
      <div className="reviews-container">
        <ReviewsHeader total={stats.total} avg={stats.avg} pending={stats.pending} />
        <ReviewsNavTabs currentTab={currentTab} onChangeTab={setCurrentTab} pendingCount={stats.pending} />

        <main className="reviews-main-content">
          <div className="reviews-content-grid">
            <ReviewsSidebarFilters filters={filters} onChange={setFilters} />

            <section className="reviews-content-area">
              <div className="reviews-content-header">
                <h2 className="reviews-content-header__title">{titleMap[currentTab]}</h2>

                <div className="reviews-content-header__actions">
                  <div className="reviews-content-header__search-box">
                    <span className="reviews-content-header__search-box-icon">🔍</span>
                    <input
                      type="text"
                      className="reviews-content-header__search-box-input"
                      placeholder="Tìm kiếm đánh giá, khách hàng..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <button className="reviews-btn reviews-btn-secondary" onClick={handleExport}>
                    📊 Xuất báo cáo
                  </button>
                  <button
                    className="reviews-btn reviews-btn-primary"
                    onClick={() => {
                      setModalMode("add");
                      setSelectedReview(null);
                      setModalVisible(true);
                    }}
                  >
                    ➕ Thêm đánh giá
                  </button>
                </div>
              </div>

              <ReviewsList
                isLoading={loading || creating}
                reviews={filteredReviews}
                currentTab={currentTab}
                onView={handleViewReview}
                onDelete={handleDeleteReview}
                onEdit={handleModerate}
              />
            </section>
          </div>
        </main>
      </div>

      <ReviewModal
        visible={modalVisible}
        mode={modalMode}
        review={selectedReview}
        onClose={() => setModalVisible(false)}
        onSaveNew={handleSaveNewReview}
      />
    </div>
  );
};

export default ReviewManagement;
