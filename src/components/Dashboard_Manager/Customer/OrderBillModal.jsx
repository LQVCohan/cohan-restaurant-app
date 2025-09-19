import React from "react";

const OrderBillModal = ({ customer, order, onClose }) => {
  // Tạo dữ liệu hóa đơn chi tiết
  const billItems = order.items.map((item) => ({
    name: item,
    price: Math.floor(Math.random() * 200000) + 50000,
    quantity: Math.floor(Math.random() * 3) + 1,
  }));

  const subtotal = billItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                ></path>
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

          {/* Bill Info */}
          <div className="text-center mb-4">
            <h3 className="text-base font-bold text-blue-900 mb-2">
              HÓA ĐƠN BÁN HÀNG
            </h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                Số: #{customer.id}
                {order.index}
                {order.date.replace(/\//g, "")}
              </p>
              <p>
                Ngày: {order.date} -{" "}
                {Math.floor(Math.random() * 24)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor(Math.random() * 60)
                  .toString()
                  .padStart(2, "0")}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-4 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Khách hàng:</span>
              <span className="text-blue-900 font-medium">{customer.name}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Điện thoại:</span>
              <span className="text-blue-900">{customer.phone}</span>
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
                    {item.price.toLocaleString()}
                  </div>
                  <div className="w-20 text-right text-blue-900 font-medium">
                    {(item.price * item.quantity).toLocaleString()}
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
                  {subtotal.toLocaleString()}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VAT (10%):</span>
                <span className="text-blue-900">{tax.toLocaleString()}đ</span>
              </div>
              <div className="border-t border-dashed border-gray-300 my-2"></div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-blue-900">TỔNG CỘNG:</span>
                <span className="text-blue-900">{total.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-gray-600">Tiền mặt:</span>
                <span className="text-blue-900">{total.toLocaleString()}đ</span>
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
    </div>
  );
};

export default OrderBillModal;
