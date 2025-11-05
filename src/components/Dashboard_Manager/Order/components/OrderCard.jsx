import React from "react";
import {
  Clock,
  User,
  ChefHat,
  CheckCircle,
  AlertTriangle,
  Eye,
  Check,
  X,
} from "lucide-react";

// TÍNH TOÁN SỐ LƯỢNG MÓN
const getItemCounts = (items) => {
  // Logic này giờ sẽ chạy đúng vì GQL 'items' đã có 'status'
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
  return amount.toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });
};

const OrderCard = ({ order, onUpdateStatus, onViewOrder, onViewItem }) => {
  // Get alert class and priority
  const getOrderAlertClass = (createdAt) => {
    if (!createdAt) return "";
    const now = new Date();
    const time = new Date(createdAt); // <-- SỬA: Dùng createdAt
    const timeDiff = Math.floor((now - time) / (1000 * 60));

    if (timeDiff >= 30) return "border-l-4 border-red-600 bg-red-50";
    if (timeDiff >= 20) return "border-l-4 border-red-500 bg-red-50";
    if (timeDiff >= 10) return "border-l-4 border-yellow-500 bg-yellow-50";
    return "border-l-4 border-gray-200";
  };

  // Get time warning badge
  const getTimeWarningBadge = (createdAt) => {
    if (!createdAt) return null;
    const now = new Date();
    const time = new Date(createdAt); // <-- SỬA: Dùng createdAt
    const timeDiff = Math.floor((now - time) / (1000 * 60));

    if (timeDiff >= 30) {
      return (
        <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold animate-pulse">
          🚨 {timeDiff}p
        </span>
      );
    } else if (timeDiff >= 20) {
      return (
        <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
          ⚠️ {timeDiff}p
        </span>
      );
    } else if (timeDiff >= 10) {
      return (
        <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-semibold">
          ⏰ {timeDiff}p
        </span>
      );
    }
    return <span className="text-gray-500 text-xs">{timeDiff}p trước</span>;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    // SỬA: Dùng currentStatus
    const statusConfig = {
      pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Chờ xác nhận",
      },
      confirmed: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Đã xác nhận",
      },
      preparing: {
        bg: "bg-purple-100",
        text: "text-purple-800",
        label: "Đang chuẩn bị",
      },
      ready: { bg: "bg-green-100", text: "text-green-800", label: "Sẵn sàng" },
      completed: {
        bg: "bg-green-100",
        text: "text-green-800",
        label: "Hoàn thành",
      },
      cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Đã hủy" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  // Get table icon
  const getTableIcon = (type) => {
    // SỬA: Dùng orderType và "dine_in"
    switch (type) {
      case "dine_in": // <-- SỬA: Đổi "table" thành "dine_in"
        return "🪑";
      case "takeaway":
        return "🛍️";
      case "delivery":
        return "🏍️";
      default:
        return "🪑";
    }
  };

  // Get action buttons
  const getActionButtons = () => {
    const buttons = [];
    switch (
      order.currentStatus // <-- SỬA: Dùng currentStatus
    ) {
      case "pending":
        buttons.push(
          <button
            key="confirm"
            onClick={() => onUpdateStatus(order.id, "confirmed")}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
          >
            <Check size={14} /> Xác nhận
          </button>
        );
        buttons.push(
          <button
            key="cancel"
            onClick={() => onUpdateStatus(order.id, "cancelled")}
            className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
          >
            <X size={14} /> Hủy
          </button>
        );
        break;
      case "confirmed":
        buttons.push(
          <button
            key="prepare"
            onClick={() => onUpdateStatus(order.id, "preparing")}
            className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
          >
            <ChefHat size={14} /> Chuẩn bị
          </button>
        );
        break;
      case "preparing":
        buttons.push(
          <button
            key="ready"
            onClick={() => onUpdateStatus(order.id, "ready")}
            className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle size={14} /> Sẵn sàng
          </button>
        );
        break;
      case "ready":
        buttons.push(
          <button
            key="complete"
            onClick={() => onUpdateStatus(order.id, "completed")}
            className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
          >
            <Check size={14} /> Hoàn thành
          </button>
        );
        break;
      default:
        break;
    }
    return buttons;
  };

  // --- Lấy dữ liệu đã được GQL cung cấp ---
  const { totalItems, pendingCount } = getItemCounts(order.items || []);
  const alertClass = getOrderAlertClass(order.createdAt); // <-- SỬA
  const timeWarningBadge = getTimeWarningBadge(order.createdAt); // <-- SỬA
  const statusBadge = getStatusBadge(order.currentStatus); // <-- SỬA
  const actionButtons = getActionButtons();

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 transition-all hover:shadow-md ${alertClass}`}
    >
      {/* Header Card */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-700">
              {getTableIcon(order.orderType)} {order.tableCode}{" "}
              {/* <-- SỬA: Dùng orderType và tableCode */}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-sm text-gray-500 font-mono">
              #{order.id.slice(-6)}
            </span>
          </div>
          {timeWarningBadge}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User size={14} className="text-gray-500" />
          {/* SỬA: Dùng user.fullName */}
          <span>{order.user?.fullName || "Khách lẻ"}</span>
        </div>
      </div>

      {/* Body Card */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">{totalItems} món</span>
          {statusBadge}
        </div>
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            Món ({pendingCount} chờ)
          </h4>
          <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
            {/* Logic này giờ sẽ chạy đúng vì 'order.items' đã có 'status' */}
            {(order.items || []).slice(0, 3).map((item, index) => (
              <div
                key={index}
                onClick={() =>
                  onViewItem({
                    item,
                    orderInfo: { id: order.id, table: order.tableCode }, // <-- SỬA
                  })
                }
                className="flex justify-between items-center text-sm p-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <span className="text-gray-700 truncate">
                  <span className="font-medium text-blue-600">
                    {item.quantity}x
                  </span>{" "}
                  {item.name}
                </span>
                {item.status === "pending" && (
                  <Clock size={12} className="text-yellow-500" />
                )}
              </div>
            ))}
            {order.items.length > 3 && (
              <div className="text-xs text-gray-500 text-center mt-1">
                ... và {order.items.length - 3} món khác
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
          <span className="text-lg font-bold text-gray-800">
            {/* SỬA: Dùng totals.grandTotal */}
            {formatCurrency(order.totals.grandTotal)}
          </span>
          <button
            onClick={() => onViewOrder(order)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <Eye size={14} /> Xem chi tiết
          </button>
        </div>
      </div>

      {/* Footer Card (Actions) */}
      {actionButtons.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-b-lg border-t border-gray-200">
          <div className="flex gap-2">{actionButtons} </div>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
