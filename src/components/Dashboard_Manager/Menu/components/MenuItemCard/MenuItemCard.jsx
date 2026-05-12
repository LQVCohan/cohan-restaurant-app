import React, { useState } from "react";
import {
  Edit3,
  Trash2,
  Utensils,
  ImageOff,
  MoreHorizontal,
} from "lucide-react";
import "./MenuItemCard.scss";

const STATUS_META = {
  available: {
    label: "Sẵn sàng",
    className: "available",
  },
  out_of_stock: {
    label: "Hết hàng",
    className: "out-of-stock",
  },
  unavailable: {
    label: "Tạm dừng",
    className: "unavailable",
  },
  hidden: {
    label: "Ẩn khỏi menu",
    className: "hidden",
  },
};

const MenuItemCard = ({ item, onEdit, onDelete }) => {
  const [imgError, setImgError] = useState(false);

  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(price || 0));

  const rawOrderCounter = item?.orderCounter;
  const hasSoldCount =
    rawOrderCounter !== null &&
    rawOrderCounter !== undefined &&
    Number.isFinite(Number(rawOrderCounter));
  const soldCount = hasSoldCount ? Number(rawOrderCounter) : null;
  const variants = Array.isArray(item.servingVariants) ? item.servingVariants : [];
  const visibleMethods = variants.slice(0, 3);
  const remainingCount = Math.max(0, variants.length - 3);
  const statusMeta = STATUS_META[item?.status] || STATUS_META.unavailable;

  const renderImage = () => {
    if (item.thumbImage && !imgError) {
      return (
        <img
          src={item.thumbImage}
          alt={item.name}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      );
    }
    return (
      <div className="placeholder-img">
        {item.status === "out_of_stock" ? (
          <ImageOff size={28} />
        ) : (
          <Utensils size={28} />
        )}
      </div>
    );
  };

  const renderStatusBadge = () => {
    return (
      <div className={`status-badge ${statusMeta.className}`}>
        {statusMeta.label}
      </div>
    );
  };

  return (
    <div className="menu-item-card" onClick={onEdit}>
      <div className="card-image-wrapper">
        {renderImage()}
        <div className="badge-wrapper">{renderStatusBadge()}</div>
        {hasSoldCount && (
          <div className="sales-overlay">
            <div className="sales-stat">
              <div className="stat-info">
                <span className="label">Đã bán</span>
                <span className="value">{soldCount} phần</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card-body">
        <div className="info-top">
          <span className="category-name">
            {item.categoryName || item.categoryId || "Danh mục món"}
          </span>
          <h3 className="item-name" title={item.name}>
            {item.name}
          </h3>
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
                <span className="price">{formatPrice(item.basePrice || 0)}</span>
              </div>
            ) : (
              visibleMethods.map((m) => (
                <div key={m.key || m.name} className="variant-row">
                  <span className="v-name">{m.name || m.key}</span>
                  <div className="dotted-line"></div>
                  <span className="v-price">{formatPrice(m.price)}</span>
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

      <div className="card-actions">
        <button
          className="action-btn edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          title="Chỉnh sửa món & biến thể"
        >
          <Edit3 size={16} /> <span>Chỉnh sửa</span>
        </button>
        <div className="divider"></div>
        <button
          className="action-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Xóa món ăn"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default MenuItemCard;
