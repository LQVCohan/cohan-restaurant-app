// src/pages/Reviews/ReviewManagement.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";

import "./ReviewManagement.scss";

import ReviewsHeader from "./components/ReviewsHeader";
import ReviewsNavTabs from "./components/ReviewsNavTabs";
import ReviewsSidebarFilters from "./components/ReviewsSidebarFilters";
import ReviewsList from "./components/ReviewsList";
import ReviewModal from "./components/ReviewModal";

// CONFIG MẶC ĐỊNH
const defaultConfig = {
  restaurant_name: "FoodHub Restaurant",
  welcome_message: "Quản lý đánh giá khách hàng",
  contact_info: "support@foodhub.com",
};

// REVIEW DEMO
const sampleReviews = [
  {
    id: "review_001",
    type: "restaurant",
    target_name: "FoodHub Restaurant - Chi nhánh chính",
    restaurant_id: "foodhub_main",
    restaurant_name: "FoodHub Restaurant - Chi nhánh chính",
    customer_name: "Nguyễn Văn An",
    rating: 5,
    title: "Trải nghiệm tuyệt vời!",
    content:
      "Nhà hàng có không gian đẹp, phục vụ tận tình. Món ăn ngon, giá cả hợp lý.",
    images:
      '["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300"]',
    likes: 12,
    replies: 1,
    status: "published",
    created_at: new Date().toISOString(),
    location: "Hà Nội",
    verified_purchase: true,
    helpful_count: 8,
    tags: '["Phục vụ tốt", "Không gian đẹp"]',
  },
  {
    id: "review_002",
    type: "food",
    target_name: "Phở bò tái",
    restaurant_id: "foodhub_district1",
    customer_name: "Trần Thị Bình",
    rating: 4,
    title: "Phở ngon, nước dùng đậm đà",
    content:
      "Phở có vị nước dùng đậm đà, thịt tái tươi. Thời gian chờ hơi lâu.",
    images:
      '["https://images.unsplash.com/photo-1555126634-323283e090fa?w=300"]',
    likes: 8,
    replies: 0,
    status: "published",
    created_at: new Date().toISOString(),
    location: "TP.HCM",
    verified_purchase: true,
    helpful_count: 5,
    tags: '["Ngon", "Nước dùng đậm đà"]',
  },
];

// FORMAT NGÀY
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN");
}

// THÔNG BÁO TẠM
function showNotification(msg) {
  alert(msg);
}

const ReviewManagement = () => {
  const [config, setConfig] = useState(defaultConfig);

  const [currentTab, setCurrentTab] = useState("all");
  const [reviews, setReviews] = useState([]);

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

  const [isLoading, setIsLoading] = useState(false);

  // INIT DATA
  useEffect(() => {
    setReviews(sampleReviews);
  }, []);

  // FILTER
  const filteredReviews = useMemo(() => {
    let list = [...reviews];

    if (currentTab !== "all") {
      list = list.filter((r) => r.type === currentTab);
    }

    if (filters.restaurant) {
      list = list.filter((r) => r.restaurant_id === filters.restaurant);
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

    if (searchTerm.trim() !== "") {
      const t = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(t) ||
          r.title.toLowerCase().includes(t) ||
          r.content.toLowerCase().includes(t)
      );
    }

    return list;
  }, [reviews, currentTab, filters, searchTerm]);

  // STATS
  const stats = useMemo(() => {
    const total = reviews.length;
    const avg =
      total > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
        : "0.0";
    const pending = reviews.filter((r) => r.status === "pending").length;

    return { total, avg, pending };
  }, [reviews]);

  // OPEN VIEW MODAL
  const handleViewReview = (review) => {
    setSelectedReview(review);
    setModalMode("view");
    setModalVisible(true);
  };

  // DELETE
  const handleDeleteReview = (review) => {
    const ok = window.confirm("Xóa đánh giá này?");
    if (!ok) return;

    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    showNotification("Đã xóa đánh giá");
  };

  // ADD REVIEW
  const handleSaveNewReview = (data) => {
    setReviews((prev) => [
      {
        ...data,
        id: `review_${Date.now()}`,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    showNotification("Đã thêm đánh giá");
  };

  // EXPORT CSV
  const handleExport = () => {
    const csv = filteredReviews
      .map((r) =>
        [
          r.id,
          r.customer_name,
          r.rating,
          `"${r.title}"`,
          `"${r.content}"`,
          formatDate(r.created_at),
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "reviews_export.csv";
    a.click();
  };

  // TITLE FOR TAB
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
        <ReviewsHeader
          total={stats.total}
          avg={stats.avg}
          pending={stats.pending}
        />
        <ReviewsNavTabs
          currentTab={currentTab}
          onChangeTab={setCurrentTab}
          pendingCount={stats.pending}
        />

        <main className="reviews-main-content">
          <div className="reviews-content-grid">
            <ReviewsSidebarFilters filters={filters} onChange={setFilters} />

            <section className="reviews-content-area">
              <div className="reviews-content-header">
                <h2 className="reviews-content-header__title">
                  {titleMap[currentTab]}
                </h2>

                <div className="reviews-content-header__actions">
                  <div className="reviews-content-header__search-box">
                    <span className="reviews-content-header__search-box-icon">
                      🔍
                    </span>
                    <input
                      type="text"
                      className="reviews-content-header__search-box-input"
                      placeholder="Tìm kiếm đánh giá, khách hàng..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <button
                    className="reviews-btn reviews-btn-secondary"
                    onClick={handleExport}
                  >
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
                isLoading={isLoading}
                reviews={filteredReviews}
                currentTab={currentTab}
                onView={handleViewReview}
                onDelete={handleDeleteReview}
                onEdit={() => showNotification("Đang phát triển")}
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
