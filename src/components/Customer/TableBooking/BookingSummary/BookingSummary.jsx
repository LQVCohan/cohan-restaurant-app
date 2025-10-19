import React from "react";
import "./BookingSummary.scss";

const BookingSummary = ({ selectedTable, onConfirm, onCancel }) => {
  return (
    <div className="booking-summary">
      <h3 className="booking-summary__title">Thông tin đặt bàn</h3>

      <div className="booking-summary__list">
        <div className="booking-summary__item">
          <span className="booking-summary__label">Bàn:</span>
          <span className="booking-summary__value">
            {selectedTable ? selectedTable.label : "Chưa chọn"}
          </span>
        </div>
        <div className="booking-summary__item">
          <span className="booking-summary__label">Sức chứa:</span>
          <span className="booking-summary__value">
            {selectedTable ? `${selectedTable.capacity} người` : "—"}
          </span>
        </div>
        <div className="booking-summary__divider" />
        <div className="booking-summary__total">
          Tổng cộng:{" "}
          <span>
            {selectedTable ? selectedTable.price?.toLocaleString() + "đ" : "—"}
          </span>
        </div>
      </div>

      <div className="booking-summary__actions">
        <button
          className="booking-summary__button booking-summary__button--confirm"
          disabled={!selectedTable}
          onClick={onConfirm}
        >
          Xác nhận đặt bàn
        </button>
        <button
          className="booking-summary__button booking-summary__button--cancel"
          onClick={onCancel}
        >
          Hủy
        </button>
      </div>
    </div>
  );
};

export default BookingSummary;
