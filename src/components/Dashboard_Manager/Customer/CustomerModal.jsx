import React, { useState } from "react";

const CustomerModal = ({ customer, onClose, onShowBill }) => {
  const [notes, setNotes] = useState(customer.notes);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(customer.notes);

  const avgOrderValue = customer.totalSpent / customer.totalOrders;
  const loyaltyLevel =
    customer.loyaltyPoints >= 1500
      ? "💎 Kim cương"
      : customer.loyaltyPoints >= 1000
      ? "🥇 Vàng"
      : customer.loyaltyPoints >= 500
      ? "🥈 Bạc"
      : "🥉 Đồng";
  const membershipDays = Math.floor(
    (new Date() - new Date(customer.joinDate)) / (1000 * 60 * 60 * 24)
  );

  const handleSaveNotes = () => {
    setNotes(tempNotes);
    setIsEditingNotes(false);
    // Ở đây bạn có thể gọi API để lưu notes
    alert("Ghi chú đã được cập nhật thành công!");
  };

  const handleCancelEdit = () => {
    setTempNotes(notes);
    setIsEditingNotes(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-blue-900">
              Chi tiết khách hàng
            </h3>
            <button
              className="text-gray-600 hover:text-blue-900 transition-colors p-2 hover:bg-gray-100 rounded-full"
              onClick={onClose}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Customer Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center text-3xl">
                    {customer.avatar}
                  </div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white ${
                      customer.status === "online" ? "animate-pulse" : ""
                    }`}
                  ></div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">{customer.name}</h2>
                  <p className="text-blue-100 mb-2">
                    ID: #{customer.id.toString().padStart(4, "0")}
                  </p>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                      {customer.customerType === "VIP"
                        ? "⭐ VIP"
                        : customer.customerType === "Thường xuyên"
                        ? "🔥 Thường xuyên"
                        : "🆕 Mới"}
                    </span>
                    <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                      {loyaltyLevel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {customer.loyaltyPoints}
                </div>
                <div className="text-blue-100">Điểm tích lũy</div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-600">
                {customer.totalSpent.toLocaleString()}đ
              </div>
              <div className="text-sm text-gray-600">Tổng chi tiêu</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600">
                {customer.totalOrders}
              </div>
              <div className="text-sm text-gray-600">Tổng đơn hàng</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(avgOrderValue / 1000) * 1000}đ
              </div>
              <div className="text-sm text-gray-600">Giá trị TB/đơn</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {membershipDays}
              </div>
              <div className="text-sm text-gray-600">Ngày thành viên</div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                ></path>
              </svg>
              Đơn hàng gần đây ({(customer.recentOrders || []).length})
            </h3>

            {customer.recentOrders && customer.recentOrders.length > 0 ? (
              <div className="space-y-3">
                {customer.recentOrders.map((order, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 cursor-pointer transition-colors"
                    onClick={() => onShowBill(index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-blue-900">
                        📅 {order.date}
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        💰 {(order.amount || 0).toLocaleString()}đ
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(order.items || []).map((item, itemIndex) => (
                        <span
                          key={itemIndex}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-blue-600 font-medium">
                      👆 Nhấn để xem hóa đơn chi tiết
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📝</div>
                <div className="text-gray-500 font-medium">
                  Chưa có đơn hàng nào
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Khách hàng chưa thực hiện đơn hàng nào
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-yellow-50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
                Ghi chú
              </h3>
              <button
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                onClick={() => setIsEditingNotes(true)}
              >
                ✏️ Chỉnh sửa
              </button>
            </div>

            {!isEditingNotes ? (
              <p className="text-gray-600">{notes}</p>
            ) : (
              <div>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  rows="3"
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                />
                <div className="flex space-x-2 mt-3">
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                    onClick={handleSaveNotes}
                  >
                    💾 Lưu
                  </button>
                  <button
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
                    onClick={handleCancelEdit}
                  >
                    ❌ Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center space-x-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                ></path>
              </svg>
              <span>Gửi khuyến mãi</span>
            </button>
            <button className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center space-x-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              <span>Đặt bàn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
