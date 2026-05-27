import React from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import { getOpeningStatusLabel } from "@/utils/restaurantStatus";
import "./RestaurantInfo.scss";

const formatAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.line1, address.district, address.city].filter(Boolean).join(", ");
};

const getDirectionsUrl = (address, addressText) => {
  if (address?.lat && address?.lng) {
    return `https://maps.google.com/?q=${address.lat},${address.lng}`;
  }
  if (!addressText) return "";
  return `https://maps.google.com/?q=${encodeURIComponent(addressText)}`;
};

const RestaurantInfo = ({ restaurant }) => {
  const description = restaurant?.description?.trim();
  const amenities = Array.isArray(restaurant?.amenities) ? restaurant.amenities.filter(Boolean) : [];
  const openingText = restaurant?.openingStatusReason || restaurant?.openingHours || "";
  const openingStatus = restaurant?.openingStatus;
  const phone = restaurant?.phone?.trim();
  const addressText = formatAddress(restaurant?.address);
  const directionsUrl = getDirectionsUrl(restaurant?.address, addressText);

  return (
    <div className="restaurant-info-premium">
      <section className="info-card info-card--intro">
        <h3>Thông tin nhà hàng</h3>
        <p className={description ? "" : "placeholder-text"}>
          {description || "Nhà hàng đang cập nhật phần giới thiệu."}
        </p>
      </section>

      <section className="info-card">
        <h4>Giờ hoạt động</h4>
        {openingStatus && <span className={`status-chip ${openingStatus}`}>{getOpeningStatusLabel(openingStatus)}</span>}
        <div className="info-row">
          <Clock size={14} />
          <p className={openingText ? "" : "placeholder-text"}>
            {openingText || "Lịch hoạt động đang được cập nhật."}
          </p>
        </div>
      </section>

      <section className="info-card">
        <h4>Tiện ích</h4>
        {amenities.length > 0 ? (
          <ul className="amenities-list">
            {amenities.map((amenity) => (
              <li key={amenity} className="amenity-pill">{amenity}</li>
            ))}
          </ul>
        ) : (
          <p className="placeholder-text">Thông tin tiện ích đang được cập nhật.</p>
        )}
      </section>

      <section className="info-card info-card--contact">
        <h4>Liên hệ</h4>
        <div className="info-row">
          <Phone size={14} />
          <p className={phone ? "" : "placeholder-text"}>{phone || "Số điện thoại đang cập nhật."}</p>
        </div>
        <div className="info-row">
          <MapPin size={14} />
          <p className={addressText ? "" : "placeholder-text"}>{addressText || "Địa chỉ đang cập nhật."}</p>
        </div>
        {directionsUrl && (
          <a className="direction-link" href={directionsUrl} target="_blank" rel="noreferrer">
            Chỉ đường
          </a>
        )}
      </section>

      <section className="info-card info-card--policy">
        <h4>Chính sách</h4>
        <div className="policy-list">
          <div className="policy-item">
            <span>Đặt bàn</span>
            <span className={`policy-badge ${restaurant?.canReserve === undefined ? "unknown" : restaurant?.canReserve ? "enabled" : "disabled"}`}>
              {restaurant?.canReserve === undefined ? "Đang cập nhật" : restaurant?.canReserve ? "Đang nhận đặt bàn" : "Hiện không nhận đặt bàn"}
            </span>
          </div>
          <div className="policy-item">
            <span>Đặt món</span>
            <span className={`policy-badge ${restaurant?.canOrder === undefined ? "unknown" : restaurant?.canOrder ? "enabled" : "disabled"}`}>
              {restaurant?.canOrder === undefined ? "Đang cập nhật" : restaurant?.canOrder ? "Đang nhận đặt món" : "Hiện không nhận đặt món"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RestaurantInfo;
