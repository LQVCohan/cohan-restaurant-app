import React, { useState } from "react";
import "../../styles/Homepage/TableBooking.scss";

const TableBooking = ({ restaurant, isOpen, onClose, onBookTable }) => {
  const [bookingData, setBookingData] = useState({
    date: "",
    time: "",
    guests: 2,
    name: "",
    phone: "",
    note: "",
  });

  const timeSlots = [
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
  ];

  const handleInputChange = (field, value) => {
    setBookingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onBookTable(bookingData);
  };

  if (!isOpen) return null;

  return (
    <div className="table-booking-overlay">
      <div className="table-booking">
        <div className="table-booking__header">
          <h3 className="table-booking__title">Đặt bàn - {restaurant?.name}</h3>
          <button onClick={onClose} className="table-booking__close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="table-booking__form">
          <div className="table-booking__section">
            <h4 className="table-booking__section-title">Thông tin đặt bàn</h4>

            <div className="table-booking__row">
              <div className="table-booking__field">
                <label className="table-booking__label">Ngày</label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className="table-booking__input"
                  required
                />
              </div>

              <div className="table-booking__field">
                <label className="table-booking__label">Số khách</label>
                <select
                  value={bookingData.guests}
                  onChange={(e) =>
                    handleInputChange("guests", parseInt(e.target.value))
                  }
                  className="table-booking__select"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} người
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-booking__field">
              <label className="table-booking__label">Giờ</label>
              <div className="table-booking__time-slots">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleInputChange("time", time)}
                    className={`table-booking__time-slot ${
                      bookingData.time === time
                        ? "table-booking__time-slot--selected"
                        : ""
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="table-booking__section">
            <h4 className="table-booking__section-title">Thông tin liên hệ</h4>

            <div className="table-booking__field">
              <label className="table-booking__label">Họ tên</label>
              <input
                type="text"
                value={bookingData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="table-booking__input"
                placeholder="Nhập họ tên"
                required
              />
            </div>

            <div className="table-booking__field">
              <label className="table-booking__label">Số điện thoại</label>
              <input
                type="tel"
                value={bookingData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="table-booking__input"
                placeholder="Nhập số điện thoại"
                required
              />
            </div>

            <div className="table-booking__field">
              <label className="table-booking__label">Ghi chú</label>
              <textarea
                value={bookingData.note}
                onChange={(e) => handleInputChange("note", e.target.value)}
                className="table-booking__textarea"
                placeholder="Yêu cầu đặc biệt (không bắt buộc)"
                rows="3"
              />
            </div>
          </div>

          <div className="table-booking__footer">
            <div className="table-booking__deposit">
              <span className="table-booking__deposit-label">Phí đặt cọc:</span>
              <span className="table-booking__deposit-amount">50,000đ</span>
            </div>
            <button type="submit" className="table-booking__submit">
              Đặt bàn & Thanh toán
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TableBooking;
