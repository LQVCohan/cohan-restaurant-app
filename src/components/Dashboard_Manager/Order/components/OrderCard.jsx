import React from "react";
import { Clock, User, ChefHat, CheckCircle, Eye, Check, X } from "lucide-react";
import "./OrderCard.scss";

// TÍNH TOÁN SỐ LƯỢNG MÓN
const getItemCounts = (items = []) => {
  const totalItems = items.length;
  const pendingCount = items.filter((item) => item.status === "pending").length;
  const confirmedCount = items.filter(
    (item) => item.status === "confirmed"
  ).length;
  const completedCount = items.filter(
    (item) => item.status === "completed"
  ).length;
  return { totalItems, pendingCount, confirmedCount, completedCount };
};

// ĐỊNH DẠNG TIỀN TỆ
const formatCurrency = (amount) => {
  if (typeof amount !== "number") return "0";
  return amount.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
};

// Cảnh báo theo thời gian tạo
const getAlertClass = (createdAt) => {
  if (!createdAt) return "";
  const now = new Date();
  const time = new Date(createdAt);
  const timeDiff = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

  if (timeDiff >= 30) return "alertCritical";
  if (timeDiff >= 20) return "alertWarning";
  return "";
};
const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  // Mongo/Java object dạng {$date: ...}
  if (typeof v === "object" && "$date" in v) return parseDate(v.$date);

  // number hoặc chuỗi số
  if (
    typeof v === "number" ||
    (typeof v === "string" && /^\d+$/.test(v.trim()))
  ) {
    const n = Number(v);
    const ms = n > 1e12 ? n : n * 1000; // seconds -> ms
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const minutesSince = (createdAt) => {
  const dt = parseDate(createdAt);
  if (!dt) return null;
  const diffMs = Date.now() - dt.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};
// Badge cảnh báo thời gian
const TimeWarningBadge = ({ createdAt }) => {
  const m = minutesSince(createdAt);
  if (m == null) return null; // ẩn badge nếu không parse được
  if (m >= 30) return <span className="timeWarning critical">🚨 {m}p</span>;
  if (m >= 20) return <span className="timeWarning danger">⚠️ {m}p</span>;
  if (m >= 10) return <span className="timeWarning warning">⏰ {m}p</span>;
  return <span className="orderTime">{m}p trước</span>;
};

// Badge trạng thái đơn
const StatusBadge = ({ status }) => {
  const mapLabel = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    preparing: "Đang chuẩn bị",
    ready: "Sẵn sàng",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  const key = status || "pending";
  return (
    <span className={`statusBadge ${key}`}>
      {mapLabel[key] || mapLabel.pending}
    </span>
  );
};

// Biểu tượng loại order
const getOrderTypeIcon = (type) => {
  switch (type) {
    case "dine_in":
      return "🪑";
    case "takeaway":
      return "🛍️";
    case "delivery":
      return "🏍️";
    default:
      return "🪑";
  }
};

const OrderCard = ({ order, onUpdateStatus, onViewOrder, onViewItem }) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const { totalItems, pendingCount } = getItemCounts(items);
  const alertClass = getAlertClass(order?.createdAt);

  const renderActionButtons = () => {
    const s = order?.currentStatus;
    if (s === "pending") {
      return (
        <>
          <button
            className="confirmButton"
            onClick={() => onUpdateStatus(order.id, "confirmed")}
          >
            <Check size={14} /> Xác nhận
          </button>
          <button
            className="cancelButton"
            onClick={() => onUpdateStatus(order.id, "cancelled")}
          >
            <X size={14} /> Hủy
          </button>
        </>
      );
    }
    if (s === "confirmed") {
      return (
        <button
          className="prepareButton"
          onClick={() => onUpdateStatus(order.id, "preparing")}
        >
          <ChefHat size={14} /> Chuẩn bị
        </button>
      );
    }
    if (s === "preparing") {
      return (
        <button
          className="readyButton"
          onClick={() => onUpdateStatus(order.id, "ready")}
        >
          <CheckCircle size={14} /> Sẵn sàng
        </button>
      );
    }
    if (s === "ready") {
      return (
        <button
          className="confirmButton"
          onClick={() => onUpdateStatus(order.id, "completed")}
        >
          <Check size={14} /> Hoàn thành
        </button>
      );
    }
    return null;
  };

  return (
    <div className={`orderCard ${alertClass}`}>
      {/* Header */}
      <div className="orderHeader">
        <div>
          <div className="orderTitle">
            {getOrderTypeIcon(order?.orderType)} {order?.tableCode}{" "}
            <span style={{ color: "#6b7280", fontWeight: 400 }}>
              | #{String(order?.id || "").slice(-6)}
            </span>
          </div>
          <div className="orderTime">
            <User size={14} />
            <span>{order?.user?.fullName || "Khách lẻ"}</span>
          </div>
        </div>

        <div className="orderTime">
          <TimeWarningBadge createdAt={order?.createdAt} />
        </div>
      </div>

      {/* Status line */}
      <div className="totalSection" style={{ marginBottom: "1rem" }}>
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
          {items.slice(0, 3).map((item, idx) => (
            <div
              key={idx}
              className="itemCard"
              onClick={() =>
                onViewItem({
                  item,
                  orderInfo: { id: order.id, table: order.tableCode },
                })
              }
            >
              <div className="itemInfo">
                <div className="itemName">
                  <span className="quantity">{item.quantity}x</span>
                  <span>{item.name}</span>
                </div>
                <div className="itemStatus">
                  {item.status === "pending" ? "Đang chờ" : item.status}
                </div>
              </div>
              <div className="itemMeta">
                <div className="statusIcon">
                  {item.status === "pending" && <Clock size={12} />}
                </div>
              </div>
            </div>
          ))}

          {items.length > 3 && (
            <div className="itemStatus" style={{ textAlign: "center" }}>
              ... và {items.length - 3} món khác
            </div>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="totalSection">
        <div className="totalLabel">Tổng cộng</div>
        <div className="totalAmount">
          {formatCurrency(order?.totals?.grandTotal)}
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        {renderActionButtons()}
        <button className="viewButton" onClick={() => onViewOrder(order)}>
          <Eye size={14} /> Xem chi tiết
        </button>
      </div>
    </div>
  );
};

export default OrderCard;
