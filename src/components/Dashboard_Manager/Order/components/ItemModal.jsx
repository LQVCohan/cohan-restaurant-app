import React from "react";
import { X, ChefHat, StickyNote, BookOpen } from "lucide-react";

const ItemModal = ({ item, orderInfo, onClose }) => {
  const getItemStatusText = (status) => {
    const statusMap = {
      pending: "Chưa xác nhận",
      confirmed: "Đã xác nhận",
      preparing: "Đang chuẩn bị",
    };
    return statusMap[status] || status;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: "bg-yellow-100", text: "text-yellow-800" },
      confirmed: { bg: "bg-blue-100", text: "text-blue-800" },
      preparing: { bg: "bg-purple-100", text: "text-purple-800" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
      >
        {getItemStatusText(status)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Chi tiết món ăn
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
          {/* Item Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <ChefHat className="text-blue-600" />
              {item.name}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Số lượng:</span>
                <span className="font-medium">{item.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Đơn giá:</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(item.price)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Thành tiền:</span>
                <span className="font-medium text-green-600">
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(item.price * item.quantity)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trạng thái:</span>
                {getStatusBadge(item.status)}
              </div>
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <StickyNote className="text-yellow-600" />
                Ghi chú đặc biệt:
              </h4>
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                <p className="text-yellow-800">{item.notes}</p>
              </div>
            </div>
          )}

          {/* Recipe */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <BookOpen className="text-purple-600" />
              Công thức chế biến:
            </h4>
            <div className="p-4 bg-gray-50 border-l-4 border-purple-500 rounded-lg">
              <p className="text-gray-700 leading-relaxed">{item.recipe}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemModal;
