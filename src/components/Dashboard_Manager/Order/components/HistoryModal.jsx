import React from "react";
import { X, Eye, History } from "lucide-react";

const HistoryModal = ({ orderHistory, onClose, onViewOrder }) => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <History className="text-blue-600" />
            Lịch Sử Đơn Hàng
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
          {orderHistory.length === 0 ? (
            <div className="text-center py-12">
              <History size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                Chưa có lịch sử đơn hàng
              </h3>
              <p className="text-gray-500">
                Các đơn hàng đã hoàn thành sẽ xuất hiện ở đây
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-gray-600">
                  Tổng cộng:{" "}
                  <strong className="text-gray-900">
                    {orderHistory.length}
                  </strong>{" "}
                  đơn hàng đã hoàn thành
                </p>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {orderHistory.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          #{order.id} - {order.customerName}
                        </h4>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <span>{getTableIcon(order.type)}</span>
                          {order.tableNumber}
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                        Hoàn thành
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-gray-600">Đặt lúc:</span>
                        <span className="font-medium ml-2">
                          {order.orderTime.toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Hoàn thành:</span>
                        <span className="font-medium ml-2">
                          {order.completedTime.toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-sm text-gray-600 mb-2">Món ăn:</div>
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item, index) => (
                          <span
                            key={index}
                            className="bg-white px-2 py-1 rounded border border-gray-200 text-xs"
                          >
                            {item.name} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-green-600">
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        }).format(order.total)}
                      </span>
                      <button
                        onClick={() => {
                          onViewOrder(order);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                      >
                        <Eye size={14} />
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
