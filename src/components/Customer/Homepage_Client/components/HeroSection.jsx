import React, { useState, useEffect, useRef } from "react";
import "../../../../styles/Homepage/HeroSection.scss";

// Danh sách ảnh món ăn demo
const HERO_IMAGES = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=768&q=80",
    alt: "Món ngon 1",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=768&q=80",
    alt: "Pizza hấp dẫn",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=768&q=80",
    alt: "Salad healthy",
  },
];

const HeroSection = ({ onSearch }) => {
  const [address, setAddress] = useState("");

  // --- SLIDER LOGIC ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Tự động chuyển ảnh sau 5s
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  const handleNext = () => {
    setCurrentSlide((prev) => (prev === HERO_IMAGES.length - 1 ? 0 : prev + 1));
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev === 0 ? HERO_IMAGES.length - 1 : prev - 1));
  };

  // Xử lý vuốt tay (Swipe) trên Mobile
  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) {
      // Vuốt sang trái -> Next
      handleNext();
    }
    if (touchStartX.current - touchEndX.current < -50) {
      // Vuốt sang phải -> Prev
      handlePrev();
    }
  };

  const handleSearch = () => {
    onSearch(address);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <section id="home" className="hero">
      <div className="hero__container">
        {/* --- LEFT CONTENT (Giữ nguyên) --- */}
        <div className="hero__content">
          <div className="hero__badge">
            <span className="hero__badge-icon">🚀</span>
            <span>Giao hàng nhanh trong 30 phút</span>
          </div>

          <h1 className="hero__title">
            Thưởng thức món ngon <br />
            <span className="text-highlight">Giao tận nơi</span> cho bạn
          </h1>

          <p className="hero__subtitle">
            Khám phá hàng nghìn món ăn từ các nhà hàng uy tín. Đặt hàng dễ dàng,
            theo dõi lộ trình và nhận món nóng hổi ngay tại nhà!
          </p>

          <div className="hero__search-box">
            <div className="hero__input-wrapper">
              <span className="hero__icon-location">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Nhập địa chỉ giao hàng của bạn..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button onClick={handleSearch} className="hero__btn-search">
              Tìm nhà hàng
            </button>
          </div>

          <div className="hero__stats">
            <div className="hero__stat-item">
              <strong className="stat-num">500+</strong>
              <span className="stat-label">Đối tác</span>
            </div>
            <div className="hero__stat-divider"></div>
            <div className="hero__stat-item">
              <strong className="stat-num">10k+</strong>
              <span className="stat-label">Món ăn</span>
            </div>
            <div className="hero__stat-divider"></div>
            <div className="hero__stat-item">
              <strong className="stat-num">50k+</strong>
              <span className="stat-label">Khách hàng</span>
            </div>
          </div>
        </div>

        {/* --- RIGHT IMAGE AREA (UPDATED SLIDER) --- */}
        <div className="hero__image-area">
          <div className="hero__image-bg"></div>

          {/* Slider Wrapper */}
          <div
            className="hero__slider"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {HERO_IMAGES.map((img, index) => (
              <img
                key={img.id}
                src={img.src}
                alt={img.alt}
                className={`hero__main-img ${
                  index === currentSlide ? "active" : ""
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <button className="hero__slider-btn prev" onClick={handlePrev}>
            ‹
          </button>
          <button className="hero__slider-btn next" onClick={handleNext}>
            ›
          </button>

          {/* Floating Card 1 */}
          <div className="hero__float-card float-review">
            <div className="float-icon">⭐️</div>
            <div className="float-content">
              <span className="float-title">4.9/5</span>
              <span className="float-desc">Đánh giá tốt</span>
            </div>
          </div>

          {/* Floating Card 2 */}
          <div className="hero__float-card float-delivery">
            <div className="float-icon">🛵</div>
            <div className="float-content">
              <span className="float-title">Freeship</span>
              <span className="float-desc">Đơn từ 0đ</span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero__wave-container">
        <svg
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="hero__wave-svg"
        >
          <path
            fill="#ffffff"
            fillOpacity="1"
            d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          ></path>
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
