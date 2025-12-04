import React, { useMemo } from "react";
import {
  Clock,
  User,
  ChefHat,
  CheckCircle,
  X,
  Check,
  MoreHorizontal,
} from "lucide-react";
import "./OrderCard.scss";

/* =================================================================================
   1. HELPERS
   ================================================================================= */

const mergeDuplicateItems = (items = []) => {
  const merged = new Map();
  for (const it of items) {
    const key = `${it.dishId || it.name}_${it.method || ""}_${it.unit || ""}`;
    if (!merged.has(key)) merged.set(key, { ...it });
    else {
      const prev = merged.get(key);
      prev.quantity = Number(prev.quantity || 0) + Number(it.quantity || 0);
      prev.lineSubtotal =
        (Number(prev.price || 0) + Number(prev.modifiersPrice || 0)) *
        prev.quantity;
      merged.set(key, prev);
    }
  }
  return [...merged.values()];
};

const formatCurrency = (v) =>
  (Number(v) || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  });

const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && "$date" in v) return parseDate(v.$date);
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000);
  if (typeof v === "string" && /^\d+$/.test(v.trim()))
    return new Date(Number(v) > 1e12 ? Number(v) : Number(v) * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const minutesSince = (createdAt) => {
  const dt = parseDate(createdAt);
  if (!dt) return null;
  return Math.floor((Date.now() - dt.getTime()) / 60000);
};

/* =================================================================================
   2. SUB-COMPONENTS
   ================================================================================= */

const TimeBadge = ({ minutes }) => {
  if (minutes == null) return null;

  let statusClass = "normal";
  if (minutes >= 30) statusClass = "critical";
  else if (minutes >= 20) statusClass = "danger";
  else if (minutes >= 10) statusClass = "warning";

  return (
    <div className={`saas-badge time-badge ${statusClass}`}>
      <Clock size={12} strokeWidth={2.5} />
      <span>{minutes}p</span>
    </div>
  );
};

/* =================================================================================
   3. MAIN COMPONENT
   ================================================================================= */
const OrderCard = ({
  order,
  onUpdateStatus, // (orderId, newStatus) => void
  onViewOrder,
  isFocusMode = false,
}) => {
  const mergedItems = useMemo(
    () => mergeDuplicateItems(order?.items || []),
    [order?.items]
  );
  const ageMinutes = minutesSince(order?.createdAt);

  const MAX_ITEMS = isFocusMode ? 999 : 3;
  const visibleItems = mergedItems.slice(0, MAX_ITEMS);
  const remainCount = Math.max(0, mergedItems.length - MAX_ITEMS);

  const customerName =
    order?.customerInfo?.name || order?.user?.fullName || "Khách lẻ";

  // --- HÀM XỬ LÝ SỰ KIỆN QUAN TRỌNG ---
  const handleAction = (e, status) => {
    e.stopPropagation(); // Ngăn click xuyên qua card
    if (onUpdateStatus) {
      // Gọi hàm update được truyền từ cha
      onUpdateStatus(order.id, status);
    }
  };

  // --- RENDER NÚT BẤM THEO TRẠNG THÁI ---
  const renderActions = () => {
    const status = order?.currentStatus;

    switch (status) {
      case "pending": // KHÁCH MỚI ĐẶT -> CẦN XÁC NHẬN
        return (
          <div className="card-actions two-btn">
            {/* Nút Hủy */}
            <button
              className="btn-secondary btn-cancel"
              onClick={(e) => handleAction(e, "cancelled")}
            >
              Hủy
            </button>

            {/* Nút Xác nhận đơn hàng -> Chuyển sang preparing */}
            <button
              className="btn-primary"
              onClick={(e) => handleAction(e, "preparing")}
            >
              <Check size={16} /> Xác nhận đơn hàng
            </button>
          </div>
        );

      case "preparing": // ĐANG CHẾ BIẾN -> CẦN BÁO XONG
        return (
          <div className="card-actions">
            <button
              className="btn-success"
              onClick={(e) => handleAction(e, "ready")}
            >
              <ChefHat size={16} /> Báo xong món
            </button>
          </div>
        );

      case "ready": // ĐÃ XONG -> CHỜ PHỤC VỤ / KHÁCH LẤY
        return (
          <div className="card-actions">
            <button
              className="btn-primary"
              onClick={(e) => handleAction(e, "served")}
            >
              <CheckCircle size={16} /> Đã phục vụ
            </button>
          </div>
        );

      case "served":
        return (
          <div className="card-status-text text-blue">
            <CheckCircle size={14} /> Đã phục vụ
          </div>
        );

      case "cancelled":
        return (
          <div className="card-status-text text-red">
            <X size={14} /> Đã hủy
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`saas-card ${isFocusMode ? "focus-mode" : ""} ${
        order?.currentStatus || ""
      }`}
      onClick={() => onViewOrder?.(order)}
    >
      {/* HEADER */}
      <div className="card-header">
        <div className="header-left">
          <div
            className={`table-badge ${
              order?.orderType === "takeaway" ? "takeaway" : ""
            }`}
          >
            {order?.orderType === "takeaway" ? (
              <>🥡 Mang về</>
            ) : (
              <>{order?.tableCode || "—"}</>
            )}
          </div>
          <div className="order-id">#{String(order?.id || "").slice(-5)}</div>
        </div>
        <TimeBadge minutes={ageMinutes} />
      </div>

      {/* GUEST INFO */}
      <div className="guest-info">
        <div className="guest-row">
          <User size={14} className="icon" />
          <span className="guest-name truncate">{customerName}</span>
        </div>
      </div>

      {/* ITEM LIST */}
      <div className="items-container">
        {visibleItems.map((item, idx) => {
          const isItemDone =
            item.status === "ready" || item.status === "served";
          return (
            <div
              key={`${item.dishId}_${idx}`}
              className={`item-row ${isItemDone ? "done" : ""}`}
            >
              <div className="item-qty">{item.quantity}</div>
              <div className="item-details">
                <span className="item-name">{item.name}</span>
                {item.method && (
                  <span className="item-method">({item.method})</span>
                )}
              </div>
            </div>
          );
        })}
        {remainCount > 0 && (
          <div className="more-items">
            <MoreHorizontal size={14} />
            <span>còn {remainCount} món khác...</span>
          </div>
        )}
        {mergedItems.length === 0 && (
          <div className="empty-items">Chưa có món</div>
        )}
      </div>

      {/* FOOTER & ACTIONS */}
      <div className="card-footer-wrapper">
        <div className="card-total-row">
          <span className="label">Tổng cộng</span>
          <span className="value">
            {formatCurrency(order?.totals?.grandTotal)}
          </span>
        </div>

        {/* Khu vực hiển thị nút Xác nhận / Hoàn thành */}
        {renderActions()}
      </div>
    </div>
  );
};

export default OrderCard;
