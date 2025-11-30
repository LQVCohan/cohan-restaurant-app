import React from "react";
import "./BookingSummary.scss";

const BookingSummary = ({
  selectedTable,
  onConfirm,
  onCancel,
  selectedFloorName,
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
        <span className="bsm-subtitle">
          Kiểm tra thông tin trước khi xác nhận
        </span>
      </div>

      {/* --- Body --- */}
      <div className="bsm-body">
        {selectedTable ? (
          <>
            {/* 1. Visual hiển thị bàn đang chọn */}
            <div className="bsm-selected-visual">
              <div className="bsm-table-icon">
                <span className="label">{selectedTable.label}</span>
              </div>
              <div className="bsm-text-info">
                <span className="floor-badge">
                  {selectedFloorName || "Khu vực bàn"}
                </span>
                <span className="status-text">Đang được chọn</span>
              </div>
            </div>

            {/* 2. List thông tin chi tiết */}
            <div className="bsm-info-list">
              <div className="bsm-info-item">
                <div className="icon">👤</div>
                <div className="details">
                  <span className="label">Sức chứa</span>
                  <span className="value">{selectedTable.capacity} người</span>
                </div>
              </div>

              <div className="bsm-info-item">
                <div className="icon">📍</div>
                <div className="details">
                  <span className="label">Vị trí</span>
                  <span className="value">
                    {selectedFloorName || "Tầng trệt"}
                  </span>
                </div>
              </div>

              <div className="bsm-divider"></div>

              <div className="bsm-info-item total">
                <div className="details">
                  <span className="label">Chi phí đặt cọc</span>
                  <span className="value highlight">
                    {formatPrice(
                      selectedTable.price || selectedTable.depositAmount
                    )}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Trạng thái chưa chọn bàn (Empty State) */
          <div className="bsm-empty-state">
            <div className="bsm-empty-icon">🍽️</div>
            <p className="bsm-empty-text">
              Vui lòng chọn một bàn trống trên sơ đồ để xem chi tiết.
            </p>
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
            Hủy chọn
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingSummary;
