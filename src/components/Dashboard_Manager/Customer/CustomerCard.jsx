import React, { useMemo, useState } from "react";
import CustomerModal from "./CustomerModal";
import OrderBillModal from "./OrderBillModal";

/* Helpers… (giữ nguyên như bản trước) */
const normalizeEpochToMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) {
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
    const p = Date.parse(s);
    return Number.isFinite(p) ? p : null;
  }
  return null;
};

const ceilToThousand = (n) => Math.ceil((Number(n) || 0) / 1000) * 1000;

const formatDate = (date) => {
  const ms = normalizeEpochToMs(date);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString("vi-VN")
    : "Chưa rõ";
};

const ORDER_STATUS_META = {
  pending: {
    label: "Chờ xác nhận",
    cls: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  confirmed: {
    label: "Đã xác nhận",
    cls: "bg-blue-100 text-blue-800 border-blue-200",
  },
  preparing: {
    label: "Đang chế biến",
    cls: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  ready: {
    label: "Sẵn sàng",
    cls: "bg-teal-100 text-teal-800 border-teal-200",
  },
  served: {
    label: "Đã phục vụ",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  paid: {
    label: "Đã thanh toán",
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  completed: {
    label: "Hoàn tất",
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  cancelled: { label: "Đã hủy", cls: "bg-red-100 text-red-800 border-red-200" },
  default: {
    label: "Không rõ",
    cls: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

const getEntryAmount = (entry) => {
  if (entry?.raw?.totals?.grandTotal != null) {
    return Number(entry.raw.totals.grandTotal) || 0;
  }
  if (Array.isArray(entry?.raw?.items) && entry.raw.items.length) {
    return entry.raw.items.reduce((sum, it) => {
      const p = Number(it?.price || 0) + Number(it?.modifiersPrice || 0);
      const q = Number(it?.quantity || 1);
      return sum + p * q;
    }, 0);
  }
  if (entry?.amount != null) return Number(entry.amount) || 0;
  return 0;
};

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

  // Xoá biểu tượng 🟡 trong TÊN, nhưng vẫn sẽ hiển thị badge Guest riêng
  const cleanName = useMemo(
    () => (customer?.name || "Khách hàng").replace("🟡", "").trim(),
    [customer?.name]
  );

  const sortedRecentOrders = useMemo(() => {
    const list = Array.isArray(customer?.recentOrders)
      ? customer.recentOrders
      : [];
    return [...list].sort((a, b) => {
      const ams =
        normalizeEpochToMs(a?.raw?.createdAt ?? a?.createdAt ?? a?.date) ?? 0;
      const bms =
        normalizeEpochToMs(b?.raw?.createdAt ?? b?.createdAt ?? b?.date) ?? 0;
      return bms - ams;
    });
  }, [customer?.recentOrders]);

  const feOrderCount = sortedRecentOrders.length;
  const feTotalSpent = useMemo(
    () =>
      sortedRecentOrders.reduce((sum, entry) => sum + getEntryAmount(entry), 0),
    [sortedRecentOrders]
  );
  const feAvgOrder =
    feOrderCount > 0 ? ceilToThousand(feTotalSpent / feOrderCount) : 0;

  const handleShowBill = (orderEntry) => {
    if (!orderEntry) return;
    setSelectedOrder(orderEntry);
    setShowBillModal(true);
  };

  const nearest = sortedRecentOrders[0];
  const favoriteItems = Array.isArray(customer?.favoriteItems)
    ? customer.favoriteItems
    : [];

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
                  {customer?.avatar || "👤"}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 ${
                    statusClasses[customer?.status] || statusClasses.offline
                  } rounded-full border-2 border-white`}
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-900 mb-1">
                  {cleanName}
                </h3>
                <div className="flex items-center flex-wrap gap-2">
                  <span
                    className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                      typeClasses[customer?.customerType] || typeClasses["Mới"]
                    }`}
                  >
                    {typeIcons[customer?.customerType] || typeIcons["Mới"]}
                  </span>

                  {/* Badge Guest riêng (không nằm trong tên) */}
                  {customer?.isGuest && (
                    <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                      🟡 Guest
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {ceilToThousand(feTotalSpent).toLocaleString("vi-VN")}đ
              </div>
              <div className="text-sm text-gray-600">
                {feOrderCount} đơn hàng
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-5 text-center mr-3">📧</span>
              <span className="truncate">
                {customer?.email || "Chưa có email"}
              </span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="w-5 text-center mr-3">📱</span>
              <span>{customer?.phone || "Chưa có SĐT"}</span>
            </div>
            <div className="flex items-center text-sm">
              <span className="w-5 text-center mr-3">⏰</span>
              <span className="font-medium text-green-600">Đang hoạt động</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <div className="text-lg font-bold text-blue-600">
                {customer?.loyaltyPoints || 0}
              </div>
              <div className="text-xs text-gray-600">Điểm tích lũy</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <div className="text-lg font-bold text-green-600">
                {feOrderCount}
              </div>
              <div className="text-xs text-gray-600">Đơn hàng</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-xl">
              <div className="text-lg font-bold text-purple-600">
                {feAvgOrder.toLocaleString("vi-VN")}đ
              </div>
              <div className="text-xs text-gray-600">TB/đơn</div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="px-6 pb-4">
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

          {/* Nearest Order */}
          {nearest ? (
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    Đơn hàng gần nhất
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatDate(nearest?.raw?.createdAt ?? nearest?.date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">
                    {ceilToThousand(getEntryAmount(nearest)).toLocaleString(
                      "vi-VN"
                    )}
                    đ
                  </div>
                  <div className="text-xs text-gray-600">
                    {(nearest?.items || []).length} món
                  </div>
                </div>
              </div>

              <div className="mt-2">
                {(() => {
                  const st = (
                    nearest?.status ||
                    nearest?.raw?.currentStatus ||
                    "default"
                  ).toLowerCase();
                  const meta =
                    ORDER_STATUS_META[st] || ORDER_STATUS_META.default;
                  return (
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}
                    >
                      {meta.label}
                    </span>
                  );
                })()}
              </div>

              {(nearest?.items || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(nearest.items || []).slice(0, 2).map((item, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-white text-gray-600 text-xs rounded-full border"
                    >
                      {item}
                    </span>
                  ))}
                  {(nearest.items || []).length > 2 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                      +{(nearest.items || []).length - 2}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowBill(nearest);
                  }}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  👆 Xem hóa đơn chi tiết
                </button>
              </div>
            </div>
          ) : (
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
              Tham gia: {formatDate(customer?.joinDate)}
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
          customer={{
            ...customer,
            recentOrders: sortedRecentOrders,
            name: cleanName,
          }}
          onClose={() => setShowModal(false)}
          onShowBill={(entry) => {
            setSelectedOrder(entry);
            setShowBillModal(true);
          }}
        />
      )}

      {showBillModal && selectedOrder && (
        <OrderBillModal
          customer={customer}
          order={selectedOrder}
          onClose={() => {
            setShowBillModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </>
  );
};

export default CustomerCard;
