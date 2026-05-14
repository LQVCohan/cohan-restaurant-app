import React, { useContext } from "react";
import {
  Calendar,
  Clock,
  Copy,
  Edit2,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasPermission,
  NO_PERMISSION_MESSAGE,
} from "@/utils/frontendPermissionAccess";

import "./PromotionCard.scss";

const formatDate = (dateString) => {
  if (!dateString) return "--/--";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPromotionValue = (promotion) => {
  if (promotion.type === "bogo") {
    return {
      value: `Mua ${promotion.buyQuantity || 1}`,
      unit: `tặng ${promotion.getQuantity || 1}`,
      hint: promotion.giftItemId ? "Món tặng đã gắn item" : "",
    };
  }

  if (promotion.type === "freeship") {
    return {
      value: "Free",
      unit: "ship",
      hint: "",
    };
  }

  if (promotion.type === "percentage") {
    return {
      value: Number(promotion.discountValue || 0),
      unit: "%",
      hint: promotion.maxDiscount
        ? `(Max ${Number(promotion.maxDiscount).toLocaleString("vi-VN")}đ)`
        : "",
    };
  }

  return {
    value: Number(promotion.discountValue || 0).toLocaleString("vi-VN"),
    unit: "đ",
    hint: "",
  };
};

const getStatusInfo = (promotion) => {
  const now = new Date();
  const start = promotion.startDate ? new Date(promotion.startDate) : null;
  const end = promotion.endDate ? new Date(promotion.endDate) : null;

  if (promotion.status === "draft") {
    return { class: "draft", label: "Nháp" };
  }
  if (end && now > end) {
    return { class: "expired", label: "Hết hạn" };
  }
  if (start && now < start) {
    return { class: "draft", label: "Sắp chạy" };
  }
  return { class: "active", label: "Đang chạy" };
};

const PromotionCard = ({ promotion, onEdit, onDelete, onDuplicate }) => {
  const { user } = useContext(AuthContext);
  const status = getStatusInfo(promotion);
  const discount = formatPromotionValue(promotion);
  const canWritePromotion = hasPermission(user, "promotion.write");
  const actionTitle = canWritePromotion ? undefined : NO_PERMISSION_MESSAGE;

  const runWriteAction = (event, action) => {
    event.stopPropagation();
    if (!canWritePromotion) return;
    action?.();
  };

  return (
    <div className="promotion-card">
      <div className="card-actions">
        <button
          className="action-btn duplicate"
          onClick={(event) => runWriteAction(event, onDuplicate)}
          disabled={!canWritePromotion}
          title={actionTitle || "Nhân bản"}
        >
          <Copy size={16} />
        </button>
        <button
          className="action-btn edit"
          onClick={(event) => runWriteAction(event, onEdit)}
          disabled={!canWritePromotion}
          title={actionTitle || "Chỉnh sửa"}
        >
          <Edit2 size={16} />
        </button>
        <button
          className="action-btn delete"
          onClick={(event) => runWriteAction(event, onDelete)}
          disabled={!canWritePromotion}
          title={actionTitle || "Xóa"}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {!canWritePromotion ? (
        <p className="text-xs text-secondary" title={NO_PERMISSION_MESSAGE}>
          {NO_PERMISSION_MESSAGE}
        </p>
      ) : null}

      <div className="card-header">
        <span className={`status-badge ${status.class}`}>{status.label}</span>
      </div>

      <div className="card-body">
        <div className="discount-highlight">
          <span className="value">{discount.value}</span>
          <span className="unit">{discount.unit}</span>
          {discount.hint && <span className="max-discount-hint">{discount.hint}</span>}
        </div>

        <h3 className="promo-title" title={promotion.name}>
          {promotion.name}
        </h3>

        <div
          className="code-container"
          onClick={() => {
            navigator.clipboard.writeText(promotion.code);
          }}
        >
          <Tag className="code-icon" size={14} />
          <span className="promo-code">{promotion.code}</span>
        </div>
      </div>

      <div className="card-info">
        <div className="info-row">
          <Calendar size={14} />
          <span>
            {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
          </span>
        </div>

        {status.class === "active" && (
          <div className="info-row">
            <Clock size={14} />
            <span>Kết thúc lúc {formatTime(promotion.endDate)}</span>
          </div>
        )}

        <div className="info-row">
          <Users size={14} />
          <span>
            Đã dùng: <b>{promotion.usageCount || 0}</b>
            <span className="separator">/</span>
            {promotion.usageLimit || "∞"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromotionCard;