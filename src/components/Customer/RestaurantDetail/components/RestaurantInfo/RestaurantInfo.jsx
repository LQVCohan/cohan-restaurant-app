import React from "react";
import "./RestaurantInfo.scss";
import { formatAddress } from "../../../../../utils/formatters";
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
      <div className="restaurant-info__grid">
        {/* About Section */}
        <section className="info-section">
          <h2 className="info-section__title">📖 Giới thiệu</h2>
          <div className="info-section__content">
            <p className="restaurant-info__about">{restaurant.about}</p>

            <div className="restaurant-info__highlights">
              <h3>✨ Điểm nổi bật</h3>
              <ul className="highlights-list">
                {restaurant.highlights?.map((highlight, index) => (
                  <li key={index} className="highlights-item">
                    <span className="highlights-icon">✓</span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <div className="restaurant-info__row">
          <section className="info-section">
            <h2 className="info-section__title">🏪 Tiện ích</h2>
            <div className="info-section__content">
              <div className="amenities-grid">
                {amenities.map((amenity) => (
                  <div
                    key={amenity.id}
                    className={`amenity-item ${
                      amenity.available
                        ? "amenity-item--available"
                        : "amenity-item--unavailable"
                    }`}
                  >
                    <span className="amenity-icon">{amenity.icon}</span>
                    <span className="amenity-label">{amenity.label}</span>
                    <span className="amenity-status">
                      {amenity.available ? "✅" : "❌"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Working Hours */}
          <section className="info-section">
            <h2 className="info-section__title">🕒 Giờ hoạt động</h2>
            <div className="info-section__content">
              <div className="working-hours">
                {workingHours.map((schedule, index) => (
                  <div key={index} className="working-hours__item">
                    <span className="working-hours__day">{schedule.day}</span>
                    <span className="working-hours__time">
                      {schedule.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        {/* Amenities Section */}

        {/* Location & Contact */}
        <section className="info-section">
          <h2 className="info-section__title">📍 Vị trí & Liên hệ</h2>
          <div className="info-section__content">
            <div className="contact-info">
              <div className="contact-item">
                <span className="contact-icon">📍</span>
                <div className="contact-details">
                  <strong>Địa chỉ:</strong>
                  <p>{formatAddress(restaurant.address)}</p>
                </div>
              </div>

              <div className="contact-item">
                <span className="contact-icon">📞</span>
                <div className="contact-details">
                  <strong>Điện thoại:</strong>
                  <p>{restaurant.phone}</p>
                </div>
              </div>

              <div className="contact-item">
                <span className="contact-icon">✉️</span>
                <div className="contact-details">
                  <strong>Email:</strong>
                  <p>{restaurant.email || "Chưa cập nhật"}</p>
                </div>
              </div>

              <div className="contact-item">
                <span className="contact-icon">🌐</span>
                <div className="contact-details">
                  <strong>Website:</strong>
                  <p>{restaurant.website || "Chưa cập nhật"}</p>
                </div>
              </div>
            </div>

            {/* Map placeholder */}
            <div className="map-container">
              <div className="map-placeholder">
                <span className="map-icon">🗺️</span>
                <p>Bản đồ sẽ được hiển thị tại đây</p>
                <button className="btn btn--secondary">
                  📍 Xem trên Google Maps
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RestaurantInfo;
