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

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

const normalizeSuggestion = (item) => ({
  id: item.place_id,
  label: item.display_name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  address: item.address || {},
});

const HeroSection = ({ onSearch }) => {
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // --- SLIDER LOGIC ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

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


  useEffect(() => {
    const q = address.trim().toLowerCase();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 1) {
      setAddressSuggestions([]);
      setSuggestionMessage("");
      return;
    }

    // Gợi ý ngay từ cache để UI mượt, không cần request liên tục
    const cachedList = [];
    for (const [key, list] of cacheRef.current.entries()) {
      if (key.startsWith(q) || key.includes(q)) {
        cachedList.push(...list);
      }
    }

    const uniqCache = new Map();
    cachedList.forEach((item) => uniqCache.set(item.id, item));
    const localSuggestions = [...uniqCache.values()].slice(0, 6);

    if (localSuggestions.length > 0) {
      setAddressSuggestions(localSuggestions);
      setSuggestionMessage("");
    } else {
      const allCached = [];
      for (const list of cacheRef.current.values()) {
        allCached.push(...list);
      }

      if (allCached.length > 0) {
        const uniq = new Map();
        allCached.forEach((item) => uniq.set(item.id, item));
        const fallbackPool = [...uniq.values()]
          .filter((item) => item.label.toLowerCase().includes(q))
          .slice(0, 6);
        setAddressSuggestions(fallbackPool);
      }
    }

    // Nếu đã có cache theo key chính xác thì không request nữa
    if (cacheRef.current.has(q)) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setIsSuggesting(true);
        const url =
          `${NOMINATIM_SEARCH}?format=jsonv2&addressdetails=1&limit=6` +
          `&countrycodes=vn&q=${encodeURIComponent(address.trim())}`;

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept-Language": "vi" },
        });

        if (!res.ok) {
          throw new Error("Không thể lấy gợi ý địa chỉ");
        }

        const data = await res.json();
        const suggestions = (Array.isArray(data) ? data : []).map(
          normalizeSuggestion
        );

        cacheRef.current.set(q, suggestions);
        setAddressSuggestions(suggestions);
        setSuggestionMessage(
          suggestions.length === 0 ? "Không tìm thấy gợi ý địa chỉ phù hợp." : ""
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          setSuggestionMessage("Không thể tải gợi ý địa chỉ lúc này.");
        }
      } finally {
        setIsSuggesting(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address]);

  const resolveLocationByQuery = async (query) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;

    const exactCached = cacheRef.current.get(normalized);
    if (exactCached?.length) return exactCached[0];

    try {
      const url =
        `${NOMINATIM_SEARCH}?format=jsonv2&addressdetails=1&limit=1` +
        `&countrycodes=vn&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "vi" },
      });
      const data = await res.json();
      const first = data?.[0];
      if (!first) return null;
      const normalizedItem = normalizeSuggestion(first);
      cacheRef.current.set(normalized, [normalizedItem]);
      return normalizedItem;
    } catch {
      return null;
    }
  };

  const handleSearch = async () => {
    const searchText = address.trim();
    if (!searchText) return;

    let location = selectedLocation;
    if (!location || location.label !== address) {
      location = await resolveLocationByQuery(searchText);
    }

    onSearch({
      search: searchText,
      location:
        location && Number.isFinite(location.lat) && Number.isFinite(location.lng)
          ? {
              lat: location.lat,
              lng: location.lng,
              label: location.label,
            }
          : null,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSuggestionMessage("Thiết bị không hỗ trợ lấy vị trí hiện tại.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const url =
            `${NOMINATIM_REVERSE}?format=jsonv2&addressdetails=1` +
            `&lat=${lat}&lon=${lng}`;
          const res = await fetch(url, {
            headers: { "Accept-Language": "vi" },
          });
          const data = await res.json();
          const label = data?.display_name || "Vị trí hiện tại";
          const suggestion = {
            id: `current-${Date.now()}`,
            label,
            lat,
            lng,
            address: data?.address || {},
          };

          setAddress(label);
          setSelectedLocation(suggestion);
          onSearch({
            search: label,
            location: { lat, lng, label },
          });
        } catch {
          setAddress("Vị trí hiện tại");
          setSelectedLocation({ id: "current", label: "Vị trí hiện tại", lat, lng });
          onSearch({
            search: "Vị trí hiện tại",
            location: { lat, lng, label: "Vị trí hiện tại" },
          });
        }
      },
      () => {
        setSuggestionMessage("Không thể lấy vị trí hiện tại. Vui lòng bật GPS.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handlePickSuggestion = (item) => {
    setAddress(item.label);
    setSelectedLocation(item);
    setAddressSuggestions([]);
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
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSelectedLocation(null);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              onClick={handleUseCurrentLocation}
              className="hero__btn-location"
              type="button"
            >
              Vị trí hiện tại
            </button>
            <button onClick={handleSearch} className="hero__btn-search" type="button">
              Tìm nhà hàng
            </button>
          </div>

          {(isSuggesting || addressSuggestions.length > 0 || suggestionMessage) && (
            <div className="hero__suggestions">
              {addressSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="hero__suggestion-item"
                  onClick={() => handlePickSuggestion(item)}
                >
                  {item.label}
                </button>
              ))}
              {isSuggesting && (
                <div className="hero__suggestion-state">Đang gợi ý địa chỉ...</div>
              )}
              {!isSuggesting && suggestionMessage && (
                <div className="hero__suggestion-state">{suggestionMessage}</div>
              )}
            </div>
          )}

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
