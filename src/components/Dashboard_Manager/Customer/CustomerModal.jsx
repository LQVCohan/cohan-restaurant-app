// components/CustomerModal.jsx
import React, { useMemo, useState } from "react";
import Modal, { ModalFooter } from "../../../components/common/Modal";

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

// ——— Helpers an toàn ———
const normalizeEpochToMs = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) {
    // 10 digits → seconds, 13 digits → ms
    const len = String(Math.floor(v)).length;
    return len === 10 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const len = s.length;
      return len === 10 ? n * 1000 : n;
    }
    const parsed = Date.parse(s);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatVND = (n) =>
  (Number(n) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + "đ";

const computeMembershipDays = (joinDate) => {
  const ms = normalizeEpochToMs(joinDate);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
};

const CustomerModal = ({ customer, onClose, onShowBill }) => {
  // Notes state
  const [notes, setNotes] = useState(customer?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(customer?.notes || "");

  // Tính toán an toàn
  const totalSpent = Number(customer?.totalSpent || 0);
  const totalOrders = Number(customer?.totalOrders || 0);
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  const loyaltyPoints = Number(customer?.loyaltyPoints || 0);
  const loyaltyLevel =
    loyaltyPoints >= 1500
      ? "💎 Kim cương"
      : loyaltyPoints >= 1000
      ? "🥇 Vàng"
      : loyaltyPoints >= 500
      ? "🥈 Bạc"
      : "🥉 Đồng";

  // joinDate có thể là ISO | ms | "ms" | "seconds"
  const membershipDays = computeMembershipDays(customer?.joinDate);

  const recentOrders = Array.isArray(customer?.recentOrders)
    ? customer.recentOrders
    : [];
  const favoriteItems = Array.isArray(customer?.favoriteItems)
    ? customer.favoriteItems
    : [];

  const idDisplay = useMemo(() => {
    const idStr = customer?.id != null ? String(customer.id) : "0";
    return idStr.padStart(4, "0");
  }, [customer?.id]);

  const handleSaveNotes = () => {
    setNotes(tempNotes);
    setIsEditingNotes(false);
    // TODO: call API lưu notes nếu cần
    // alert("Ghi chú đã được cập nhật thành công!");
  };

  const handleCancelEdit = () => {
    setTempNotes(notes);
    setIsEditingNotes(false);
  };

  const handleShowBill = (orderIndex) => {
    if (recentOrders[orderIndex]) {
      onShowBill?.(orderIndex);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Chi tiết khách hàng"
      size="xl" // xl để thoải mái nội dung; thay "lg" nếu muốn gọn hơn
      closeOnOverlayClick
      closeOnEscape
    >
      {/* Customer Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center text-3xl">
                {customer?.avatar || "👤"}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 w-6 h-6 ${
                  statusClasses[customer?.status] || statusClasses.offline
                } rounded-full border-2 border-white`}
              ></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">
                {customer?.name || "Khách hàng"}
              </h2>
              <p className="text-blue-100 mb-2">ID: #{idDisplay}</p>
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    typeClasses[customer?.customerType] || typeClasses["Mới"]
                  }`}
                >
                  {typeIcons[customer?.customerType] || typeIcons["Mới"]}
                </span>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                  {loyaltyLevel}
                </span>
                {customer?.isGuest && (
                  <span className="px-3 py-1 bg-yellow-400 text-black rounded-full text-sm font-semibold">
                    🟡 Guest
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{loyaltyPoints}</div>
            <div className="text-blue-100">Điểm tích lũy</div>
          </div>
        </div>
      </div>

      {/* Contact Info quick row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="flex items-center text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">
          <span className="w-5 text-center mr-3">📧</span>
          <span className="truncate">{customer?.email || "Chưa có email"}</span>
        </div>
        <div className="flex items-center text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">
          <span className="w-5 text-center mr-3">📱</span>
          <span>{customer?.phone || "Chưa có SĐT"}</span>
        </div>
        <div className="flex items-center text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">
          <span className="w-5 text-center mr-3">⏰</span>
          <span className="font-medium">
            {customer?.currentActivity || "Không hoạt động"}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatVND(totalSpent)}
          </div>
          <div className="text-sm text-gray-600">Tổng chi tiêu</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-blue-600">
            {totalOrders.toLocaleString("vi-VN")}
          </div>
          <div className="text-sm text-gray-600">Tổng đơn hàng</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-purple-600">
            {formatVND(Math.round(avgOrderValue / 1000) * 1000)}
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

      {/* Favorite Items */}
      {favoriteItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <span className="text-sm font-medium text-gray-600 mr-2">
              🍽️ Món yêu thích:
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {favoriteItems.slice(0, 6).map((item, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                {item}
              </span>
            ))}
            {favoriteItems.length > 6 && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                +{favoriteItems.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

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
          Đơn hàng gần đây ({recentOrders.length})
        </h3>

        {recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((order, index) => (
              <div
                key={index}
                className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 cursor-pointer transition-colors"
                onClick={() => handleShowBill(index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-blue-900">
                    📅 {order.date}
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    {(Number(order.amount) || 0).toLocaleString("vi-VN")}đ
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
      <div className="bg-yellow-50 rounded-xl p-6">
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
          {!isEditingNotes && (
            <button
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              onClick={() => setIsEditingNotes(true)}
            >
              ✏️ Chỉnh sửa
            </button>
          )}
        </div>

        {!isEditingNotes ? (
          <p className="text-gray-700 whitespace-pre-line">
            {notes || "— Chưa có ghi chú —"}
          </p>
        ) : (
          <div>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              rows="4"
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              placeholder="Nhập ghi chú cho khách hàng này…"
            />
            <div className="flex gap-2 mt-3">
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

      {/* Footer actions */}
      <ModalFooter>
        <button className="btn btn--secondary" onClick={onClose}>
          Đóng
        </button>
        <button className="btn btn--primary">📧 Gửi khuyến mãi</button>
        <button className="btn btn--primary">📅 Đặt bàn</button>
      </ModalFooter>
    </Modal>
  );
};

export default CustomerModal;
