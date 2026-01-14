// components/CustomerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import Modal, { ModalFooter } from "../../../components/common/Modal";

/* ===== GraphQL: cập nhật loyaltyPoints & customerType ===== */
const UPDATE_CUSTOMER_METRICS = gql`
  mutation UpdateCustomerMetrics(
    $id: ID!
    $loyaltyPoints: Int!
    $customerType: CustomerType!
  ) {
    updateCustomerMetrics(
      id: $id
      loyaltyPoints: $loyaltyPoints
      customerType: $customerType
    ) {
      id
      loyaltyPoints
      customerType
      updatedAt
    }
  }
`;

/* ===== Status meta + flow (hiển thị) ===== */
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
const ORDER_FLOW = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "paid",
  "completed",
];
const statusToStep = (st) => {
  const idx = ORDER_FLOW.indexOf((st || "").toLowerCase());
  return idx >= 0 ? idx : -1;
};
const stepLabel = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chế biến",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  paid: "Đã thanh toán",
  completed: "Hoàn tất",
};

/* ===== Helpers thời gian/tiền an toàn ===== */
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
    const parsed = Date.parse(s);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const toDateStringVI = (ts) => {
  const ms = normalizeEpochToMs(ts);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString("vi-VN")
    : new Date().toLocaleDateString("vi-VN");
};
const ceilToThousand = (n) => Math.ceil((Number(n) || 0) / 1000) * 1000;

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
const getOrderItems = (entry) => {
  if (Array.isArray(entry?.raw?.items) && entry.raw.items.length) {
    return entry.raw.items.map((i) => i?.name).filter(Boolean);
  }
  return Array.isArray(entry?.items) ? entry.items : [];
};

/* ===== Phân hạng dựa trên điểm ===== */
const classifyCustomerType = (points) => {
  if (points < 5000) return "NEW";
  if (points <= 15000) return "OFTEN";
  return "VIP";
};

const CustomerModal = ({ customer, onClose, onShowBill }) => {
  // Professional UI: chỉ giữ tính năng cần
  const [notes, setNotes] = useState(customer?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tempNotes, setTempNotes] = useState(customer?.notes || "");

  const recentOrders = Array.isArray(customer?.recentOrders)
    ? customer.recentOrders
    : [];
  const favoriteItems = Array.isArray(customer?.favoriteItems)
    ? customer.favoriteItems
    : [];

  // 🔢 FE compute: tổng số đơn, tổng chi tiêu, TB/đơn từ recentOrders
  const orderCount = recentOrders.length;
  const totalSpentRaw = useMemo(
    () => recentOrders.reduce((sum, entry) => sum + getEntryAmount(entry), 0),
    [recentOrders]
  );
  const totalSpent = ceilToThousand(totalSpentRaw);
  const averagePerOrder =
    orderCount > 0 ? ceilToThousand(totalSpentRaw / orderCount) : 0;

  // Điểm tích lũy & loại khách theo quy tắc mới
  const computedPoints = Math.floor(totalSpentRaw / 1000);
  const computedType = classifyCustomerType(computedPoints);

  // Cập nhật DB nếu khác dữ liệu hiện có
  const [mutUpdateMetrics] = useMutation(UPDATE_CUSTOMER_METRICS);
  useEffect(() => {
    const currentPoints = Number(customer?.loyaltyPoints || 0);
    const currentType = (customer?.customerType || "").toUpperCase(); // DB enum string

    const needUpdate =
      currentPoints !== computedPoints || currentType !== computedType;
    if (!customer?.id || !needUpdate) return;

    mutUpdateMetrics({
      variables: {
        id: customer.id,
        loyaltyPoints: computedPoints,
        customerType: computedType,
      },
    }).catch(() => {
      // im lặng trong UI
    });
  }, [
    customer?.id,
    customer?.loyaltyPoints,
    customer?.customerType,
    computedPoints,
    computedType,
    mutUpdateMetrics,
  ]);

  const idDisplay = useMemo(() => {
    const idStr = customer?.id != null ? String(customer.id) : "0";
    return idStr.padStart(4, "0");
  }, [customer?.id]);

  const handleSaveNotes = () => {
    setNotes(tempNotes);
    setIsEditingNotes(false);
    // TODO: call API lưu notes nếu có
  };
  const handleCancelEdit = () => {
    setTempNotes(notes);
    setIsEditingNotes(false);
  };
  const handleShowBill = (entry) => onShowBill?.(entry);

  // membership days
  const membershipDays = useMemo(() => {
    const ms = normalizeEpochToMs(customer?.joinDate);
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
  }, [customer?.joinDate]);

  // Nhãn hiển thị loại khách sau khi tính & đồng bộ
  const prettyType = useMemo(() => {
    switch (computedType) {
      case "VIP":
        return {
          text: "⭐ VIP",
          cls: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white",
        };
      case "OFTEN":
        return {
          text: "🔥 Thường xuyên",
          cls: "bg-gradient-to-r from-blue-500 to-purple-600 text-white",
        };
      default:
        return {
          text: "🆕 Mới",
          cls: "bg-gradient-to-r from-green-500 to-teal-600 text-white",
        };
    }
  }, [computedType]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Chi tiết khách hàng"
      size="full"
      closeOnOverlayClick
      closeOnEscape
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center text-3xl">
                {customer?.avatar || "👤"}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white`}
                title="Đang hoạt động"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">
                {customer?.name || "Khách hàng"}
              </h2>
              <p className="text-blue-100 mb-2">ID: #{idDisplay}</p>
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${prettyType.cls}`}
                >
                  {prettyType.text}
                </span>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                  Điểm: {computedPoints.toLocaleString("vi-VN")}
                </span>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                  Đang hoạt động
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {computedPoints.toLocaleString("vi-VN")}
            </div>
            <div className="text-blue-100">Điểm tích lũy</div>
          </div>
        </div>
      </div>

      {/* Contact quick row */}
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
          <span className="font-medium">Đang hoạt động</span>
        </div>
      </div>

      {/* Stats (production) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-green-600">
            {totalSpent.toLocaleString("vi-VN")}đ
          </div>
          <div className="text-sm text-gray-600">Tổng chi tiêu</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-blue-600">
            {orderCount.toLocaleString("vi-VN")}
          </div>
          <div className="text-sm text-gray-600">Tổng đơn hàng</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-purple-600">
            {averagePerOrder.toLocaleString("vi-VN")}đ
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
            />
          </svg>
          Đơn hàng gần đây ({orderCount})
        </h3>

        {recentOrders.length > 0 ? (
          <div className="space-y-3">
            {recentOrders.map((entry, index) => {
              const st = (
                entry?.status ||
                entry?.raw?.currentStatus ||
                "default"
              ).toLowerCase();
              const meta = ORDER_STATUS_META[st] || ORDER_STATUS_META.default;
              const step = statusToStep(st);
              const totalSteps = ORDER_FLOW.length - 1;
              const displayDate =
                entry?.raw?.createdAt != null
                  ? toDateStringVI(entry.raw.createdAt)
                  : entry?.date || toDateStringVI(Date.now);
              const amount = ceilToThousand(getEntryAmount(entry));

              return (
                <div
                  key={entry?.id || entry?.orderCode || index}
                  className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-600 cursor-pointer transition-colors"
                  onClick={() => handleShowBill(entry)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-blue-900">
                      📅 {displayDate}
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {amount.toLocaleString("vi-VN")}đ
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mb-2">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {/* Step progress */}
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      {ORDER_FLOW.map((k, i) => {
                        const active = i <= step && step >= 0;
                        return (
                          <div key={k} className="flex items-center">
                            <div
                              className={`w-6 h-1 rounded ${
                                active ? "bg-blue-600" : "bg-gray-200"
                              }`}
                              title={stepLabel[k]}
                            />
                            {i < totalSteps && <div className="w-1" />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      {stepLabel[st] || "Trạng thái không rõ"}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(getOrderItems(entry) || []).map((item, itemIndex) => (
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
              );
            })}
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

      {/* Notes — vẫn giữ nhưng tối giản để production */}
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
              />
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
