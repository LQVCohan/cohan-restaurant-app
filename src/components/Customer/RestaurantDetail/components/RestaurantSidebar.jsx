import React from "react";

export default function RestaurantSidebar({ restaurant }) {
  const { address } = restaurant || {};
  return (
    <aside className="sidebar">
      <div className="card">
        <h3>📞 Thông Tin Liên Hệ</h3>
        <div className="contact-item">
          <div className="contact-icon">📍</div>
          <div className="contact-info">
            <div className="contact-label">Địa chỉ</div>
            <div className="contact-value">
              {[address?.line1, address?.district, address?.city]
                .filter(Boolean)
                .join(", ")}
            </div>
          </div>
        </div>
        {restaurant.phone && (
          <div className="contact-item">
            <div className="contact-icon">📞</div>
            <div className="contact-info">
              <div className="contact-label">Điện thoại</div>
              <div className="contact-value">{restaurant.phone}</div>
            </div>
          </div>
        )}
        {restaurant.email && (
          <div className="contact-item">
            <div className="contact-icon">✉️</div>
            <div className="contact-info">
              <div className="contact-label">Email</div>
              <div className="contact-value">{restaurant.email}</div>
            </div>
          </div>
        )}
        <div className="contact-item">
          <div className="contact-icon">👥</div>
          <div className="contact-info">
            <div className="contact-label">Sức chứa</div>
            <div className="contact-value">
              {restaurant.seatingCapacity || 0} khách
            </div>
          </div>
        </div>
        {restaurant.priceRange && (
          <div className="contact-item">
            <div className="contact-icon">💰</div>
            <div className="contact-info">
              <div className="contact-label">Giá trung bình</div>
              <div className="contact-value">{restaurant.priceRange}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>🕐 Giờ Hoạt Động</h3>
        <table className="hours-table">
          <tbody>
            <tr>
              <td>Mở cửa</td>
              <td>{restaurant.openingHours || "—"}</td>
            </tr>
            <tr>
              <td>Đóng cửa</td>
              <td>{restaurant.closingHours || "—"}</td>
            </tr>
          </tbody>
        </table>
        {restaurant.notesOnHours && (
          <div className="note info">ℹ️ {restaurant.notesOnHours}</div>
        )}
      </div>

      <div className="card">
        <h3>✨ Tiện Ích</h3>
        <div className="amenities-grid">
          {(restaurant.amenities || []).map((a, i) => (
            <div key={i} className="amenity-item">
              • {a}
            </div>
          ))}
        </div>
        {restaurant.notesOnAmenities && (
          <div className="note tip">💡 {restaurant.notesOnAmenities}</div>
        )}
      </div>
    </aside>
  );
}
