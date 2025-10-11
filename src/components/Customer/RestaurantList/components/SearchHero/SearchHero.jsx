import React from "react";
import "./SearchHero.scss";

const SearchHero = ({ searchTerm, setSearchTerm, onSearch }) => {
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <section className="search-hero">
      <div className="search-hero__content">
        <h1 className="search-hero__title">Khám Phá Nhà Hàng Ngon</h1>
        <p className="search-hero__subtitle">
          Tìm kiếm và đặt bàn tại hàng nghìn nhà hàng chất lượng
        </p>
        <div className="search-hero__search-container">
          <input
            type="text"
            className="search-hero__search-box"
            placeholder="Tìm nhà hàng, món ăn, khu vực..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="search-hero__search-btn" onClick={onSearch}>
            🔍 Tìm kiếm
          </button>
        </div>
      </div>
    </section>
  );
};

export default SearchHero;
