import React, { useState, useMemo } from "react";
import "./RestaurantInfo.scss";
import {
  Wifi,
  Car,
  Wind,
  CreditCard,
  Truck,
  ShoppingBag,
  Check,
  MapPin,
  Phone,
  Globe,
  Clock,
  ExternalLink,
  Info,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Utensils,
  Smile,
  Music,
  DollarSign,
  Star,
  Calendar,
  ChefHat,
} from "lucide-react";

// --- MOCK UTILS & DATA ---
// Thay thế hàm mock cũ bằng hàm này
const formatAddress = (address) => {
  if (!address) return "Đang cập nhật";

  // Nếu API trả về string sẵn thì dùng luôn
  if (typeof address === "string") return address;

  // Nếu là Object (như lỗi bạn gặp), hãy nối các trường lại
  // Dựa vào keys trong lỗi: {line1, line2, ward, district, city, country}
  const parts = [
    address.line1,
    address.line2,
    address.ward,
    address.district,
    address.city,
    address.country,
  ];

  // Lọc bỏ các giá trị null/undefined/rỗng và nối bằng dấu phẩy
  return parts.filter((part) => part && part.trim() !== "").join(", ");
};

// Giả lập trạng thái mở cửa
const checkOpenStatus = () => {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 22
    ? { status: "open", text: "Đang mở cửa" }
    : { status: "closed", text: "Đã đóng cửa" };
};

const EXTENDED_INFO = {
  paymentMethods: ["Visa", "MasterCard", "AMEX", "MoMo", "Tiền mặt"],
  dressCode: "Smart Casual",
  chef: "Michelin Star Chef - Gordon Ramsay (Guest)",
  suitableFor: ["Hẹn hò lãng mạn", "Tiếp khách VIP", "Kỷ niệm", "Gia đình"],
  parkingDetail: "Valet Parking miễn phí tại sảnh chính",
  ratings: { food: 4.8, service: 4.9, ambience: 4.7, value: 4.5 },
  faqs: [
    {
      q: "Nhà hàng có yêu cầu đặt cọc không?",
      a: "Với nhóm trên 6 người, chúng tôi yêu cầu đặt cọc 30% giá trị dự kiến.",
    },
    {
      q: "Chính sách Corkage charge?",
      a: "Phí phục vụ rượu mang vào là 500.000 VNĐ/chai (Rượu mạnh/Vang).",
    },
    {
      q: "Có phòng riêng (Private Room) không?",
      a: "Có hệ thống phòng VIP cách âm, sức chứa 4-20 khách.",
    },
  ],
};

const Icons = {
  wifi: <Wifi size={18} />,
  parking: <Car size={18} />,
  aircon: <Wind size={18} />,
  card: <CreditCard size={18} />,
  delivery: <Truck size={18} />,
  takeaway: <ShoppingBag size={18} />,
};

const RestaurantInfo = ({ restaurant, isPreviewMode = false }) => {
  const fullData = { ...EXTENDED_INFO, ...restaurant };
  const { status, text: statusText } = checkOpenStatus();

  // Amenities Configuration
  const amenities = [
    {
      id: "wifi",
      icon: Icons.wifi,
      label: "High-speed Wifi",
      available: fullData.amenities?.wifi,
    },
    {
      id: "parking",
      icon: Icons.parking,
      label: "Valet Parking",
      available: fullData.amenities?.parking,
    },
    {
      id: "vip",
      icon: <Star size={18} />,
      label: "Phòng VIP",
      available: true,
    }, // Mock
    {
      id: "card",
      icon: Icons.card,
      label: "Thanh toán thẻ",
      available: fullData.amenities?.card,
    },
  ];

  const workingHours = [
    { day: "Thứ 2 - Thứ 6", hours: "09:00 - 22:00" },
    { day: "Thứ 7 - Chủ Nhật", hours: "09:00 - 23:00", isWeekend: true },
  ];

  return (
    <div className="restaurant-info-premium">
      {/* --- LEFT COLUMN: CONTENT EXPERIENCE --- */}
      <div className="info-content">
        {/* 1. BRAND STORY (Premium Typography) */}
        <section className="section-block intro-premium">
          <div className="section-header">
            <span className="subtitle">Về chúng tôi</span>
            <h3 className="title">Câu chuyện thương hiệu</h3>
          </div>
          <p className="description">
            {fullData.about ||
              "Trải nghiệm ẩm thực không chỉ là món ăn, đó là nghệ thuật đánh thức mọi giác quan. Chúng tôi mang đến sự giao thoa tinh tế giữa bản sắc truyền thống và kỹ thuật hiện đại."}
          </p>

          {fullData.chef && (
            <div className="chef-signature">
              <ChefHat size={24} className="icon" />
              <span>
                Bếp trưởng điều hành: <strong>{fullData.chef}</strong>
              </span>
            </div>
          )}

          <div className="tags-container">
            {fullData.suitableFor.map((tag, i) => (
              <span key={i} className="premium-tag">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* 2. RATINGS & AMENITIES (Grid Layout) */}
        <div className="dual-grid">
          <section className="section-block rating-premium">
            <h4 className="mini-title">Đánh giá chi tiết</h4>
            <div className="rating-wrapper">
              <RatingRow
                icon={<Utensils />}
                label="Hương vị"
                score={fullData.ratings.food}
              />
              <RatingRow
                icon={<Smile />}
                label="Phục vụ"
                score={fullData.ratings.service}
              />
              <RatingRow
                icon={<Music />}
                label="Không gian"
                score={fullData.ratings.ambience}
              />
              <RatingRow
                icon={<DollarSign />}
                label="Giá trị"
                score={fullData.ratings.value}
              />
            </div>
          </section>

          <section className="section-block amenities-premium">
            <h4 className="mini-title">Tiện ích cao cấp</h4>
            <div className="amenities-list">
              {amenities.map((item) => (
                <div
                  key={item.id}
                  className={`amenity-pill ${item.available ? "" : "disabled"}`}
                >
                  {item.icon} <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 3. FAQ ACCORDION */}
        <section className="section-block faq-premium">
          <h4 className="mini-title">Thông tin hữu ích</h4>
          <div className="faq-container">
            {fullData.faqs.map((faq, idx) => (
              <FAQItem key={idx} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>
      </div>

      {/* --- RIGHT COLUMN: STICKY SIDEBAR --- */}
      <aside className="info-sidebar">
        <div className="sidebar-sticky-content">
          {/* MAP CARD */}
          <div className="card map-card">
            <div className="map-visual">
              <div className="overlay">
                <button
                  className="btn-direction"
                  onClick={() => {
                    if (isPreviewMode) return;
                    window.open(
                      `http://maps.google.com/?q=${fullData.address}`,
                      "_blank"
                    );
                  }}
                  disabled={isPreviewMode}
                >
                  <MapPin size={16} /> Chỉ đường
                </button>
              </div>
            </div>
            <div className="card-body">
              <p className="address-text">{formatAddress(fullData.address)}</p>
              <div className="parking-info">
                <Info size={14} /> {fullData.parkingDetail}
              </div>
            </div>
          </div>

          {/* HOURS CARD */}
          <div className="card hours-card">
            <div className="card-header">
              <Clock size={18} />
              <span>Giờ mở cửa</span>
              <span className={`status-badge ${status}`}>{statusText}</span>
            </div>
            <div className="hours-list">
              {workingHours.map((h, i) => (
                <div
                  key={i}
                  className={`hour-row ${h.isWeekend ? "weekend" : ""}`}
                >
                  <span>{h.day}</span>
                  <span className="time">{h.hours}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ACTION CARD */}
          <div className="card action-card">
            <div className="meta-row">
              <span className="label">Trang phục:</span>
              <span className="value">{fullData.dressCode}</span>
            </div>
            <div className="divider"></div>
            <button className="btn-primary-action" disabled={isPreviewMode}>
              <Calendar size={18} /> Đặt bàn ngay
            </button>
            <div className="secondary-actions">
              <a
                href={isPreviewMode ? undefined : `tel:${fullData.phone}`}
                className={`btn-icon ${isPreviewMode ? "is-disabled" : ""}`}
                onClick={(event) => isPreviewMode && event.preventDefault()}
                aria-disabled={isPreviewMode}
              >
                <Phone size={18} />
              </a>
              <a
                href={isPreviewMode ? undefined : fullData.website}
                target={isPreviewMode ? undefined : "_blank"}
                rel={isPreviewMode ? undefined : "noreferrer"}
                className={`btn-icon ${isPreviewMode ? "is-disabled" : ""}`}
                onClick={(event) => isPreviewMode && event.preventDefault()}
                aria-disabled={isPreviewMode}
              >
                <Globe size={18} />
              </a>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

// --- SUB COMPONENTS ---
const RatingRow = ({ icon, label, score }) => (
  <div className="rating-row">
    <div className="r-label">
      {icon} <span>{label}</span>
    </div>
    <div className="r-bar-container">
      <div
        className="r-bar-fill"
        style={{ width: `${(score / 5) * 100}%` }}
      ></div>
    </div>
    <span className="r-score">{score}</span>
  </div>
);

const FAQItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`faq-item ${open ? "active" : ""}`}
      onClick={() => setOpen(!open)}
    >
      <div className="q-header">
        <span>{q}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      <div className="a-body">{a}</div>
    </div>
  );
};

export default RestaurantInfo;
