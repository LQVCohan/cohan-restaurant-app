import React from "react";
import "./RestaurantHeader.scss";

/**
 * Component hiển thị phần đầu trang chi tiết nhà hàng
 * Dữ liệu nhận từ props:
 * { id, name, avatar, coverImage, rating, status, cuisine, addressText }
 */
const RestaurantHeader = ({ restaurant, onReservationClick }) => {
  const { name, avatar, coverImage, rating, status, cuisine, addressText } =
    restaurant || {};

  const handleBack = () => {
    if (document.referrer) window.history.back();
    else window.location.href = "/";
  };

  const handleShare = async () => {
    const shareData = {
      title: name,
      text: `${name} • ${cuisine} • ${addressText || ""}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Đã sao chép liên kết!");
      }
    } catch {}
  };

  const handleCall = () => {
    window.open(`tel:${restaurant.phone || ""}`, "_blank");
  };

  const handleMap = () => {
    const query = encodeURIComponent(addressText || name);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
  };

  return (
    <div className="restaurant-header">
      <div className="restaurant-header__cover">
        <img
          src={coverImage}
          alt={name}
          className="restaurant-header__cover-img"
        />

        <div className="restaurant-header__overlay" />

        <div className="restaurant-header__top-actions">
          <button className="btn btn--secondary" onClick={handleBack}>
            ← Quay lại
          </button>
          <div className="restaurant-header__right-actions">
            <button className="btn btn--secondary" onClick={handleShare}>
              📤 Chia sẻ
            </button>
            <button className="btn btn--secondary" onClick={handleMap}>
              🗺️ Chỉ đường
            </button>
          </div>
        </div>

        <div className="restaurant-header__bottom">
          <div className="restaurant-header__avatar">
            <img src={avatar} alt={name} />
          </div>

          <div className="restaurant-header__info">
            <h1 className="restaurant-header__name">{name}</h1>

            <div className="restaurant-header__meta">
              <div className="restaurant-header__rating">
                ⭐ {rating ? rating.toFixed(1) : "Chưa có đánh giá"}
              </div>
              <div
                className={`restaurant-header__status status--${
                  status || "unknown"
                }`}
              >
                {status === "open"
                  ? "🟢 Đang mở"
                  : status === "closed"
                  ? "🔴 Đã đóng"
                  : "⚪ Không xác định"}
              </div>
              {cuisine && (
                <div className="restaurant-header__cuisine">🍽️ {cuisine}</div>
              )}
            </div>

            <p className="restaurant-header__address">
              📍 {addressText || "Địa chỉ đang cập nhật"}
            </p>
          </div>

          <div className="restaurant-header__actions">
            <button className="btn btn--secondary" onClick={handleCall}>
              📞 Gọi
            </button>
            <button className="btn btn--primary" onClick={onReservationClick}>
              📅 Đặt bàn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantHeader;
