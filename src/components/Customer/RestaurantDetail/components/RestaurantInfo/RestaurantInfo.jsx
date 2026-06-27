import React from "react";
import { Clock, Info, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { getOpeningStatusLabel } from "@/utils/restaurantStatus";
import "./RestaurantInfo.scss";

const MAPS_BASE_URL = ["https:", "//maps.google.com/?q="].join("");

const formatAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.line1, address.district, address.city].filter(Boolean).join(", ");
};

const getDirectionsUrl = (address, addressText) => {
  if (address?.lat && address?.lng) {
    return `${MAPS_BASE_URL}${address.lat},${address.lng}`;
  }
  if (!addressText) return "";
  return `${MAPS_BASE_URL}${encodeURIComponent(addressText)}`;
};

const RestaurantInfo = ({ restaurant, isPreviewMode = false }) => {
  const description = restaurant?.description?.trim();
  const amenities = Array.isArray(restaurant?.amenities) ? restaurant.amenities.filter(Boolean) : [];
  const openingText = restaurant?.openingStatusReason || restaurant?.openingHours || "";
  const openingStatus = restaurant?.openingStatus;
  const phone = restaurant?.phone?.trim();
  const addressText = formatAddress(restaurant?.address);
  const directionsUrl = getDirectionsUrl(restaurant?.address, addressText);
  const tableSpaceUrl = restaurant?.id && !isPreviewMode
    ? `/restaurant/${encodeURIComponent(restaurant.id)}/layout?view=space`
    : "";

  return (
    <div className="restaurant-info-premium">
      <section className="info-card info-card--intro">
        <div className="title-row">
          <span className="title-icon"><Sparkles size={15} /></span>
          <h3>Thông tin nhà hàng</h3>
        </div>
        <p className={description ? "" : "placeholder-box"}>{description || "Nhà hàng đang cập nhật phần giới thiệu."}</p>
      </section>

      <section className="info-card">
        <div className="title-row">
          <span className="title-icon"><Clock size={15} /></span>
          <h4>Giờ hoạt động</h4>
        </div>
        {openingStatus && <span className={`status-chip ${openingStatus}`}>{getOpeningStatusLabel(openingStatus)}</span>}
        <div className="info-row">
          <p className={openingText ? "" : "placeholder-box"}>{openingText || "Lịch hoạt động đang được cập nhật."}</p>
        </div>
      </section>

      <section className="info-card">
        <div className="title-row">
          <span className="title-icon"><Sparkles size={15} /></span>
          <h4>Không gian bàn</h4>
        </div>
        <p>Xem sơ đồ tầng, vị trí bàn, ảnh không gian, 360 hoặc mô hình 3D nếu nhà hàng đã cập nhật.</p>
        {tableSpaceUrl ? (
          <a className="direction-link" href={tableSpaceUrl}>Xem không gian bàn / 360</a>
        ) : (
          <p className="placeholder-box">Không gian bàn đang được cập nhật.</p>
        )}
      </section>

      <section className="info-card">
        <div className="title-row">
          <span className="title-icon"><Info size={15} /></span>
          <h4>Tiện ích</h4>
        </div>
        {amenities.length > 0 ? (
          <ul className="amenities-list">
            {amenities.map((amenity) => (
              <li key={amenity} className="amenity-pill">{amenity}</li>
            ))}
          </ul>
        ) : (
          <p className="placeholder-box">Thông tin tiện ích đang được cập nhật.</p>
        )}
      </section>

      <section className="info-card info-card--contact">
        <div className="title-row">
          <span className="title-icon"><Phone size={15} /></span>
          <h4>Liên hệ</h4>
        </div>
        <div className="contact-row">
          <span className="contact-icon"><Phone size={14} /></span>
          <p className={phone ? "" : "placeholder-box"}>{phone || "Số điện thoại đang cập nhật."}</p>
        </div>
        <div className="contact-row">
          <span className="contact-icon"><MapPin size={14} /></span>
          <p className={addressText ? "" : "placeholder-box"}>{addressText || "Địa chỉ đang cập nhật."}</p>
        </div>
        {directionsUrl && (
          <a className="direction-link" href={directionsUrl} target="_blank" rel="noreferrer">
            Chỉ đường
          </a>
        )}
      </section>

      <section className="info-card info-card--policy">
        <div className="title-row">
          <span className="title-icon"><ShieldCheck size={15} /></span>
          <h4>Chính sách</h4>
        </div>
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
