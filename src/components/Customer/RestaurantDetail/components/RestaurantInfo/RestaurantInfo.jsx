import React from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import "./RestaurantInfo.scss";

const formatAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.line1, address.district, address.city].filter(Boolean).join(", ");
};

const getDirectionsUrl = (address, addressText) => {
  if (!address || !addressText) return "";
  if (address?.lat && address?.lng) {
    return `https://maps.google.com/?q=${address.lat},${address.lng}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(addressText)}`;
};

const RestaurantInfo = ({ restaurant }) => {
  const description = restaurant?.description?.trim();
  const amenities = Array.isArray(restaurant?.amenities) ? restaurant.amenities.filter(Boolean) : [];
  const openingText = restaurant?.openingStatusReason || restaurant?.openingHours || "";
  const phone = restaurant?.phone?.trim();
  const addressText = formatAddress(restaurant?.address);

  const hasRightColumn = Boolean(phone || addressText);
  const directionsUrl = getDirectionsUrl(restaurant?.address, addressText);

  return (
    <div className={`restaurant-info-premium ${hasRightColumn ? "has-sidebar" : "single-column"}`}>
      <div className="info-main">
        <section className="section-block">
          <h3>Thông tin nhà hàng</h3>
          <p>{description || "Thông tin đang được cập nhật"}</p>
        </section>

        {amenities.length > 0 && (
          <section className="section-block">
            <h4>Tiện ích</h4>
            <ul className="amenities-list">
              {amenities.map((amenity) => (
                <li key={amenity}>{amenity}</li>
              ))}
            </ul>
          </section>
        )}

        {openingText && (
          <section className="section-block">
            <h4>Giờ hoạt động</h4>
            <p><Clock size={14} /> {openingText}</p>
          </section>
        )}
      </div>

      {hasRightColumn && (
        <aside className="info-side section-block">
          <h4>Liên hệ</h4>
          {phone && <p><Phone size={14} /> {phone}</p>}
          {addressText && <p><MapPin size={14} /> {addressText}</p>}
          {addressText && directionsUrl && (
            <a className="direction-link" href={directionsUrl} target="_blank" rel="noreferrer">
              Chỉ đường
            </a>
          )}
        </aside>
      )}
    </div>
  );
};

export default RestaurantInfo;
