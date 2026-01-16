import React, { useState } from "react";
import {
  Edit3,
  Trash2,
  Utensils,
  TrendingUp,
  ImageOff,
  MoreHorizontal,
} from "lucide-react";
import "./MenuItemCard.scss";

const MenuItemCard = ({ item, onEdit, onDelete }) => {
  const [imgError, setImgError] = useState(false);

  // --- HELPER: Format Price ---
  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);

  // --- DATA PROCESSING ---
  // Giả lập số liệu bán hàng nếu API chưa có (bạn thay bằng item.soldCount thực tế)
  const soldCount = item.soldCount || Math.floor(Math.random() * 500) + 50;

  const methods = Array.isArray(item.methods) ? item.methods : [];
  // Chỉ hiển thị tối đa 3 biến thể để giữ card gọn gàng
  const visibleMethods = methods.slice(0, 3);
  const remainingCount = methods.length - 3;

  // --- RENDERERS ---
  const renderImage = () => {
    if (item.image && !imgError) {
      return (
        <img
          src={item.image}
          alt={item.name}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      );
    }
    return (
      <div className="placeholder-img">
        {item.category === "Đồ uống" ? (
          <ImageOff size={28} />
        ) : (
          <Utensils size={28} />
        )}
      </div>
    );
  };

  const renderStatusBadge = () => {
    const isAvailable = item.status === "available";
    return (
      <div
        className={`status-badge ${isAvailable ? "available" : "unavailable"}`}
      >
        {isAvailable ? "Sẵn sàng" : "Hết hàng"}
      </div>
    );
  };

  return (
    <div className="menu-item-card" onClick={onEdit}>
      {/* --- PHẦN 1: HÌNH ẢNH & OVERLAY SỐ LƯỢNG BÁN --- */}
      <div className="card-image-wrapper">
        {renderImage()}

        {/* Badge trạng thái (Luôn hiện) */}
        <div className="badge-wrapper">{renderStatusBadge()}</div>

        {/* Overlay thống kê (Hiện khi Hover) */}
        <div className="sales-overlay">
          <div className="sales-stat">
            <div className="icon-circle">
              <TrendingUp size={20} />
            </div>
            <div className="stat-info">
              <span className="label">Đã bán tháng này</span>
              <span className="value">{soldCount} phần</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- PHẦN 2: THÔNG TIN CHÍNH --- */}
      <div className="card-body">
        <div className="info-top">
          <span className="category-name">{item.category}</span>
          <h3 className="item-name" title={item.name}>
            {item.name}
          </h3>
        </div>

        {/* --- PHẦN 3: DANH SÁCH BIẾN THỂ & GIÁ --- */}
        <div className="variants-list">
          <div className="list-header">
            <span>Biến thể ({methods.length})</span>
            <span>Giá bán</span>
          </div>

          <div className="list-content">
            {methods.length === 0 ? (
              // Trường hợp không có biến thể (Món đơn)
              <div className="variant-row single">
                <span>Giá cơ bản</span>
                <span className="price">
                  {formatPrice(item.basePrice || 0)}
                </span>
              </div>
            ) : (
              // Có biến thể
              visibleMethods.map((m, idx) => (
                <div key={idx} className="variant-row">
                  <span className="v-name">{m.name}</span>
                  <div className="dotted-line"></div>
                  <span className="v-price">{formatPrice(m.price)}</span>
                </div>
              ))
            )}

            {/* Hiển thị số lượng còn dư nếu > 3 */}
            {remainingCount > 0 && (
              <div className="variant-more">
                <MoreHorizontal size={14} />
                <span>Và {remainingCount} biến thể khác...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- PHẦN 4: ACTIONS FOOTER --- */}
      <div className="card-actions">
        <button
          className="action-btn edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit && onEdit();
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
            onDelete && onDelete();
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
