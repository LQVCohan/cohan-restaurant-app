import React from "react";
import { Users, MapPin, Wallet, UtensilsCrossed, XCircle } from "lucide-react";
import "./BookingSummary.scss";

const BookingSummary = ({
  selectedTable,
  onConfirm,
  onCancel,
  selectedFloorName,
  menuDeposit = 0,
  menuItemsCount = 0,
  onOrderDishes,
}) => {
  // Helper: Format tiền tệ
  const formatPrice = (price) => {
    if (!price || price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  return (
    <div className="bsm-card">
      {/* --- Header --- */}
      <div className="bsm-header">
        <h3 className="bsm-title">Thông tin đặt bàn</h3>
        <span className="bsm-subtitle">Reservation Details</span>
      </div>

      {/* --- Body --- */}
      <div className="bsm-body">
        {selectedTable ? (
          <>
            {/* 1. Visual hiển thị bàn đang chọn (Ticket Style) */}
            <div className="bsm-selected-visual">
              <div className="bsm-table-icon">
                <span className="label">{selectedTable.label}</span>
              </div>
              <div className="bsm-text-info">
                <span className="floor-badge">
                  {selectedFloorName || "Khu vực chung"}
                </span>
                <span className="status-text">Đang được chọn</span>
              </div>
            </div>

            {/* 2. List thông tin chi tiết */}
            <div className="bsm-info-list">
              <div className="bsm-info-item">
                <div className="icon-wrapper">
                  <Users size={18} />
                </div>
                <div className="details">
                  <span className="label">Sức chứa</span>
                  <span className="value">{selectedTable.capacity} khách</span>
                </div>
              </div>

              <div className="bsm-info-item">
                <div className="icon-wrapper">
                  <MapPin size={18} />
                </div>
                <div className="details">
                  <span className="label">Vị trí</span>
                  <span className="value">
                    {selectedFloorName || "Tầng trệt"}
                  </span>
                </div>
              </div>

              <div className="bsm-divider"></div>

              <div className="bsm-info-item total">
                <div className="icon-wrapper">
                  <Wallet size={18} />
                </div>
                <div className="details">
                  <span className="label">Đặt cọc bàn</span>
                  <span className="value highlight">
                    {formatPrice(
                      selectedTable.price || selectedTable.depositAmount
                    )}
                  </span>
                </div>
              </div>

              <div className="bsm-info-item total">
                <div className="icon-wrapper">
                  <UtensilsCrossed size={18} />
                </div>
                <div className="details">
                  <span className="label">Cọc món tạm tính</span>
                  <span className="value highlight">
                    {menuDeposit > 0
                      ? formatPrice(menuDeposit)
                      : "Chưa có món"}
                  </span>
                </div>
              </div>

              <div className="bsm-info-item">
                <div className="details">
                  <span className="label">Món đã chọn</span>
                  <span className="value">
                    {menuItemsCount} món trong giỏ
                  </span>
                </div>
                {onOrderDishes && (
                  <button
                    className="bsm-btn bsm-btn-secondary"
                    onClick={onOrderDishes}
                  >
                    Chọn món đi kèm
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Trạng thái chưa chọn bàn (Empty State) */
          <div className="bsm-empty-state">
            <div className="bsm-empty-icon">
              <UtensilsCrossed size={48} strokeWidth={1.6} />
            </div>
            <p className="bsm-empty-text">Vui lòng chọn bàn trên sơ đồ</p>
            <span className="bsm-empty-subtext">Bấm vào bàn màu xanh để tiếp tục đặt bàn</span>
          </div>
        )}
      </div>

      {/* --- Footer Actions --- */}
      <div className="bsm-footer">
        <button
          className="bsm-btn bsm-btn-confirm"
          disabled={!selectedTable}
          onClick={onConfirm}
        >
          Xác nhận đặt bàn
        </button>

        {selectedTable && (
          <button className="bsm-btn bsm-btn-cancel" onClick={onCancel}>
            <span>Hủy chọn</span>
            <XCircle size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingSummary;
