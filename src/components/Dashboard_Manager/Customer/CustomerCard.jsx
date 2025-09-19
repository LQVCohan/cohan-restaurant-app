// components/CustomerCard.jsx
import React, { useState } from "react";
import CustomerModal from "./CustomerModal";
import OrderBillModal from "./OrderBillModal";

const CustomerCard = ({ customer }) => {
  const [showModal, setShowModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const statusClasses = {
    online: "bg-green-500 animate-pulse",
    ordering: "bg-blue-500 animate-bounce",
    away: "bg-yellow-500",
    offline: "bg-gray-400",
  };

  const typeClasses = {
    VIP: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white",
    "Thường xuyên": "bg-gradient-to-r from-blue-500 to-purple-600 text-white",
    Mới: "bg-gradient-to-r from-green-500 to-teal-600 text-white",
  };

  const typeIcons = {
    VIP: "⭐ VIP",
    "Thường xuyên": "🔥 Thường xuyên",
    Mới: "🆕 Mới",
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  const handleShowBill = (orderIndex) => {
    if (customer.recentOrders && customer.recentOrders[orderIndex]) {
      setSelectedOrder({
        ...customer.recentOrders[orderIndex],
        index: orderIndex,
      });
      setShowBillModal(true);
    }
  };

  // Đảm bảo recentOrders luôn là array
  const recentOrders = customer.recentOrders || [];
  const favoriteItems = customer.favoriteItems || [];

  return (
    <>
      <div
        className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 border border-gray-100"
        onClick={() => setShowModal(true)}
      >
        {/* Card Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                  {customer.avatar || "👤"}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 ${
                    statusClasses[customer.status] || statusClasses.offline
                  } rounded-full border-2 border-white`}
                ></div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-900 mb-1">
                  {customer.name}
                </h3>
                <span
                  className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                    typeClasses[customer.customerType] || typeClasses["Mới"]
                  }`}
                >
                  {typeIcons[customer.customerType] || typeIcons["Mới"]}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {(customer.totalSpent || 0).toLocaleString()}đ
              </div>
              <div className="text-sm text-gray-600">
                {customer.totalOrders || 0} đơn hàng
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-5 text-center mr-3">📧</span>
              <span className="truncate">
                {customer.email || "Chưa có email"}
              </span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-5 text-center mr-3">📱</span>
              <span>{customer.phone || "Chưa có SĐT"}</span>
            </div>
            <div className="flex items-center text-sm">
              <span className="w-5 text-center mr-3">⏰</span>
              <span
                className={`font-medium ${
                  customer.status === "online"
                    ? "text-green-600"
                    : customer.status === "ordering"
                    ? "text-blue-600"
                    : customer.status === "away"
                    ? "text-yellow-600"
                    : "text-gray-600"
                }`}
              >
                {customer.currentActivity || "Không hoạt động"}
              </span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <div className="text-lg font-bold text-blue-600">
                {customer.loyaltyPoints || 0}
              </div>
              <div className="text-xs text-gray-600">Điểm tích lũy</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <div className="text-lg font-bold text-green-600">
                {customer.totalOrders || 0}
              </div>
              <div className="text-xs text-gray-600">Đơn hàng</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-xl">
              <div className="text-lg font-bold text-purple-600">
                {customer.joinDate
                  ? Math.floor(
                      (new Date() - new Date(customer.joinDate)) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0}
              </div>
              <div className="text-xs text-gray-600">Ngày thành viên</div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="px-6 pb-4">
          {/* Favorite Items */}
          {favoriteItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <span className="text-sm font-medium text-gray-600 mr-2">
                  🍽️ Món yêu thích:
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {favoriteItems.slice(0, 3).map((item, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {item}
                  </span>
                ))}
                {favoriteItems.length > 3 && (
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                    +{favoriteItems.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Recent Order */}
          {recentOrders.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    Đơn hàng gần nhất
                  </div>
                  <div className="text-xs text-gray-600">
                    {recentOrders[0].date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">
                    {(recentOrders[0].amount || 0).toLocaleString()}đ
                  </div>
                  <div className="text-xs text-gray-600">
                    {recentOrders[0].items ? recentOrders[0].items.length : 0}{" "}
                    món
                  </div>
                </div>
              </div>
              {/* Hiển thị một vài món trong đơn hàng gần nhất */}
              {recentOrders[0].items && recentOrders[0].items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {recentOrders[0].items.slice(0, 2).map((item, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-white text-gray-600 text-xs rounded-full border"
                    >
                      {item}
                    </span>
                  ))}
                  {recentOrders[0].items.length > 2 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                      +{recentOrders[0].items.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Nếu không có đơn hàng gần đây */}
          {recentOrders.length === 0 && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-center">
              <div className="text-sm text-gray-500">
                📝 Chưa có đơn hàng nào
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Khách hàng mới hoặc chưa đặt hàng
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Tham gia:{" "}
              {customer.joinDate ? formatDate(customer.joinDate) : "Chưa rõ"}
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <span>Xem chi tiết</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <CustomerModal
          customer={customer}
          onClose={() => setShowModal(false)}
          onShowBill={handleShowBill}
        />
      )}

      {showBillModal && selectedOrder && (
        <OrderBillModal
          customer={customer}
          order={selectedOrder}
          onClose={() => setShowBillModal(false)}
        />
      )}
    </>
  );
};

export default CustomerCard;
