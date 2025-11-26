import React, { useEffect, useState } from "react";
import "./ReviewModal.scss";

/* helpers riêng cho modal */
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
function parseImages(imagesString) {
  try {
    return imagesString ? JSON.parse(imagesString) : [];
  } catch {
    return [];
  }
}
function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleString("vi-VN");
}

const targetOptions = {
  restaurant: [
    { id: "restaurant_main", name: "FoodHub Restaurant - Tổng thể" },
    { id: "restaurant_ambiance", name: "Không gian nhà hàng" },
    { id: "restaurant_cleanliness", name: "Vệ sinh nhà hàng" },
    { id: "restaurant_location", name: "Vị trí địa điểm" },
  ],
  food: [
    { id: "food_pho_bo", name: "Phở bò tái" },
    { id: "food_pho_ga", name: "Phở gà" },
    { id: "food_bun_bo_hue", name: "Bún bò Huế" },
    { id: "food_com_tam", name: "Cơm tấm sườn nướng" },
    { id: "food_banh_mi", name: "Bánh mì thịt nướng" },
    { id: "food_che", name: "Chè đậu xanh" },
    { id: "food_ca_phe", name: "Cà phê sữa đá" },
  ],
  service: [
    { id: "service_staff", name: "Thái độ nhân viên" },
    { id: "service_speed", name: "Tốc độ phục vụ" },
    { id: "service_delivery", name: "Dịch vụ giao hàng" },
    { id: "service_booking", name: "Đặt bàn trước" },
    { id: "service_payment", name: "Thanh toán" },
  ],
};

const defaultNames = {
  restaurant: "FoodHub Restaurant",
  food: "Món ăn",
  service: "Dịch vụ",
};

const ReviewModal = ({ visible, mode, review, onClose, onSaveNew }) => {
  const isViewMode = mode === "view";

  // state cho form add
  const [type, setType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("published");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!visible || isViewMode) return;
    // clear form mỗi lần mở modal add
    setType("");
    setTargetId("");
    setRestaurantId("");
    setCustomerName("");
    setLocation("");
    setRating("");
    setTitle("");
    setContent("");
    setStatus("published");
    setVerified(false);
  }, [visible, isViewMode]);

  if (!visible) return null;

  const handleSubmitAdd = (e) => {
    e.preventDefault();

    if (
      !type ||
      !restaurantId ||
      !customerName ||
      !location ||
      !rating ||
      !title ||
      !content
    ) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const targetName =
      (targetOptions[type] || []).find((x) => x.id === targetId)?.name ||
      defaultNames[type] ||
      "Không xác định";

    const restaurantName = (() => {
      switch (restaurantId) {
        case "foodhub_main":
          return "FoodHub Restaurant - Chi nhánh chính";
        case "foodhub_district1":
          return "FoodHub Restaurant - Quận 1";
        case "foodhub_district3":
          return "FoodHub Restaurant - Quận 3";
        case "foodhub_hanoi":
          return "FoodHub Restaurant - Hà Nội";
        case "foodhub_danang":
          return "FoodHub Restaurant - Đà Nẵng";
        default:
          return "";
      }
    })();

    const reviewData = {
      type,
      target_id: targetId || `${type}_general`,
      target_name: targetName,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      customer_name: customerName,
      customer_avatar: "",
      rating: parseInt(rating, 10),
      title,
      content,
      images: "[]", // tạm chưa xử lý upload
      status,
      location,
      verified_purchase: verified,
      tags: "[]",
    };

    onSaveNew && onSaveNew(reviewData);
    onClose && onClose();
  };

  /* ============ VIEW MODE UI ============ */
  if (isViewMode && review) {
    const images = parseImages(review.images || "[]");

    return (
      <div className="reviews-modal-overlay">
        <div className="reviews-modal">
          <div className="reviews-modal__header">
            <h3 className="reviews-modal__title">Chi tiết đánh giá</h3>
            <button
              type="button"
              className="reviews-modal__close"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="reviews-modal__body">
            {/* Customer info */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 8 }}>Thông tin khách hàng</h4>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: 12,
                  background: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                <div
                  className="reviews-review-card__avatar"
                  style={{ width: 40, height: 40, fontSize: "1rem" }}
                >
                  {review.customer_avatar ? (
                    <img
                      src={review.customer_avatar}
                      alt={review.customer_name}
                    />
                  ) : (
                    getInitials(review.customer_name)
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {review.customer_name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#64748b",
                    }}
                  >
                    📍 {review.location} • 🕒 {formatDate(review.created_at)}{" "}
                    {review.verified_purchase && (
                      <span style={{ color: "#16a34a" }}>• ✓ Đã xác thực</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 8 }}>Đánh giá</h4>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: "1.25rem",
                    color: "#fbbf24",
                  }}
                >
                  {getStarRating(review.rating)}
                </span>
                <span style={{ fontWeight: 600 }}>{review.rating}/5</span>
                <span
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    color: "#3b82f6",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                  }}
                >
                  {review.target_name}
                </span>
              </div>
              <h5
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {review.title}
              </h5>
              <p
                style={{
                  lineHeight: 1.6,
                  color: "#64748b",
                }}
              >
                {review.content}
              </p>
            </div>

            {/* Images */}
            {images.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ marginBottom: 8 }}>Hình ảnh</h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 8,
                  }}
                >
                  {images.map((img) => (
                    <img
                      key={img}
                      src={img}
                      alt="Review"
                      style={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div>
              <h4 style={{ marginBottom: 8 }}>Thống kê</h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "#3b82f6",
                    }}
                  >
                    {review.likes}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                    }}
                  >
                    Lượt thích
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "#16a34a",
                    }}
                  >
                    {review.replies}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                    }}
                  >
                    Phản hồi
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "#f59e0b",
                    }}
                  >
                    {review.helpful_count}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                    }}
                  >
                    Hữu ích
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="reviews-modal__footer">
            <button
              className="reviews-btn reviews-btn-secondary"
              type="button"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ ADD MODE UI ============ */
  return (
    <div className="reviews-modal-overlay">
      <div className="reviews-modal">
        <div className="reviews-modal__header">
          <h3 className="reviews-modal__title">Thêm đánh giá mới</h3>
          <button
            type="button"
            className="reviews-modal__close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmitAdd}>
          <div className="reviews-modal__body">
            {/* Type */}
            <div className="reviews-modal__form-group">
              <label>Loại đánh giá</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setTargetId("");
                }}
              >
                <option value="">Chọn loại đánh giá</option>
                <option value="restaurant">Nhà hàng</option>
                <option value="food">Món ăn</option>
                <option value="service">Dịch vụ</option>
              </select>
            </div>

            {/* Target */}
            {type && (
              <div className="reviews-modal__form-group">
                <label>Chọn mục đánh giá</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">Chọn mục cụ thể</option>
                  {(targetOptions[type] || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Restaurant */}
            <div className="reviews-modal__form-group">
              <label>Nhà hàng</label>
              <select
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
              >
                <option value="">Chọn nhà hàng</option>
                <option value="foodhub_main">
                  FoodHub Restaurant - Chi nhánh chính
                </option>
                <option value="foodhub_district1">
                  FoodHub Restaurant - Quận 1
                </option>
                <option value="foodhub_district3">
                  FoodHub Restaurant - Quận 3
                </option>
                <option value="foodhub_hanoi">
                  FoodHub Restaurant - Hà Nội
                </option>
                <option value="foodhub_danang">
                  FoodHub Restaurant - Đà Nẵng
                </option>
              </select>
            </div>

            {/* Customer & location */}
            <div className="reviews-modal__form-group">
              <label>Tên khách hàng</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nhập tên khách hàng"
              />
            </div>

            <div className="reviews-modal__form-group">
              <label>Địa điểm</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Nhập địa điểm"
              />
            </div>

            {/* Rating */}
            <div className="reviews-modal__form-group">
              <label>Đánh giá (1–5 sao)</label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                <option value="">Chọn số sao</option>
                <option value="5">5 sao - Xuất sắc</option>
                <option value="4">4 sao - Tốt</option>
                <option value="3">3 sao - Trung bình</option>
                <option value="2">2 sao - Kém</option>
                <option value="1">1 sao - Rất kém</option>
              </select>
            </div>

            {/* Title & content */}
            <div className="reviews-modal__form-group">
              <label>Tiêu đề</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề đánh giá"
              />
            </div>

            <div className="reviews-modal__form-group">
              <label>Nội dung</label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung đánh giá chi tiết"
              />
            </div>

            {/* Status */}
            <div className="reviews-modal__form-group">
              <label>Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="published">Xuất bản ngay</option>
                <option value="pending">Chờ duyệt</option>
              </select>
            </div>

            {/* Verified */}
            <div className="reviews-modal__form-group">
              <label>
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Khách hàng đã xác thực
              </label>
            </div>

            {/* (Optional) Image upload khung UI – chưa xử lý upload */}
            <div className="reviews-modal__form-group">
              <label>Hình ảnh đánh giá</label>
              <div className="reviews-modal__image-upload">
                📷 Tính năng upload ảnh sẽ được bổ sung sau.
              </div>
            </div>
          </div>

          <div className="reviews-modal__footer">
            <button
              type="button"
              className="reviews-btn reviews-btn-secondary"
              onClick={onClose}
            >
              Hủy
            </button>
            <button type="submit" className="reviews-btn reviews-btn-primary">
              Lưu đánh giá
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
