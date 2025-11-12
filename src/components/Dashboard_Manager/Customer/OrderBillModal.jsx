// components/OrderBillModal.jsx
import React from "react";
import { createPortal } from "react-dom";

/* Dùng chung status meta để hiển thị badge trong bill */
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

/* Helpers thời gian/tiền */
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

const toDateTimeVI = (ts) => {
  const ms = normalizeEpochToMs(ts);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleString("vi-VN")
    : new Date().toLocaleString("vi-VN");
};

const OrderBillModal = ({ customer, order, onClose }) => {
  // order có thể là entry dạng { raw, amount, items, ... }
  const raw = order?.raw || {};
  const createdAt = raw?.createdAt ?? order?.date ?? Date.now();
  const createdAtStr = toDateTimeVI(createdAt);

  const st = (raw?.currentStatus || order?.status || "default").toLowerCase();
  const meta = ORDER_STATUS_META[st] || ORDER_STATUS_META.default;

  // billItems từ dữ liệu thật nếu có
  const billItems =
    Array.isArray(raw?.items) && raw.items.length
      ? raw.items.map((it) => ({
          name: it?.name || "Món",
          price: Math.round(
            (Number(it?.price) || 0) + (Number(it?.modifiersPrice) || 0)
          ),
          quantity: Number(it?.quantity || 1),
        }))
      : (order?.items || []).map((item) => ({
          name: item,
          price: Math.floor(Math.random() * 200000) + 50000, // fallback demo
          quantity: Math.floor(Math.random() * 3) + 1,
        }));

  const subtotal = billItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = Math.floor(subtotal * 0.1);
  const total =
    raw?.totals?.grandTotal != null
      ? Number(raw.totals.grandTotal)
      : subtotal + tax;

  // Tạo số hóa đơn
  const billNo = `${(customer?.id || "0").toString().padStart(4, "0")}${(
    order?.orderCode || ""
  )
    .toString()
    .slice(-4)
    .toUpperCase()}`;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-blue-900">
              🧾 Hóa đơn chi tiết
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
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Bill Header */}
          <div className="text-center mb-4 pb-3 border-b border-dashed border-gray-300">
            <h2 className="text-lg font-bold text-blue-900 mb-1">
              NHÀ HÀNG FOODHUB
            </h2>
            <p className="text-xs text-gray-600">123 Nguyễn Huệ, Q1, TP.HCM</p>
            <p className="text-xs text-gray-600">
              ĐT: 0901234567 - MST: 0123456789
            </p>
          </div>

          {/* Bill Info + status */}
          <div className="text-center mb-4">
            <h3 className="text-base font-bold text-blue-900 mb-2">
              HÓA ĐƠN BÁN HÀNG
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Số: #{billNo}</p>
              <p>Ngày: {createdAtStr}</p>
              <div className="mt-1">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}
                >
                  {meta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-4 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Khách hàng:</span>
              <span className="text-blue-900 font-medium">
                {customer?.name || customer?.fullName}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Điện thoại:</span>
              <span className="text-blue-900">{customer?.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Thu ngân:</span>
              <span className="text-blue-900">Nguyễn Văn A</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-3"></div>

          {/* Bill Items */}
          <div className="mb-4">
            <div className="text-xs font-medium text-blue-900 mb-2 flex">
              <span className="flex-1">Tên món</span>
              <span className="w-12 text-center">SL</span>
              <span className="w-16 text-right">Đ.Giá</span>
              <span className="w-20 text-right">T.Tiền</span>
            </div>
            <div className="border-t border-dashed border-gray-300 mb-2"></div>
            <div className="space-y-1">
              {billItems.map((item, index) => (
                <div key={index} className="flex text-xs">
                  <div className="flex-1 text-blue-900">{item.name}</div>
                  <div className="w-12 text-center text-gray-600">
                    {item.quantity}
                  </div>
                  <div className="w-16 text-right text-gray-600">
                    {Number(item.price).toLocaleString("vi-VN")}
                  </div>
                  <div className="w-20 text-right text-blue-900 font-medium">
                    {(
                      Number(item.price) * Number(item.quantity)
                    ).toLocaleString("vi-VN")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill Summary */}
          <div className="border-t border-dashed border-gray-300 pt-3">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Tạm tính:</span>
                <span className="text-blue-900">
                  {subtotal.toLocaleString("vi-VN")}đ
                </span>
              </div>
              {raw?.totals?.grandTotal == null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT (10%):</span>
                  <span className="text-blue-900">
                    {tax.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              )}
              <div className="border-t border-dashed border-gray-300 my-2"></div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-blue-900">TỔNG CỘNG:</span>
                <span className="text-blue-900">
                  {total.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-gray-600">Thanh toán:</span>
                <span className="text-blue-900">
                  {total.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tiền thừa:</span>
                <span className="text-blue-900">0đ</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-dashed border-gray-300 text-center text-xs text-gray-600 space-y-1">
            <p>*** Cảm ơn quý khách ***</p>
            <p>Hẹn gặp lại!</p>
            <p className="mt-2">www.foodhub.vn</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderBillModal;
