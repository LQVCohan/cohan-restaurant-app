import React, { useMemo } from "react";
import { Clock, User, ChefHat, CheckCircle, Eye, Check, X } from "lucide-react";
import "./OrderCard.scss";

/* =======================================================
   1. Gộp món trùng (cộng dồn số lượng)
   ======================================================= */
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

/* =======================================================
   2. Helpers
   ======================================================= */
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

/* =======================================================
   3. Thành phần hiển thị
   ======================================================= */
const TimeWarningBadge = ({ createdAt }) => {
  const m = minutesSince(createdAt);
  if (m == null) return null;
  if (m >= 30) return <span className="timeWarning critical">🚨 {m}p</span>;
  if (m >= 20) return <span className="timeWarning danger">⚠️ {m}p</span>;
  if (m >= 10) return <span className="timeWarning warning">⏰ {m}p</span>;
  return <span className="orderTime">{m}p trước</span>;
};

const StatusBadge = ({ status }) => {
  const labelMap = {
    pending: "Chờ xác nhận",
    preparing: "Đang chuẩn bị",
    ready: "Sẵn sàng",
    served: "Đã phục vụ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  const key = status || "pending";
  return <span className={`statusBadge ${key}`}>{labelMap[key]}</span>;
};

const getOrderTypeIcon = (type) =>
  type === "takeaway" ? "🛍️" : type === "delivery" ? "🏍️" : "🪑";

/* =======================================================
   4. Main Component
   ======================================================= */
const OrderCard = ({ order, onUpdateStatus, onViewOrder, onViewItem }) => {
  const mergedItems = useMemo(
    () => mergeDuplicateItems(order?.items || []),
    [order?.items]
  );

  const totalItems = mergedItems.length;
  const pendingCount = mergedItems.filter(
    (it) => it.status === "pending"
  ).length;

  const restaurantId =
    order?.restaurantId || order?.restaurant?.id || undefined;

  const callUpdateStatus = (status) => {
    if (typeof onUpdateStatus !== "function") return;
    onUpdateStatus({
      orderId: order.id,
      restaurantId,
      status,
    });
  };

  const renderActionButtons = () => {
    const s = order?.currentStatus;
    switch (s) {
      case "pending":
        return (
          <>
            <button
              className="confirmButton"
              onClick={() => callUpdateStatus("preparing")}
            >
              <Check size={14} /> Bắt đầu
            </button>
            <button
              className="cancelButton"
              onClick={() => callUpdateStatus("cancelled")}
            >
              <X size={14} /> Hủy
            </button>
          </>
        );
      case "preparing":
        return (
          <button
            className="readyButton"
            onClick={() => callUpdateStatus("ready")}
          >
            <ChefHat size={14} /> Hoàn tất chế biến
          </button>
        );
      case "ready":
        // ✅ Nút "Hoàn thành" CHUYỂN sang trạng thái served
        return (
          <button
            className="confirmButton"
            onClick={() => callUpdateStatus("served")}
          >
            <CheckCircle size={14} /> Hoàn thành
          </button>
        );
      // Khi đã served rồi thì card sẽ biến mất khỏi màn này (FE/BE filter),
      // nên KHÔNG render nút cho trạng thái 'served' nữa.
      default:
        return null;
    }
  };

  return (
    <div className={`orderCard ${order?.currentStatus || ""}`}>
      {/* Header */}
      <div className="orderHeader">
        <div>
          <div className="orderTitle">
            {getOrderTypeIcon(order?.orderType)} {order?.tableCode || "Mang về"}{" "}
            <span className="orderId">
              #{String(order?.id || "").slice(-6)}
            </span>
          </div>
          <div className="orderUser">
            <User size={14} />
            <span>{order?.user?.fullName || "Khách lẻ"}</span>
          </div>
        </div>
        <TimeWarningBadge createdAt={order?.createdAt} />
      </div>

      {/* Status */}
      <div className="totalSection mb-2">
        <div className="totalLabel">
          {totalItems} món ({pendingCount} chờ)
        </div>
        <StatusBadge status={order?.currentStatus} />
      </div>

      {/* Items */}
      <div className="itemsSection">
        <div className="sectionTitle">
          <Clock size={16} />
          <span>Món</span>
        </div>
        <div className="itemsList">
          {mergedItems.slice(0, 3).map((item, idx) => (
            <div
              key={idx}
              className="itemCard"
              onClick={() =>
                onViewItem?.({
                  item,
                  orderInfo: { id: order.id, table: order.tableCode },
                })
              }
            >
              <div className="itemInfo">
                <div className="itemName">
                  <span className="quantity">{item.quantity}x</span>
                  <span>{item.name}</span>
                  {item.method && (
                    <span className="itemMethod"> ({item.method})</span>
                  )}
                </div>
                <div className="itemStatus">{item.status}</div>
              </div>
            </div>
          ))}
          {mergedItems.length > 3 && (
            <div className="itemMore">
              ... và {mergedItems.length - 3} món khác
            </div>
          )}
        </div>
      </div>

      {/* Tổng tiền */}
      <div className="totalSection">
        <div className="totalLabel">Tổng cộng</div>
        <div className="totalAmount">
          {formatCurrency(order?.totals?.grandTotal)}
        </div>
      </div>

      {/* Hành động */}
      <div className="actions">
        {renderActionButtons()}
        <button className="viewButton" onClick={() => onViewOrder?.(order)}>
          <Eye size={14} /> Xem chi tiết
        </button>
      </div>
    </div>
  );
};

export default OrderCard;
