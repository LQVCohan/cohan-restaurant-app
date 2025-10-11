import React, { useState } from "react";
import "../../../../styles/Homepage/HeroSection.scss";

const HeroSection = ({ onSearch }) => {
  const [address, setAddress] = useState("");

  const handleSearch = () => {
    onSearch(address);
  };

  return (
    <section id="home" className="hero">
      <div className="hero__container">
        <h2 className="hero__title">Đặt món ngon, giao tận nơi</h2>
        <p className="hero__subtitle">
          Khám phá hàng nghìn món ăn từ các nhà hàng uy tín. Đặt hàng dễ dàng,
          giao hàng nhanh chóng!
        </p>

        <div className="hero__search">
          <div className="hero__search-input">
            <input
              type="text"
              placeholder="Nhập địa chỉ giao hàng..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <span className="hero__search-icon">📍</span>
          </div>
          <button onClick={handleSearch} className="hero__search-btn">
            Tìm nhà hàng
          </button>
        </div>

        <div className="hero__stats">
          <div className="hero__stat">
            <div className="hero__stat-number">500+</div>
            <div className="hero__stat-label">Nhà hàng đối tác</div>
          </div>
          <div className="hero__stat">
            <div className="hero__stat-number">10,000+</div>
            <div className="hero__stat-label">Món ăn đa dạng</div>
          </div>
          <div className="hero__stat">
            <div className="hero__stat-number">50,000+</div>
            <div className="hero__stat-label">Khách hàng hài lòng</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
