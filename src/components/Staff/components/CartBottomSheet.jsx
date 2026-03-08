import React from "react";
import {
  X,
  Clock,
  ChefHat,
  AlertTriangle,
  Printer,
  Camera,
  Minus,
  Trash2,
  Tag,
  Scissors,
  Banknote,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";
import "./CartBottomSheet.scss";

export default function CartBottomSheet({
  cart = [],
  setCart,
  onClose,
  table,
}) {
  const handleRequestVoid = (item) => {
    const reason = window.prompt(`Nhập lý do hủy món [${item.name}]:`);
    if (reason) {
      setCart(
        cart.map((c) =>
          c.id === item.id ? { ...c, status: "void_pending" } : c,
        ),
      );
      alert("Đã gửi yêu cầu hủy món!");
    }
  };

  // Tính tổng tiền
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div className="staff-pos-cart-overlay" onClick={onClose}>
      <div
        className="staff-pos-cart-sheet"
        onClick={(e) => e.stopPropagation()} // Ngăn việc click vào sheet làm đóng overlay
      >
        {/* Thanh kéo giả lập native mobile */}
        <div className="drag-indicator">
          <div className="drag-handle"></div>
        </div>

        <div className="sheet-header">
          <div className="header-info">
            <h3>Order: {table?.name || "Chưa chọn bàn"}</h3>
            <p className="subtitle">{cart.length} món đang chọn</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="sheet-body">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon-wrap">
                <ShoppingBag size={48} />
              </div>
              <p>Chưa có món nào trong order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className={`cart-item ${item.status}`}>
                <div className="item-main">
                  <div className="item-info-left">
                    <span className="qty">{item.quantity}</span>
                    <div className="name-wrap">
                      <span className="name">{item.name}</span>
                      <span className="prep-text">
                        {item.prep} {item.prep && item.serveOrder ? "•" : ""}{" "}
                        {item.serveOrder}
                      </span>
                    </div>
                  </div>
                  <div className="item-price">
                    {(item.price * item.quantity).toLocaleString()}đ
                  </div>
                </div>

                <div className="item-tools">
                  <div className="status-badges">
                    {item.status === "pending" && (
                      <span className="badge badge-warning">
                        <Clock size={12} /> Bếp chưa nhận
                      </span>
                    )}
                    {item.status === "cooking" && (
                      <span className="badge badge-cooking">
                        <ChefHat size={12} /> Đang chế biến
                      </span>
                    )}
                    {item.status === "void_pending" && (
                      <span className="badge badge-void">
                        <AlertTriangle size={12} /> Chờ duyệt hủy
                      </span>
                    )}
                    {item.printed && (
                      <span className="badge badge-printed">
                        <Printer size={12} /> Đã in
                      </span>
                    )}
                  </div>

                  <div className="actions">
                    <button
                      className={`btn-icon ${item.hasPhoto ? "active-cam" : ""}`}
                    >
                      <Camera size={16} />
                    </button>
                    {item.status === "pending" ? (
                      <button
                        className="btn-icon btn-minus"
                        onClick={() =>
                          setCart(cart.filter((c) => c.id !== item.id))
                        }
                      >
                        <Minus size={16} />
                      </button>
                    ) : item.status !== "void_pending" ? (
                      <button
                        className="btn-icon btn-void"
                        onClick={() => handleRequestVoid(item)}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sheet-footer">
          {/* Tổng tiền nổi bật */}
          <div className="summary-row">
            <span className="summary-label">Tổng thanh toán:</span>
            <span className="summary-total">
              {totalPrice.toLocaleString()}đ
            </span>
          </div>

          {/* Các nút công cụ phụ */}
          <div className="billing-actions">
            <button className="btn-sub">
              <Tag size={16} /> Thêm Ưu Đãi
            </button>
            <button className="btn-sub">
              <Scissors size={16} /> Tách Bill
            </button>
            <button className="btn-sub">
              <Printer size={16} /> In Tạm Tính
            </button>
          </div>

          {/* Nút hành động chính */}
          <div className="main-actions">
            <button
              className="btn-primary btn-send-kitchen"
              disabled={cart.length === 0}
            >
              <CheckCircle2 size={20} /> Gửi Bếp
            </button>
            <button
              className="btn-primary btn-checkout"
              disabled={cart.length === 0}
            >
              <Banknote size={20} /> Thanh Toán
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
