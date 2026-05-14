import React, { useState } from "react";
import { Edit3, Trash2, Utensils, ImageOff, MoreHorizontal } from "lucide-react";
import "./MenuItemCard.scss";

const STATUS_META = {
  available: { label: "Sẵn sàng", className: "available" },
  out_of_stock: { label: "Hết hàng", className: "out-of-stock" },
  unavailable: { label: "Tạm dừng", className: "unavailable" },
  hidden: { label: "Ẩn khỏi menu", className: "hidden" },
};

const STATUS_OPTIONS = [
  { value: "available", label: "Sẵn sàng" },
  { value: "out_of_stock", label: "Hết hàng" },
  { value: "unavailable", label: "Tạm dừng" },
  { value: "hidden", label: "Ẩn khỏi menu" },
];

const MenuItemCard = ({
  item,
  onEdit,
  onDelete,
  onStatusChange,
  isStatusUpdating = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const variants = Array.isArray(item?.servingVariants) ? item.servingVariants : [];
  const visibleMethods = variants.slice(0, 3);
  const remainingCount = Math.max(0, variants.length - 3);
  const statusMeta = STATUS_META[item?.status] || STATUS_META.unavailable;
  const hasActions = onEdit || onDelete || onStatusChange;

  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(price || 0));

  return (
    <div className="menu-item-card" onClick={onEdit || undefined}>
      <div className="card-image-wrapper">
        {item?.thumbImage && !imgError ? (
          <img
            src={item.thumbImage}
            alt={item.name}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="placeholder-img">
            {item?.status === "out_of_stock" ? <ImageOff size={28} /> : <Utensils size={28} />}
          </div>
        )}
        <div className="badge-wrapper">
          <div className={`status-badge ${statusMeta.className}`}>{statusMeta.label}</div>
        </div>
      </div>

      <div className="card-body">
        <div className="info-top">
          <span className="category-name">
            {item?.categoryName || item?.categoryId || "Danh mục món"}
          </span>
          <h3 className="item-name" title={item?.name}>{item?.name}</h3>
        </div>

        <div className="variants-list">
          <div className="list-header">
            <span>Biến thể ({variants.length || 1})</span>
            <span>Giá bán</span>
          </div>
          <div className="list-content">
            {variants.length === 0 ? (
              <div className="variant-row single">
                <span>Giá cơ bản</span>
                <span className="price">{formatPrice(item?.basePrice || 0)}</span>
              </div>
            ) : (
              visibleMethods.map((method) => (
                <div key={method.key || method.name} className="variant-row">
                  <span className="v-name">{method.name || method.key}</span>
                  <div className="dotted-line"></div>
                  <span className="v-price">{formatPrice(method.price)}</span>
                </div>
              ))
            )}
            {remainingCount > 0 && (
              <div className="variant-more">
                <MoreHorizontal size={14} />
                <span>Và {remainingCount} biến thể khác...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasActions && (
        <div className="card-actions">
          {onStatusChange && (
            <select
              className="status-action-select"
              value={item?.status || "available"}
              disabled={isStatusUpdating}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onStatusChange(event.target.value)}
              title="Đổi trạng thái món"
              aria-label="Đổi trạng thái món"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          {onEdit && (
            <button
              className="action-btn edit"
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.();
              }}
              title="Chỉnh sửa món & biến thể"
            >
              <Edit3 size={16} /> <span>Chỉnh sửa</span>
            </button>
          )}
          {onDelete && (
            <button
              className="action-btn delete"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.();
              }}
              title="Xóa món ăn"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MenuItemCard;
