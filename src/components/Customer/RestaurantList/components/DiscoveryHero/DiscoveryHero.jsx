import React from "react";
import "./DiscoveryHero.scss";

const QUICK_TAGS = [
  { id: "near_me", label: "📍 Gần tôi", value: "distance" },
  { id: "top_rated", label: "⭐ Đánh giá 5*", value: "rating" },
  { id: "promo", label: "💎 Deal hời", value: "promo" },
  { id: "open_now", label: "🕒 Đang mở cửa", value: "open" },
];

const DiscoveryHero = ({ onQuickFilter }) => {
  return (
    <section className="discovery-hero">
      <div className="discovery-hero__content">
        <div className="text-content">
          <h1 className="hero-title">
            Hôm nay bạn muốn <span className="highlight">ăn gì?</span>
          </h1>
          <p className="hero-subtitle">
            Khám phá hàng ngàn địa điểm ăn uống hấp dẫn, được tuyển chọn kỹ
            lưỡng dành riêng cho bạn.
          </p>

          <div className="hero-tags">
            <span className="tags-label">Gợi ý nhanh:</span>
            <div className="tags-list">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  className="tag-chip"
                  onClick={() => onQuickFilter?.(tag.value)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Icons Decoration */}
        <div className="decoration-icons">
          <div className="float-icon icon-1">🍔</div>
          <div className="float-icon icon-2">🍕</div>
          <div className="float-icon icon-3">🍣</div>
        </div>
      </div>

      {/* Sóng kết nối xuống phần dưới */}
      <div className="discovery-hero__wave">
        <svg
          viewBox="0 0 1440 100"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Màu fill trùng với màu nền body của RestaurantList (#f8fafc) */}
          <path
            fill="#f8fafc"
            fillOpacity="1"
            d="M0,64L48,64C96,64,192,64,288,58.7C384,53,480,43,576,42.7C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,100L1392,100C1344,100,1248,100,1152,100C1056,100,960,100,864,100C768,100,672,100,576,100C480,100,384,100,288,100C192,100,96,100,48,100L0,100Z"
          ></path>
        </svg>
      </div>
    </section>
  );
};

export default DiscoveryHero;
