import React, { useMemo, useState, useEffect, useRef } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { Clock, LocateFixed, Sparkles, Star, Truck, Utensils } from "lucide-react";
import LocationPickerMap from "./LocationPickerMap";
import "../../../../styles/Homepage/HeroSection.scss";

const HERO_FALLBACK_IMAGES = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1100&q=88",
    alt: "Mâm món Việt giao nhanh",
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

const GET_HERO_TOP_RESTAURANTS = gql`
  query GetHeroTopRestaurants($limit: Int) {
    restaurantsTop(limit: $limit) {
      id
      name
      coverImage
      avatar
      avgRating
      reviewCount
      capabilities
    }
  }
`;

const GET_HERO_NEARBY_RESTAURANTS = gql`
  query GetHeroNearbyRestaurants($lat: Float!, $lng: Float!, $limit: Int) {
    restaurantsNearby(lat: $lat, lng: $lng, limit: $limit) {
      id
      name
      coverImage
      avatar
      avgRating
      reviewCount
      capabilities
      estimatedTravelMinutes
    }
  }
`;

const FALLBACK_HERO_METRICS = {
  ratingTitle: "4.9/5",
  ratingDesc: "Đánh giá tốt",
  timeTitle: "30 phút",
  timeDesc: "Giao siêu tốc",
  deliveryTitle: "Freeship",
  deliveryDesc: "Đơn từ 0đ",
};

const toFiniteNumber = (value) => {
  if (value == null) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

export const buildHeroSlides = (restaurants = []) =>
  HERO_FALLBACK_IMAGES.map((fallback, index) => {
    const restaurant = restaurants[index] || null;
    const image = String(restaurant?.coverImage || restaurant?.avatar || "").trim();

    return {
      id: restaurant?.id || fallback.id,
      src: image || fallback.src,
      fallbackSrc: fallback.src,
      alt: restaurant?.name
        ? `Món ăn nổi bật tại ${restaurant.name}`
        : fallback.alt,
      restaurant,
    };
  });

export const buildHeroMetrics = (restaurant) => {
  const rating = toFiniteNumber(restaurant?.avgRating);
  const reviewCount = toFiniteNumber(restaurant?.reviewCount);
  const estimatedTravelMinutes = toFiniteNumber(
    restaurant?.estimatedTravelMinutes
  );
  const deliveryCapability = restaurant?.capabilities?.acceptsDelivery;

  return {
    ratingTitle:
      rating != null && rating > 0
        ? `${Math.min(rating, 5).toFixed(1)}/5`
        : FALLBACK_HERO_METRICS.ratingTitle,
    ratingDesc:
      reviewCount != null && reviewCount > 0
        ? `${Math.round(reviewCount)} đánh giá`
        : FALLBACK_HERO_METRICS.ratingDesc,
    timeTitle:
      estimatedTravelMinutes != null && estimatedTravelMinutes > 0
        ? `${Math.max(1, Math.round(estimatedTravelMinutes))} phút`
        : FALLBACK_HERO_METRICS.timeTitle,
    timeDesc:
      estimatedTravelMinutes != null && estimatedTravelMinutes > 0
        ? "Ước tính đến bạn"
        : FALLBACK_HERO_METRICS.timeDesc,
    deliveryTitle:
      deliveryCapability === true
        ? "Có giao hàng"
        : deliveryCapability === false
          ? "Nhận tại quán"
          : FALLBACK_HERO_METRICS.deliveryTitle,
    deliveryDesc:
      deliveryCapability === true
        ? "Nhà hàng hỗ trợ"
        : deliveryCapability === false
          ? "Chưa hỗ trợ giao"
          : FALLBACK_HERO_METRICS.deliveryDesc,
  };
};

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

const buildShortAddressLabel = (address = {}, fallback = "") => {
  const parts = [
    address.road,
    address.suburb || address.neighbourhood,
    address.ward || address.quarter,
    address.district || address.city_district || address.county,
    address.city || address.town || address.village || address.state,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const uniqueParts = [...new Set(parts)];
  return (
    uniqueParts.slice(0, 4).join(", ") ||
    fallback ||
    "Vị trí hiện tại của bạn"
  );
};

const normalizeSuggestion = (item) => {
  const address = item.address || {};

  return {
    id: item.place_id,
    label: item.display_name,
    shortLabel: buildShortAddressLabel(address, item.display_name),
    lat: Number(item.lat),
    lng: Number(item.lon),
    address,
  };
};

const HeroSection = ({ onSearch }) => {
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const selectedLat = Number(selectedLocation?.lat);
  const selectedLng = Number(selectedLocation?.lng);
  const hasSelectedCoordinates =
    Number.isFinite(selectedLat) && Number.isFinite(selectedLng);

  const { data: topRestaurantData } = useQuery(GET_HERO_TOP_RESTAURANTS, {
    variables: { limit: HERO_FALLBACK_IMAGES.length },
    fetchPolicy: "cache-and-network",
  });

  const { data: nearbyRestaurantData } = useQuery(
    GET_HERO_NEARBY_RESTAURANTS,
    {
      skip: !hasSelectedCoordinates,
      variables: {
        lat: hasSelectedCoordinates ? selectedLat : 0,
        lng: hasSelectedCoordinates ? selectedLng : 0,
        limit: HERO_FALLBACK_IMAGES.length,
      },
      fetchPolicy: "cache-and-network",
    }
  );

  const liveRestaurants =
    nearbyRestaurantData?.restaurantsNearby?.length > 0
      ? nearbyRestaurantData.restaurantsNearby
      : topRestaurantData?.restaurantsTop || [];
  const heroSlides = useMemo(
    () => buildHeroSlides(liveRestaurants),
    [liveRestaurants]
  );

  // --- SLIDER LOGIC ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const activeSlide = heroSlides[currentSlide] || heroSlides[0];
  const heroMetrics = buildHeroMetrics(activeSlide?.restaurant);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const reverseDebounceRef = useRef(null);

  // Tự động chuyển ảnh sau 5s
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [currentSlide, heroSlides.length]);

  const handleNext = () => {
    setCurrentSlide((prev) =>
      prev === heroSlides.length - 1 ? 0 : prev + 1
    );
  };

  const handlePrev = () => {
    setCurrentSlide((prev) =>
      prev === 0 ? heroSlides.length - 1 : prev - 1
    );
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

    if (isLocationPickerOpen) {
      setAddressSuggestions([]);
      return;
    }

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
          suggestions.length === 0
            ? "Không tìm thấy gợi ý địa chỉ phù hợp."
            : ""
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
  }, [address, isLocationPickerOpen]);

  useEffect(() => {
    return () => {
      if (reverseDebounceRef.current)
        clearTimeout(reverseDebounceRef.current);
    };
  }, []);

  const reverseGeocodeLocation = async (
    { lat, lng },
    fallbackLabel = "Vị trí hiện tại của bạn"
  ) => {
    try {
      setIsReverseGeocoding(true);
      const url =
        `${NOMINATIM_REVERSE}?format=jsonv2&addressdetails=1` +
        `&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "vi" },
      });

      if (!res.ok) {
        throw new Error("Không thể lấy địa chỉ từ tọa độ");
      }

      const data = await res.json();
      const label = buildShortAddressLabel(
        data?.address,
        data?.display_name || fallbackLabel
      );

      return {
        id: `map-${Date.now()}`,
        label,
        shortLabel: label,
        lat,
        lng,
        address: data?.address || {},
      };
    } catch {
      return {
        id: `map-${Date.now()}`,
        label: fallbackLabel,
        shortLabel: fallbackLabel,
        lat,
        lng,
        address: {},
      };
    } finally {
      setIsReverseGeocoding(false);
    }
  };

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
    if (!searchText && !selectedLocation) return;

    let location = selectedLocation;
    if (
      searchText &&
      (!location ||
        (location.label !== address && location.shortLabel !== address))
    ) {
      location = await resolveLocationByQuery(searchText);
    }

    if (location) {
      setIsLocationPickerOpen(false);
    }

    onSearch({
      search: searchText || location?.shortLabel || location?.label || "",
      location:
        location &&
        Number.isFinite(location.lat) &&
        Number.isFinite(location.lng)
          ? {
              lat: location.lat,
              lng: location.lng,
              label: location.shortLabel || location.label,
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

        setAddressSuggestions([]);
        setSuggestionMessage("");
        setSelectedLocation({
          id: `current-${Date.now()}`,
          label: "Vị trí hiện tại của bạn",
          shortLabel: "Vị trí hiện tại của bạn",
          lat,
          lng,
          address: {},
        });
        setAddress("Vị trí hiện tại của bạn");
        setIsLocationPickerOpen(true);

        const location = await reverseGeocodeLocation(
          { lat, lng },
          "Vị trí hiện tại của bạn"
        );

        setAddress(location.shortLabel || location.label);
        setSelectedLocation(location);
      },
      () => {
        setSuggestionMessage(
          "Không thể lấy vị trí hiện tại. Vui lòng bật GPS."
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handlePickSuggestion = (item) => {
    const label = item.shortLabel || item.label;
    setAddress(label);
    setSelectedLocation({ ...item, label });
    setAddressSuggestions([]);
    setSuggestionMessage("");
    setIsLocationPickerOpen(true);
  };

  const handleChangePickerLocation = ({ lat, lng }) => {
    const fallbackLabel =
      selectedLocation?.shortLabel ||
      selectedLocation?.label ||
      "Vị trí hiện tại của bạn";
    setSelectedLocation((prev) => ({
      ...(prev || { id: `map-${Date.now()}` }),
      lat,
      lng,
      label: fallbackLabel,
      shortLabel: fallbackLabel,
    }));

    if (reverseDebounceRef.current)
      clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(async () => {
      const location = await reverseGeocodeLocation(
        { lat, lng },
        fallbackLabel
      );
      setSelectedLocation(location);
      setAddress(location.shortLabel || location.label);
    }, 550);
  };

  const handleConfirmPickerLocation = () => {
    if (!selectedLocation) return;

    const label =
      selectedLocation.shortLabel ||
      selectedLocation.label ||
      "Vị trí hiện tại của bạn";
    if (reverseDebounceRef.current)
      clearTimeout(reverseDebounceRef.current);
    setAddress(label);
    setIsLocationPickerOpen(false);
    setAddressSuggestions([]);
    onSearch({
      search: label,
      location: {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        label,
      },
    });
  };

  const handleClosePicker = () => {
    if (reverseDebounceRef.current)
      clearTimeout(reverseDebounceRef.current);
    setIsLocationPickerOpen(false);
  };

  return (
    <section id="home" className="hero" aria-labelledby="home-hero-title">
      <div className="hero__container">
        <div className="hero__content">
          <div className="hero__badge">
            <Sparkles className="hero__badge-icon" aria-hidden="true" />
            <span>Giao hàng nhanh trong {heroMetrics.timeTitle}</span>
          </div>

          <h1 className="hero__title" id="home-hero-title">
            Món ngon <span className="text-highlight">giao nhanh</span>
            <br /> đến bạn
          </h1>

          <p className="hero__subtitle">
            Khám phá nhà hàng uy tín, đặt món dễ dàng và nhận món nóng hổi tại nhà.
          </p>

          <div
            className="hero__search-box"
            role="search"
            aria-label="Tìm nhà hàng theo địa chỉ giao hàng"
          >
            <div className="hero__input-wrapper">
              <span className="hero__icon-location" aria-hidden="true">
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
                  focusable="false"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Nhập địa chỉ giao hàng của bạn..."
                aria-label="Địa chỉ giao hàng"
                aria-describedby={
                  suggestionMessage ? "hero-suggestion-message" : undefined
                }
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSelectedLocation(null);
                  setIsLocationPickerOpen(false);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              onClick={handleUseCurrentLocation}
              className="hero__btn-location"
              type="button"
              aria-label="Dùng vị trí hiện tại để tìm nhà hàng"
            >
              <LocateFixed className="hero__btn-icon" aria-hidden="true" />
              Vị trí hiện tại
            </button>
            <button
              onClick={handleSearch}
              className="hero__btn-search"
              type="button"
            >
              Tìm nhà hàng
            </button>
          </div>

          {!isLocationPickerOpen &&
            (isSuggesting ||
              addressSuggestions.length > 0 ||
              suggestionMessage) && (
              <div
                className="hero__suggestions"
                aria-label="Gợi ý địa chỉ giao hàng"
              >
                {addressSuggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="hero__suggestion-item"
                    onClick={() => handlePickSuggestion(item)}
                    aria-label={`Chọn địa chỉ ${item.label}`}
                  >
                    {item.label}
                  </button>
                ))}
                {isSuggesting && (
                  <div
                    className="hero__suggestion-state"
                    role="status"
                    aria-live="polite"
                  >
                    Đang gợi ý địa chỉ...
                  </div>
                )}
                {!isSuggesting && suggestionMessage && (
                  <div
                    className="hero__suggestion-state"
                    id="hero-suggestion-message"
                    role="status"
                    aria-live="polite"
                  >
                    {suggestionMessage}
                  </div>
                )}
              </div>
            )}

          <div className="hero__stats" aria-label="Các thao tác chính trên Cohan">
            <div className="hero__stat-item" aria-label="Tìm nhà hàng gần bạn">
              <LocateFixed className="stat-icon" aria-hidden="true" />
              <strong className="stat-num">Tìm gần bạn</strong>
              <span className="stat-label">Gợi ý theo vị trí</span>
            </div>
            <div className="hero__stat-divider" aria-hidden="true"></div>
            <div className="hero__stat-item" aria-label="Đặt món nhanh">
              <Utensils className="stat-icon" aria-hidden="true" />
              <strong className="stat-num">Đặt món</strong>
              <span className="stat-label">Giữ món trong giỏ</span>
            </div>
            <div className="hero__stat-divider" aria-hidden="true"></div>
            <div className="hero__stat-item" aria-label="Theo dõi trạng thái đơn">
              <Clock className="stat-icon" aria-hidden="true" />
              <strong className="stat-num">Theo dõi</strong>
              <span className="stat-label">Cập nhật trạng thái</span>
            </div>
          </div>
        </div>

        <div
          className="hero__image-area"
          aria-label={
            activeSlide?.restaurant?.name
              ? `Nhà hàng nổi bật ${activeSlide.restaurant.name}`
              : "Ảnh món ăn nổi bật"
          }
        >
          <div className="hero__image-bg" aria-hidden="true"></div>

          <div
            className="hero__slider"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            aria-live="polite"
          >
            {heroSlides.map((img, index) => (
              <img
                key={img.id}
                src={img.src}
                alt={index === currentSlide ? img.alt : ""}
                aria-hidden={index !== currentSlide}
                className={`hero__main-img ${
                  index === currentSlide ? "active" : ""
                }`}
                onError={(event) => {
                  if (event.currentTarget.dataset.fallbackApplied) return;
                  event.currentTarget.dataset.fallbackApplied = "true";
                  event.currentTarget.src = img.fallbackSrc;
                }}
              />
            ))}
          </div>

          <button
            className="hero__slider-btn prev"
            type="button"
            onClick={handlePrev}
            aria-label="Xem ảnh món trước"
          >
            ‹
          </button>
          <button
            className="hero__slider-btn next"
            type="button"
            onClick={handleNext}
            aria-label="Xem ảnh món tiếp theo"
          >
            ›
          </button>

          <div className="hero__float-card float-review">
            <div className="float-icon">
              <Star aria-hidden="true" />
            </div>
            <div className="float-content">
              <span className="float-title">{heroMetrics.ratingTitle}</span>
              <span className="float-desc">{heroMetrics.ratingDesc}</span>
            </div>
          </div>

          <div className="hero__float-card float-time">
            <div className="float-icon">
              <Clock aria-hidden="true" />
            </div>
            <div className="float-content">
              <span className="float-title">{heroMetrics.timeTitle}</span>
              <span className="float-desc">{heroMetrics.timeDesc}</span>
            </div>
          </div>

          <div className="hero__float-card float-delivery">
            <div className="float-icon">
              <Truck aria-hidden="true" />
            </div>
            <div className="float-content">
              <span className="float-title">{heroMetrics.deliveryTitle}</span>
              <span className="float-desc">{heroMetrics.deliveryDesc}</span>
            </div>
          </div>
        </div>
      </div>

      {isLocationPickerOpen && selectedLocation && (
        <div className="hero__modal-backdrop" role="presentation">
          <div
            className="hero__modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Chọn vị trí giao hàng trên bản đồ"
          >
            <LocationPickerMap
              lat={selectedLocation.lat}
              lng={selectedLocation.lng}
              label={
                isReverseGeocoding
                  ? "Đang cập nhật địa chỉ..."
                  : selectedLocation.shortLabel || selectedLocation.label
              }
              onChangeLocation={handleChangePickerLocation}
              onConfirm={handleConfirmPickerLocation}
              onClose={handleClosePicker}
            />
          </div>
        </div>
      )}

      <div className="hero__wave-container" aria-hidden="true">
        <svg
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="hero__wave-svg"
          focusable="false"
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
