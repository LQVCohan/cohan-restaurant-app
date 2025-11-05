import React from "react";
import { X, Printer } from "lucide-react";
import "./OrderModal.scss"; // <-- SỬA: Import SCSS toàn cục

// Hàm format tiền (giữ nguyên)
const formatCurrency = (amount) => {
  if (typeof amount !== "number") amount = 0;
  return amount.toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
  });
};

const OrderModal = ({ order, onClose, onUpdateItemStatus }) => {
  // --- Lấy dữ liệu từ GQL Order Object (giữ nguyên) ---
  const orderId = order?.id?.slice(-6) || "N/A";
  const customerName = order?.user?.fullName || "Khách lẻ";
  const tableNumber = order?.tableCode || "N/A";
  const orderTime = new Date(order?.createdAt || Date.now());
  const orderStatus = order?.currentStatus || "pending";
  const items = order?.items || [];
  const totals = order?.totals || { grandTotal: 0 };
  const orderNotes = order?.note || "";

  // --- Các hàm helper (Cập nhật để dùng class string) ---

  const getItemStatusText = (status) => {
    const statusMap = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      preparing: "Đang chuẩn bị",
      ready: "Sẵn sàng",
      served: "Đã phục vụ",
      cancelled: "Đã hủy",
    };
    return statusMap[status] || status;
  };

  const getStatusBadge = (status) => {
    // Sửa lại để trả về class string
    const statusClassMap = {
      pending: "pending",
      confirmed: "confirmed",
      preparing: "preparing",
      ready: "ready",
      completed: "completed",
      cancelled: "cancelled",
    };

    const statusClass = statusClassMap[status] || "pending";
    const statusText = getItemStatusText(status);

    // Trả về JSX dùng class string
    return <span className={`statusBadge ${statusClass}`}>{statusText}</span>;
  };

  return (
    // Thay thế class SCSS Module bằng class string
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal-order" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modalHeader">
          <h2 className="modalTitle">Chi tiết đơn hàng</h2>
          <button onClick={onClose} className="closeButton">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="modalContent">
          {/* Order Info */}
          <div className="section">
            <h3 className="sectionTitle">Thông tin đơn hàng #{orderId}</h3>
            <div className="infoGrid">
              <div className="infoItem">
                <span className="label">Khách hàng:</span>
                <span className="value">{customerName}</span>
              </div>
              <div className="infoItem">
                <span className="label">Bàn/Loại:</span>
                <span className="value">{tableNumber}</span>
              </div>
              <div className="infoItem">
                <span className="label">Thời gian:</span>
                <span className="value">
                  {orderTime.toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </div>
              <div className="infoItem">
                <span className="label">Trạng thái:</span>
                {getStatusBadge(orderStatus)}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="section">
            <h3 className="sectionTitle">Chi tiết món ăn</h3>
            <div className="itemsList">
              {items.map((item, index) => (
                <div
                  key={item._lineId || item.dishId || index}
                  className="itemCard"
                >
                  <div className="itemInfo">
                    <div className="itemName">{item.name}</div>
                    <div className="itemDetails">
                      {getItemStatusText(item.status)} • Đơn giá:{" "}
                      {formatCurrency(item.price)}
                    </div>
                    {item.note && (
                      <div
                        className="itemDetails"
                        style={{ color: "#b45309", marginTop: "4px" }}
                      >
                        Ghi chú: {item.note}
                      </div>
                    )}
                  </div>
                  <div className="itemMeta">
                    <div className="itemPricing">
                      <div className="quantity">x{item.quantity}</div>
                      <div className="itemTotal">
                        {formatCurrency(
                          (item.price + (item.modifiersPrice || 0)) *
                            item.quantity
                        )}
                      </div>
                    </div>
                    {orderStatus !== "completed" &&
                      orderStatus !== "cancelled" && (
                        <select
                          value={item.status}
                          onChange={(e) =>
                            onUpdateItemStatus(order.id, index, e.target.value)
                          }
                          className="statusSelect"
                        >
                          <option value="pending">Chờ xác nhận</option>
                          <option value="confirmed">Đã xác nhận</option>
                          <option value="preparing">Đang chuẩn bị</option>
                          <option value="ready">Sẵn sàng</option>
                          <option value="served">Đã phục vụ</option>
                          <option value="cancelled">Hủy món</option>
                        </select>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="section">
            <div className="totalSection">
              <span className="totalLabel">Tổng cộng:</span>
              <span className="totalAmount">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {orderNotes && (
            <div className="section">
              <h4 className="notesTitle">Ghi chú (Tổng đơn):</h4>
              <p className="notesContent">{orderNotes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="actions">
            <button onClick={onClose} className="cancelButton">
              Đóng
            </button>
            <button
              onClick={() => {
                alert(`Đang in đơn hàng #${orderId}...`);
              }}
              className="printButton"
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
