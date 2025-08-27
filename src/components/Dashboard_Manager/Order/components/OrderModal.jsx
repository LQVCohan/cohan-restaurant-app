import React from "react";
import { X, Printer } from "lucide-react";

const OrderModal = ({ order, onClose, onUpdateItemStatus }) => {
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
        className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const getItemStatusText = (status) => {
    const statusMap = {
      pending: "Chưa xác nhận",
      confirmed: "Đã xác nhận",
      preparing: "Đang chuẩn bị",
    };
    return statusMap[status] || status;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Chi tiết đơn hàng
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Order Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Thông tin đơn hàng #{order.id}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Khách hàng:</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bàn/Loại:</span>
                <span className="font-medium">{order.tableNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Thời gian:</span>
                <span className="font-medium">
                  {order.orderTime.toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trạng thái:</span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Chi tiết món ăn
            </h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-600">
                      {getItemStatusText(item.status)} • Đơn giá:{" "}
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(item.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">x{item.quantity}</div>
                      <div className="text-sm text-gray-600">
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        }).format(item.price * item.quantity)}
                      </div>
                    </div>
                    {order.status !== "completed" &&
                      order.status !== "cancelled" && (
                        <select
                          value={item.status}
                          onChange={(e) =>
                            onUpdateItemStatus(order.id, index, e.target.value)
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="pending">Chưa xác nhận</option>
                          <option value="confirmed">Đã xác nhận</option>
                          <option value="preparing">Đang chuẩn bị</option>
                        </select>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="mb-6">
            <div className="flex justify-between items-center p-4 bg-gray-100 rounded-lg text-lg font-bold">
              <span>Tổng cộng:</span>
              <span className="text-green-600">
                {new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                }).format(order.total)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Ghi chú:</h4>
              <p className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                {order.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                alert(`Đang in đơn hàng #${order.id}...`);
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Printer size={16} />
              In đơn hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderModal;
