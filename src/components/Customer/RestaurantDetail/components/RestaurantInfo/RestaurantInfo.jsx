import React from "react";
import { MapPin, Phone, Globe, Clock } from "lucide-react";
import "./RestaurantInfo.scss";

const formatAddress = (address) => {
  if (!address) return "Thông tin đang được cập nhật";
  if (typeof address === "string") return address;
  return [address.line1, address.district, address.city].filter(Boolean).join(", ") || "Thông tin đang được cập nhật";
};

const getDirectionsUrl = (address) => {
  if (address?.lat && address?.lng) {
    return `https://maps.google.com/?q=${address.lat},${address.lng}`;
  }
  const q = encodeURIComponent(formatAddress(address));
  return `https://maps.google.com/?q=${q}`;
};

const RestaurantInfo = ({ restaurant, isPreviewMode = false }) => {
  const openingText = restaurant?.openingStatusReason || restaurant?.openingHours || "Thông tin đang được cập nhật";

  return (
    <div className="restaurant-info-premium">
      <section className="section-block">
        <h3>Thông tin nhà hàng</h3>
        <p>{restaurant?.description || "Thông tin đang được cập nhật"}</p>
      </section>

      <section className="section-block">
        <h4>Liên hệ</h4>
        <p><MapPin size={14} /> {formatAddress(restaurant?.address)}</p>
        {restaurant?.phone && <p><Phone size={14} /> {restaurant.phone}</p>}
        {restaurant?.website && (
          <p>
            <Globe size={14} />
            <a href={restaurant.website} target="_blank" rel="noreferrer">Website</a>
          </p>
        )}
        <p><Clock size={14} /> {openingText}</p>
      </section>

      {!isPreviewMode && (
        <section className="section-block">
          <a href={getDirectionsUrl(restaurant?.address)} target="_blank" rel="noreferrer">
            Chỉ đường
          </a>
        </section>
      )}
    </div>
  );
};

export default RestaurantInfo;
