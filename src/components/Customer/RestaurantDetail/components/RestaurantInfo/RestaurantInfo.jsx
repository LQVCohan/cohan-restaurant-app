import React from "react";
import "./RestaurantInfo.scss";
import { formatAddress } from "../../../../../utils/formatters"; // Giả sử path này đúng

const RestaurantInfo = ({ restaurant }) => {
  const amenities = [
    {
      id: "wifi",
      icon: "📶",
      label: "WiFi miễn phí",
      available: restaurant.amenities?.wifi,
    },
    {
      id: "parking",
      icon: "🅿️",
      label: "Chỗ đậu xe",
      available: restaurant.amenities?.parking,
    },
    {
      id: "aircon",
      icon: "❄️",
      label: "Điều hòa",
      available: restaurant.amenities?.aircon,
    },
    {
      id: "card",
      icon: "💳",
      label: "Thanh toán thẻ",
      available: restaurant.amenities?.card,
    },
    {
      id: "delivery",
      icon: "🚚",
      label: "Giao hàng",
      available: restaurant.amenities?.delivery,
    },
    {
      id: "takeaway",
      icon: "🥡",
      label: "Mang về",
      available: restaurant.amenities?.takeaway,
    },
  ];

  const workingHours = [
    { day: "Thứ 2", hours: restaurant.workingHours?.monday || "9:00 - 22:00" },
    { day: "Thứ 3", hours: restaurant.workingHours?.tuesday || "9:00 - 22:00" },
    {
      day: "Thứ 4",
      hours: restaurant.workingHours?.wednesday || "9:00 - 22:00",
    },
    {
      day: "Thứ 5",
      hours: restaurant.workingHours?.thursday || "9:00 - 22:00",
    },
    { day: "Thứ 6", hours: restaurant.workingHours?.friday || "9:00 - 22:00" },
    {
      day: "Thứ 7",
      hours: restaurant.workingHours?.saturday || "9:00 - 23:00",
    },
    {
      day: "Chủ nhật",
      hours: restaurant.workingHours?.sunday || "9:00 - 23:00",
    },
  ];

  return (
    <div className="restaurant-info">
      {/* 1. About & Highlights */}
      <section className="info-section">
        <h2 className="section-title">📖 Giới thiệu</h2>
        <div className="about-content">
          <p className="description">{restaurant.about}</p>

          {restaurant.highlights && restaurant.highlights.length > 0 && (
            <div className="highlights-wrapper">
              <span className="sub-label">Điểm nổi bật:</span>
              <div className="tags-container">
                {restaurant.highlights.map((highlight, index) => (
                  <span key={index} className="highlight-tag">
                    ✨ {highlight}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="divider" />

      {/* 2. Amenities */}
      <section className="info-section">
        <h2 className="section-title">🏪 Tiện ích</h2>
        <div className="amenities-grid">
          {amenities.map((amenity) => (
            <div
              key={amenity.id}
              className={`amenity-card ${
                amenity.available ? "active" : "inactive"
              }`}
            >
              <span className="icon">{amenity.icon}</span>
              <span className="label">{amenity.label}</span>
              {/* Chỉ hiện dấu check nếu có, ẩn dấu x cho đỡ rối mắt */}
              {amenity.available && <span className="check">✓</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* 3. Info Grid (Hours & Contact) */}
      <div className="info-grid-row">
        {/* Working Hours */}
        <section className="info-section">
          <h2 className="section-title">🕒 Giờ hoạt động</h2>
          <div className="working-hours-list">
            {workingHours.map((schedule, index) => (
              <div key={index} className="hour-row">
                <span className="day">{schedule.day}</span>
                <span className="time">{schedule.hours}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contact & Map */}
        <section className="info-section">
          <h2 className="section-title">📍 Liên hệ & Vị trí</h2>
          <div className="contact-list">
            <div className="contact-row">
              <div className="icon-box">📍</div>
              <div className="info-text">
                <span className="label">Địa chỉ</span>
                <p className="value">{formatAddress(restaurant.address)}</p>
              </div>
            </div>

            <div className="contact-row">
              <div className="icon-box">📞</div>
              <div className="info-text">
                <span className="label">Điện thoại</span>
                <p className="value link">{restaurant.phone}</p>
              </div>
            </div>

            <div className="contact-row">
              <div className="icon-box">✉️</div>
              <div className="info-text">
                <span className="label">Email</span>
                <p className="value link">{restaurant.email || "--"}</p>
              </div>
            </div>

            <div className="contact-row">
              <div className="icon-box">🌐</div>
              <div className="info-text">
                <span className="label">Website</span>
                <p className="value link">{restaurant.website || "--"}</p>
              </div>
            </div>
          </div>

          <div className="mini-map-trigger">
            <span className="map-icon">🗺️</span>
            <span>Xem vị trí trên bản đồ</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RestaurantInfo;
