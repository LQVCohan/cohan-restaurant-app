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

const OrderCard = ({ order, onUpdateStatus, onViewOrder, onViewItem }) => {
  // Get alert class and priority
  const getOrderAlertClass = (orderTime) => {
    const now = new Date();
    const timeDiff = Math.floor((now - orderTime) / (1000 * 60));

    if (timeDiff >= 30) return "border-l-4 border-red-600 bg-red-50";
    if (timeDiff >= 20) return "border-l-4 border-red-500 bg-red-50";
    if (timeDiff >= 10) return "border-l-4 border-yellow-500 bg-yellow-50";
    return "";
  };

  // Get time warning badge
  const getTimeWarningBadge = (orderTime) => {
    const now = new Date();
    const timeDiff = Math.floor((now - orderTime) / (1000 * 60));

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
    return null;
  };

  // Get status badge
  const getStatusBadge = (status) => {
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
    switch (type) {
      case "table":
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

    switch (order.status) {
      case "pending":
        buttons.push(
          <button
            key="confirm"
            onClick={() => onUpdateStatus(order.id, "confirmed")}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
          >
            <Check size={14} />
            Xác nhận
          </button>
        );
        buttons.push(
          <button
            key="cancel"
            onClick={() => onUpdateStatus(order.id, "cancelled")}
            className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
          >
            <X size={14} />
            Hủy
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
            <ChefHat size={14} />
            Chuẩn bị
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
            <CheckCircle size={14} />
            Sẵn sàng
          </button>
        );
        break;
      case "ready":
        buttons.push(
          <button
            key="complete"
            onClick={() => onUpdateStatus(order.id, "completed")}
            className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle size={14} />
            Hoàn thành
          </button>
        );
        break;
    }

    buttons.push(
      <button
        key="view"
        onClick={() => onViewOrder(order)}
        className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
      >
        <Eye size={14} />
        Xem
      </button>
    );

    return buttons;
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${getOrderAlertClass(
        order.orderTime
      )}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">#{order.id}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} />
            {order.orderTime.toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })}
            {getTimeWarningBadge(order.orderTime)}
          </div>
        </div>
        {getStatusBadge(order.status)}
      </div>

      {/* Customer Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-gray-900 font-medium mb-1">
          <User size={16} />
          {order.customerName}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{getTableIcon(order.type)}</span>
          {order.tableNumber}
        </div>
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
          <ChefHat size={16} />
          Món ăn ({order.items.length})
        </div>
        <div className="space-y-2">
          {order.items.map((item, index) => (
            <div
              key={index}
              onClick={() =>
                onViewItem({
                  item,
                  orderInfo: { id: order.id, customerName: order.customerName },
                })
              }
              className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  {item.name}
                  <Eye size={12} className="text-blue-600" />
                </div>
                <div className="text-xs text-gray-500">
                  {item.status === "pending" && "Chưa xác nhận"}
                  {item.status === "confirmed" && "Đã xác nhận"}
                  {item.status === "preparing" && "Đang chuẩn bị"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">
                  {item.quantity}
                </span>
                <div className="text-xs">
                  {item.status === "pending" && (
                    <Clock size={12} className="text-yellow-500" />
                  )}
                  {item.status === "confirmed" && (
                    <Check size={12} className="text-green-500" />
                  )}
                  {item.status === "preparing" && (
                    <ChefHat size={12} className="text-purple-500" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg mb-4">
        <span className="font-semibold text-gray-700">Tổng cộng:</span>
        <span className="text-lg font-bold text-gray-900">
          {new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
          }).format(order.total)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">{getActionButtons()}</div>
    </div>
  );
};

export default OrderCard;
