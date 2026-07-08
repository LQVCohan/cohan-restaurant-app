import React from "react";
import {
  CalendarDays,
  Car,
  ChefHat,
  Clock,
  CreditCard,
  Globe2,
  Info,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { getOpeningStatusLabel } from "@/utils/restaurantStatus";
import "./RestaurantInfo.scss";
import "./RestaurantInfo.complete.scss";

const MAPS_BASE_URL = ["https:", "//maps.google.com/?q="].join("");

const DAY_LABELS = {
  monday: "Thứ Hai",
  tuesday: "Thứ Ba",
  wednesday: "Thứ Tư",
  thursday: "Thứ Năm",
  friday: "Thứ Sáu",
  saturday: "Thứ Bảy",
  sunday: "Chủ Nhật",
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const CORE_AMENITY_LABELS = {
  wifi: "Wi-Fi",
  parking: "Bãi đỗ xe",
  card: "Thanh toán thẻ",
  airConditioning: "Điều hòa",
  privateRoom: "Phòng riêng",
  wheelchair: "Hỗ trợ xe lăn",
  childSeat: "Ghế trẻ em",
  petFriendly: "Thân thiện với thú cưng",
};

const formatAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [
    address.line1,
    address.line2,
    address.ward,
    address.district,
    address.city,
    address.country,
  ].filter(Boolean).join(", ");
};

const getDirectionsUrl = (address, addressText) => {
  const latText = String(address?.lat ?? "").trim();
  const lngText = String(address?.lng ?? "").trim();
  const lat = Number(latText);
  const lng = Number(lngText);

  if (latText && lngText && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${MAPS_BASE_URL}${lat},${lng}`;
  }
  if (!addressText) return "";
  return `${MAPS_BASE_URL}${encodeURIComponent(addressText)}`;
};

const parseCustomerInfo = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { story: String(value) };
  }
};

const normalizeWebsite = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const percent = amount <= 1 ? amount * 100 : amount;
  return `${Number(percent.toFixed(2))}%`;
};

const formatSlots = (slots) => {
  if (!Array.isArray(slots) || slots.length === 0) return "Nghỉ";
  const labels = slots
    .filter((slot) => slot?.open && slot?.close)
    .map((slot) => `${slot.open}–${slot.close}`);
  return labels.length > 0 ? labels.join(", ") : "Nghỉ";
};

const formatSpecialDate = (value) => {
  if (!value) return "Ngày đặc biệt";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatNextOpening = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const normalizeAmenities = (value, extraAmenities = []) => {
  const items = [];
  if (Array.isArray(value)) {
    items.push(...value.map((item) => String(item || "").trim()).filter(Boolean));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, enabled]) => {
      if (enabled) items.push(CORE_AMENITY_LABELS[key] || key);
    });
  }
  if (Array.isArray(extraAmenities)) {
    items.push(...extraAmenities.map((item) => String(item || "").trim()).filter(Boolean));
  }
  return [...new Set(items)];
};

const RestaurantInfo = ({ restaurant, isPreviewMode = false }) => {
  const customerInfo = parseCustomerInfo(restaurant?.notesOnAmenities);
  const description = String(restaurant?.description || "").trim();
  const story = String(customerInfo.story || "").trim();
  const phone = String(restaurant?.phone || "").trim();
  const email = String(restaurant?.email || "").trim();
  const website = normalizeWebsite(customerInfo.website);
  const addressText = restaurant?.addressText || formatAddress(restaurant?.address);
  const directionsUrl = getDirectionsUrl(restaurant?.address, addressText);

  const chefName = String(customerInfo.chef || restaurant?.chef || "").trim();
  const chefTitle = String(
    customerInfo.chefTitle || restaurant?.chefTitle || "Bếp trưởng điều hành",
  ).trim();
  const chefBio = String(customerInfo.chefBio || restaurant?.chefBio || "").trim();
  const chefSummary = chefBio || (
    chefName
      ? `Dẫn dắt phong cách ${restaurant?.cuisineType || restaurant?.cuisine || "ẩm thực"} tại ${restaurant?.name || "nhà hàng"}.`
      : ""
  );

  const amenities = normalizeAmenities(
    restaurant?.amenities,
    customerInfo.extraAmenities,
  );
  const suitableFor = Array.isArray(customerInfo.suitableFor)
    ? customerInfo.suitableFor.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const faqs = Array.isArray(customerInfo.faqs)
    ? customerInfo.faqs
      .map((item) => ({
        question: String(item?.q || item?.question || "").trim(),
        answer: String(item?.a || item?.answer || "").trim(),
      }))
      .filter((item) => item.question && item.answer)
    : [];

  const serviceModes = [
    restaurant?.canOrder && "Đặt món online",
    restaurant?.canTableOrder && "Gọi món tại bàn",
    restaurant?.canDelivery && "Giao hàng",
    restaurant?.canPickup && "Nhận tại quầy",
  ].filter(Boolean);

  const quickFacts = [
    restaurant?.priceRange && {
      icon: CreditCard,
      label: "Khoảng giá",
      value: restaurant.priceRange,
    },
    Number(restaurant?.seatingCapacity) > 0 && {
      icon: Users,
      label: "Sức chứa",
      value: `${Number(restaurant.seatingCapacity).toLocaleString("vi-VN")} khách`,
    },
    serviceModes.length > 0 && {
      icon: UtensilsCrossed,
      label: "Hình thức phục vụ",
      value: serviceModes.join(" · "),
    },
    customerInfo.dressCode && {
      icon: Info,
      label: "Trang phục",
      value: customerInfo.dressCode,
    },
    customerInfo.parkingDetail && {
      icon: Car,
      label: "Đỗ xe",
      value: customerInfo.parkingDetail,
    },
  ].filter(Boolean);

  const weeklyHours = restaurant?.weeklyOpeningHours && typeof restaurant.weeklyOpeningHours === "object"
    ? restaurant.weeklyOpeningHours
    : {};
  const weeklyRows = DAY_ORDER.map((day) => ({
    day,
    label: DAY_LABELS[day],
    value: formatSlots(weeklyHours[day]),
    hasData: Array.isArray(weeklyHours[day]),
  }));
  const hasWeeklyHours = weeklyRows.some((row) => row.hasData);
  const fallbackHours = restaurant?.openingHours && restaurant?.closingHours
    ? `${restaurant.openingHours}–${restaurant.closingHours}`
    : String(restaurant?.openingHours || "").trim();
  const openingNote = String(
    restaurant?.openingStatusReason || restaurant?.notesOnHours || "",
  ).trim();
  const nextOpeningText = formatNextOpening(restaurant?.nextOpeningTime);

  const specialHours = Array.isArray(restaurant?.specialHours)
    ? [...restaurant.specialHours]
      .filter((item) => item?.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5)
    : [];

  const reservationSettings = restaurant?.reservationSettings || {};
  const reservationPolicy = restaurant?.reservationPolicy || {};
  const policyRows = [
    {
      label: "Đặt bàn",
      value: restaurant?.canReserve ? "Đang nhận đặt bàn" : "Hiện không nhận đặt bàn",
      enabled: Boolean(restaurant?.canReserve),
    },
    {
      label: "Đặt món",
      value: restaurant?.canOrder ? "Đang nhận đặt món" : "Hiện không nhận đặt món",
      enabled: Boolean(restaurant?.canOrder),
    },
    formatMoney(reservationSettings.baseDepositAmount) && {
      label: "Cọc giữ bàn",
      value: formatMoney(reservationSettings.baseDepositAmount),
    },
    Number(reservationSettings.menuDepositPercent) > 0 && {
      label: "Cọc món đặt trước",
      value: `${Number(reservationSettings.menuDepositPercent)}% giá trị món`,
    },
    formatMoney(reservationSettings.changeTimeFee) && {
      label: "Phí đổi giờ",
      value: formatMoney(reservationSettings.changeTimeFee),
    },
    formatMoney(reservationSettings.changeTableFee) && {
      label: "Phí đổi bàn",
      value: formatMoney(reservationSettings.changeTableFee),
    },
    formatMoney(reservationSettings.serviceFee) && {
      label: "Phí phục vụ",
      value: formatMoney(reservationSettings.serviceFee),
    },
    formatPercent(reservationSettings.vatRate) && {
      label: "VAT",
      value: formatPercent(reservationSettings.vatRate),
    },
    Number(reservationPolicy.minAdvanceMinutes) > 0 && {
      label: "Đặt trước tối thiểu",
      value: `${Number(reservationPolicy.minAdvanceMinutes)} phút`,
    },
    Number(reservationPolicy.maxAdvanceDays) > 0 && {
      label: "Đặt trước tối đa",
      value: `${Number(reservationPolicy.maxAdvanceDays)} ngày`,
    },
  ].filter(Boolean);

  const hasSpaceImages = Array.isArray(restaurant?.spaceImages) && restaurant.spaceImages.length > 0;
  const hasVrTour = Boolean(String(restaurant?.vrTourUrl || "").trim());
  const tableSpaceUrl = hasSpaceImages && restaurant?.id && !isPreviewMode
    ? `/restaurant/${encodeURIComponent(restaurant.id)}/layout?view=space`
    : "";
  const vrTourUrl = hasVrTour && !isPreviewMode ? restaurant.vrTourUrl : "";

  return (
    <div className="restaurant-info-premium restaurant-info-complete">
      <section className="info-card info-card--intro">
        <div className="title-row">
          <span className="title-icon"><Sparkles size={15} /></span>
          <h3>Về nhà hàng</h3>
        </div>
        <p>{description || story || "Nhà hàng đang cập nhật phần giới thiệu."}</p>
        {description && story && story !== description && (
          <div className="brand-story">
            <strong>Câu chuyện thương hiệu</strong>
            <p>{story}</p>
          </div>
        )}
      </section>

      {quickFacts.length > 0 && (
        <section className="info-card" aria-labelledby="restaurant-quick-facts-title">
          <div className="title-row">
            <span className="title-icon"><Info size={15} /></span>
            <h4 id="restaurant-quick-facts-title">Thông tin cần biết</h4>
          </div>
          <div className="restaurant-fact-grid">
            {quickFacts.map(({ icon: Icon, label, value }) => (
              <div className="restaurant-fact" key={label}>
                <Icon size={17} aria-hidden="true" />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {chefName && (
        <section className="info-card info-card--chef" aria-labelledby="restaurant-brand-chef-title">
          <div className="title-row">
            <span className="title-icon"><ChefHat size={16} /></span>
            <div>
              <span className="chef-eyebrow">Gương mặt thương hiệu</span>
              <h4 id="restaurant-brand-chef-title">Bếp trưởng thương hiệu</h4>
            </div>
          </div>
          <div className="chef-profile">
            <div className="chef-monogram" aria-hidden="true">
              {chefName.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{chefName}</strong>
              <span>{chefTitle}</span>
              {chefSummary && <p>{chefSummary}</p>}
            </div>
          </div>
        </section>
      )}

      <section className="info-card" aria-labelledby="restaurant-opening-hours-title">
        <div className="title-row">
          <span className="title-icon"><Clock size={15} /></span>
          <h4 id="restaurant-opening-hours-title">Giờ hoạt động</h4>
        </div>
        {restaurant?.openingStatus && (
          <span className={`status-chip ${restaurant.openingStatus}`}>
            {getOpeningStatusLabel(restaurant.openingStatus)}
          </span>
        )}
        {openingNote && <p className="opening-note">{openingNote}</p>}
        {nextOpeningText && restaurant?.openingStatus !== "open" && (
          <p className="next-opening">Mở cửa tiếp theo: <strong>{nextOpeningText}</strong></p>
        )}
        {hasWeeklyHours ? (
          <div className="weekly-hours-list">
            {weeklyRows.map((row) => (
              <div className="weekly-hours-row" key={row.day}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>{fallbackHours || "Lịch hoạt động đang được cập nhật."}</p>
        )}
        {specialHours.length > 0 && (
          <div className="special-hours-block">
            <strong><CalendarDays size={15} aria-hidden="true" /> Lịch đặc biệt</strong>
            {specialHours.map((item) => (
              <div className="special-hours-row" key={`${item.date}-${item.reason || ""}`}>
                <span>{formatSpecialDate(item.date)}</span>
                <span>
                  {item.isClosed ? "Nghỉ" : formatSlots(item.slots)}
                  {item.reason ? ` · ${item.reason}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {(tableSpaceUrl || vrTourUrl) && (
        <section className="info-card" aria-labelledby="restaurant-space-title">
          <div className="title-row">
            <span className="title-icon"><Sparkles size={15} /></span>
            <h4 id="restaurant-space-title">Không gian nhà hàng</h4>
          </div>
          <p>Xem trước không gian thật do nhà hàng đã cập nhật trước khi chọn bàn.</p>
          <div className="info-link-row">
            {tableSpaceUrl && <a className="direction-link" href={tableSpaceUrl}>Xem không gian bàn</a>}
            {vrTourUrl && (
              <a className="direction-link" href={vrTourUrl} target="_blank" rel="noreferrer">
                Mở tour 360 / VR
              </a>
            )}
          </div>
        </section>
      )}

      {(amenities.length > 0 || suitableFor.length > 0) && (
        <section className="info-card" aria-labelledby="restaurant-amenities-title">
          <div className="title-row">
            <span className="title-icon"><Sparkles size={15} /></span>
            <h4 id="restaurant-amenities-title">Tiện ích và trải nghiệm phù hợp</h4>
          </div>
          {amenities.length > 0 && (
            <ul className="amenities-list" aria-label="Tiện ích">
              {amenities.map((amenity) => (
                <li key={amenity} className="amenity-pill">{amenity}</li>
              ))}
            </ul>
          )}
          {suitableFor.length > 0 && (
            <div className="suitable-for">
              <strong>Phù hợp với</strong>
              <div className="amenities-list">
                {suitableFor.map((item) => (
                  <span key={item} className="amenity-pill">{item}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {(phone || email || addressText || website) && (
        <section className="info-card info-card--contact" aria-labelledby="restaurant-contact-title">
          <div className="title-row">
            <span className="title-icon"><Phone size={15} /></span>
            <h4 id="restaurant-contact-title">Liên hệ và chỉ đường</h4>
          </div>
          {phone && (
            <div className="contact-row">
              <span className="contact-icon"><Phone size={14} /></span>
              <a href={`tel:${phone}`}>{phone}</a>
            </div>
          )}
          {email && (
            <div className="contact-row">
              <span className="contact-icon"><Mail size={14} /></span>
              <a href={`mailto:${email}`}>{email}</a>
            </div>
          )}
          {addressText && (
            <div className="contact-row">
              <span className="contact-icon"><MapPin size={14} /></span>
              <p>{addressText}</p>
            </div>
          )}
          {website && (
            <div className="contact-row">
              <span className="contact-icon"><Globe2 size={14} /></span>
              <a href={website} target="_blank" rel="noreferrer">Website nhà hàng</a>
            </div>
          )}
          {directionsUrl && (
            <a className="direction-link" href={directionsUrl} target="_blank" rel="noreferrer">
              Chỉ đường trên Google Maps
            </a>
          )}
        </section>
      )}

      <section className="info-card info-card--policy" aria-labelledby="restaurant-policy-title">
        <div className="title-row">
          <span className="title-icon"><ShieldCheck size={15} /></span>
          <h4 id="restaurant-policy-title">Chính sách trước khi đặt</h4>
        </div>
        <div className="policy-list policy-list--complete">
          {policyRows.map((item) => (
            <div className="policy-item" key={item.label}>
              <span>{item.label}</span>
              <span className={`policy-badge ${item.enabled === undefined ? "neutral" : item.enabled ? "enabled" : "disabled"}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="info-card" aria-labelledby="restaurant-faq-title">
          <div className="title-row">
            <span className="title-icon"><Info size={15} /></span>
            <h4 id="restaurant-faq-title">Câu hỏi thường gặp</h4>
          </div>
          <div className="restaurant-faq-list">
            {faqs.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RestaurantInfo;
