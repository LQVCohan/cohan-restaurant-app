import React from "react";
import { Calendar, Copy, Edit2, Tag, Trash2, Users, Clock } from "lucide-react";
import "./PromotionCard.scss"; // Đảm bảo import file SCSS vừa tạo

const PromotionCard = ({ promotion, onEdit, onDelete, onDuplicate }) => {
  // --- 1. Helper Functions ---

  // Định dạng ngày: DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "--/--";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Định dạng giờ: HH:MM
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Định dạng giá trị giảm (VD: 50% hoặc 50.000)
  const formatDiscount = (value, type) => {
    if (type === "percent") {
      return { value: value, unit: "%" };
    }
    // Nếu là tiền mặt, format số (VD: 50000 -> 50.000)
    return { value: value.toLocaleString("vi-VN"), unit: "đ" };
  };

  // Tính toán trạng thái hiển thị
  const getStatusInfo = () => {
    const now = new Date();
    const start = new Date(promotion.startDate);
    const end = new Date(promotion.endDate);

    if (promotion.status === "draft") {
      return { class: "draft", label: "Nháp" };
    }
    if (now > end) {
      return { class: "expired", label: "Hết hạn" };
    }
    if (now < start) {
      return { class: "draft", label: "Sắp chạy" }; // Tận dụng style màu xám
    }
    return { class: "active", label: "Đang chạy" };
  };

  const status = getStatusInfo();
  const discount = formatDiscount(promotion.discountValue, promotion.type);

  return (
    <div className="promotion-card">
      {/* --- FLOATING ACTIONS (Hiện khi hover) --- */}
      <div className="card-actions">
        <button
          className="action-btn duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Nhân bản"
        >
          <Copy size={16} />
        </button>
        <button
          className="action-btn edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Chỉnh sửa"
        >
          <Edit2 size={16} />
        </button>
        <button
          className="action-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Xóa"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* --- HEADER: Status Badge --- */}
      <div className="card-header">
        <span className={`status-badge ${status.class}`}>{status.label}</span>
      </div>

      {/* --- BODY: Main Content --- */}
      <div className="card-body">
        {/* Discount Value Highlighting */}
        <div className="discount-highlight">
          <span className="value">{discount.value}</span>
          <span className="unit">{discount.unit}</span>
          {promotion.type === "percent" && promotion.maxDiscount && (
            <span className="max-discount-hint">
              (Max {promotion.maxDiscount.toLocaleString()}đ)
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="promo-title" title={promotion.name}>
          {promotion.name}
        </h3>

        {/* Code Box */}
        <div
          className="code-container"
          onClick={() => {
            navigator.clipboard.writeText(promotion.code);
            // Có thể thêm toast notification ở đây nếu muốn
          }}
        >
          <Tag size={14} className="code-icon" />
          <span className="promo-code">{promotion.code}</span>
        </div>
      </div>

      {/* --- FOOTER: Metadata --- */}
      <div className="card-info">
        {/* Date Range */}
        <div className="info-row">
          <Calendar size={14} />
          <span>
            {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
          </span>
        </div>

        {/* Time Detail (Optional, chỉ hiện nếu cần chi tiết) */}
        {status.class === "active" && (
          <div className="info-row">
            <Clock size={14} />
            <span>Kết thúc lúc {formatTime(promotion.endDate)}</span>
          </div>
        )}

        {/* Usage Stats */}
        <div className="info-row">
          <Users size={14} />
          <span>
            Đã dùng: <b>{promotion.usageCount || 0}</b>
            <span className="separator">/</span>
            {promotion.usageLimit ? promotion.usageLimit : "∞"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromotionCard;
