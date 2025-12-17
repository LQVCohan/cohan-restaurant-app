import React, { useState } from "react";
import "./RestaurantInfo.scss";
import { formatAddress } from "../../../../../utils/formatters";
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
  Mail,
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
} from "lucide-react";

// --- MOCK DATA MỞ RỘNG (Giả lập dữ liệu chi tiết nếu API chưa có) ---
const EXTENDED_INFO = {
  paymentMethods: ["Visa", "MasterCard", "MoMo", "Tiền mặt"],
  dressCode: "Lịch sự / Casual",
  suitableFor: ["Hẹn hò", "Gia đình", "Tiếp khách", "Sinh nhật"],
  parkingDetail: "Có bãi đỗ xe ô tô miễn phí (Valet Parking)",
  ratings: { food: 4.8, service: 4.5, ambience: 4.7, value: 4.4 }, // Điểm thành phần
  faqs: [
    {
      q: "Nhà hàng có ghế trẻ em không?",
      a: "Có, chúng tôi trang bị sẵn ghế trẻ em.",
    },
    {
      q: "Có thể mang rượu từ ngoài vào không?",
      a: "Có, phí phục vụ (corkage fee) là 200k/chai.",
    },
    {
      q: "Nhà hàng có phòng riêng không?",
      a: "Có, chúng tôi có 3 phòng VIP sức chứa 10-20 người.",
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
  check: <Check size={14} />,
};

const RestaurantInfo = ({ restaurant }) => {
  // Merge dữ liệu thật và mock
  const fullData = { ...EXTENDED_INFO, ...restaurant };

  const amenities = [
    {
      id: "wifi",
      icon: Icons.wifi,
      label: "Wifi miễn phí",
      available: fullData.amenities?.wifi,
    },
    {
      id: "parking",
      icon: Icons.parking,
      label: "Đỗ xe",
      available: fullData.amenities?.parking,
    },
    {
      id: "aircon",
      icon: Icons.aircon,
      label: "Điều hòa",
      available: fullData.amenities?.aircon,
    },
    {
      id: "card",
      icon: Icons.card,
      label: "Thẻ tín dụng",
      available: fullData.amenities?.card,
    },
    {
      id: "delivery",
      icon: Icons.delivery,
      label: "Giao hàng",
      available: fullData.amenities?.delivery,
    },
    {
      id: "takeaway",
      icon: Icons.takeaway,
      label: "Mang về",
      available: fullData.amenities?.takeaway,
    },
  ];

  const workingHours = [
    { day: "Thứ 2", hours: fullData.workingHours?.monday || "09:00 - 22:00" },
    { day: "Thứ 3", hours: fullData.workingHours?.tuesday || "09:00 - 22:00" },
    {
      day: "Thứ 4",
      hours: fullData.workingHours?.wednesday || "09:00 - 22:00",
    },
    { day: "Thứ 5", hours: fullData.workingHours?.thursday || "09:00 - 22:00" },
    { day: "Thứ 6", hours: fullData.workingHours?.friday || "09:00 - 22:00" },
    { day: "Thứ 7", hours: fullData.workingHours?.saturday || "09:00 - 23:00" },
    {
      day: "Chủ nhật",
      hours: fullData.workingHours?.sunday || "09:00 - 23:00",
    },
  ];

  return (
    <div className="restaurant-info">
      {/* --- CỘT TRÁI: NỘI DUNG CHÍNH --- */}
      <div className="info-main-col">
        {/* 1. GIỚI THIỆU & TAGS */}
        <section className="info-block intro-block">
          <h3 className="block-title">📖 Câu chuyện thương hiệu</h3>
          <p className="description">
            {fullData.about ||
              "Nhà hàng mang đến trải nghiệm ẩm thực độc đáo, kết hợp tinh hoa truyền thống và phong cách hiện đại trong không gian sang trọng, ấm cúng."}
          </p>

          <div className="tags-wrapper">
            <div className="tag-group">
              <span className="label">Phù hợp:</span>
              {fullData.suitableFor.map((tag, i) => (
                <span key={i} className="tag-pill">
                  {tag}
                </span>
              ))}
            </div>
            {fullData.highlights?.length > 0 && (
              <div className="tag-group">
                <span className="label">Nổi bật:</span>
                {fullData.highlights.map((tag, i) => (
                  <span key={i} className="tag-pill highlight">
                    ✨ {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 2. ĐÁNH GIÁ CHI TIẾT (RATING BREAKDOWN) - MỚI */}
        <section className="info-block rating-block">
          <h3 className="block-title">⭐ Điểm đánh giá</h3>
          <div className="rating-grid">
            <RatingBar
              icon={<Utensils size={16} />}
              label="Món ăn"
              score={fullData.ratings.food}
            />
            <RatingBar
              icon={<Smile size={16} />}
              label="Phục vụ"
              score={fullData.ratings.service}
            />
            <RatingBar
              icon={<Music size={16} />}
              label="Không gian"
              score={fullData.ratings.ambience}
            />
            <RatingBar
              icon={<DollarSign size={16} />}
              label="Giá cả"
              score={fullData.ratings.value}
            />
          </div>
        </section>

        {/* 3. TIỆN ÍCH */}
        <section className="info-block amenities-block">
          <h3 className="block-title">✅ Tiện ích & Dịch vụ</h3>
          <div className="amenities-grid">
            {amenities.map((item) => (
              <div
                key={item.id}
                className={`amenity-item ${
                  item.available ? "active" : "inactive"
                }`}
              >
                <div className="icon-box">{item.icon}</div>
                <span className="label">{item.label}</span>
                {item.available && (
                  <span className="check-icon">
                    <Check size={14} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 4. FAQ (ACCORDION) - MỚI */}
        <section className="info-block faq-block">
          <h3 className="block-title">
            <HelpCircle size={20} /> Câu hỏi thường gặp
          </h3>
          <div className="faq-list">
            {fullData.faqs.map((faq, idx) => (
              <FAQItem key={idx} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>
      </div>

      {/* --- CỘT PHẢI: SIDEBAR THÔNG TIN --- */}
      <div className="info-sidebar-col">
        {/* 1. MAP & ADDRESS (Nâng cấp) */}
        <section className="info-block map-block">
          <div className="map-preview">
            <div className="map-overlay">
              <button
                className="btn-direction"
                onClick={() =>
                  window.open(
                    `https://maps.google.com/?q=${formatAddress(
                      fullData.address
                    )}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink size={16} /> Chỉ đường
              </button>
            </div>
          </div>
          <div className="address-content">
            <div className="addr-row">
              <MapPin size={20} className="icon" />
              <p>{formatAddress(fullData.address)}</p>
            </div>
            {fullData.parkingDetail && (
              <div className="parking-note">
                <Info size={14} /> {fullData.parkingDetail}
              </div>
            )}
          </div>
        </section>

        {/* 2. GIỜ HOẠT ĐỘNG */}
        <section className="info-block hours-block">
          <h3 className="sidebar-title">
            <Clock size={18} /> Giờ mở cửa
          </h3>
          <div className="hours-list">
            {workingHours.map((schedule, i) => (
              <div
                key={i}
                className={`hour-item ${
                  schedule.day === "Chủ nhật" ? "highlight" : ""
                }`}
              >
                <span className="day">{schedule.day}</span>
                <span className="time">{schedule.hours}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. THÔNG TIN KHÁC (GOOD TO KNOW) - MỚI */}
        <section className="info-block meta-block">
          <h3 className="sidebar-title">
            <Info size={18} /> Thông tin cần biết
          </h3>
          <ul className="meta-list">
            <li>
              <span className="meta-label">Trang phục:</span>
              <span className="meta-value">{fullData.dressCode}</span>
            </li>
            <li>
              <span className="meta-label">Thanh toán:</span>
              <span className="meta-value payment-icons">
                {fullData.paymentMethods.join(", ")}
              </span>
            </li>
          </ul>

          <div className="divider"></div>

          <div className="contact-links">
            <a href={`tel:${fullData.phone}`} className="c-link">
              <Phone size={16} /> Gọi điện
            </a>
            <a
              href={fullData.website}
              target="_blank"
              rel="noreferrer"
              className="c-link"
            >
              <Globe size={16} /> Website
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const RatingBar = ({ icon, label, score }) => (
  <div className="rating-bar-item">
    <div className="rb-header">
      <span className="rb-icon">{icon}</span>
      <span className="rb-label">{label}</span>
      <span className="rb-score">{score}</span>
    </div>
    <div className="rb-track">
      <div className="rb-fill" style={{ width: `${(score / 5) * 100}%` }}></div>
    </div>
  </div>
);

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div
      className={`faq-item ${isOpen ? "open" : ""}`}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="faq-question">
        <span>{question}</span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>
      <div className="faq-answer">{answer}</div>
    </div>
  );
};

export default RestaurantInfo;
