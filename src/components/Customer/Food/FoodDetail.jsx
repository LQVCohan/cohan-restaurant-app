import React, { useState, useMemo } from "react";
import {
  Star,
  Clock,
  MapPin,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Heart,
  Share2,
  Info,
  ShieldCheck,
  Flame,
  Tag,
  Store,
} from "lucide-react";
import "./FoodDetail.scss";

// --- MOCK DATA CHI TIẾT MÓN ĂN ---
const MOCK_FOOD_DETAIL = {
  id: "F001",
  name: "Tôm Hùm Alaska Thượng Hạng",
  images: [
    "https://images.unsplash.com/photo-1599084942896-675e73455919?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1625631980722-63200dfd3220?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1559742811-822873691df8?auto=format&fit=crop&q=80&w=800",
  ],
  categories: ["Hải sản", "Món nướng", "Sang trọng"],
  album: "Đặc sản Biển Khơi 2026",
  basePrice: 1200000,
  discountPrice: 990000,
  promotions: ["Giảm 15% qua VNPAY", "Freeship bán kính 5km"],
  rating: 4.8,
  reviewsCount: 342,
  sold: 1205,
  prepTime: "25-30 phút",

  // Phân loại giá theo kích cỡ / trọng lượng
  sizes: [
    { id: "s1", name: "Phần vừa (500g)", priceAdd: 0 },
    { id: "s2", name: "Phần lớn (1KG)", priceAdd: 850000 },
    { id: "s3", name: "Khổng lồ (1.5KG)", priceAdd: 1600000 },
  ],

  // Cách chế biến
  prepMethods: [
    { id: "p1", name: "Nướng bơ tỏi", priceAdd: 0 },
    { id: "p2", name: "Nướng phô mai", priceAdd: 50000 },
    { id: "p3", name: "Hấp sả chanh", priceAdd: -20000 }, // Giảm giá nếu làm đơn giản
    { id: "p4", name: "Sốt tiêu đen", priceAdd: 30000 },
  ],

  // Chi nhánh & Số lượng tồn
  restaurants: [
    {
      id: "r1",
      name: "FoodHub CN Quận 1",
      stock: 5,
      distance: "2.5km",
      address: "123 Lê Lợi, Q1",
    },
    {
      id: "r2",
      name: "FoodHub CN Phú Nhuận",
      stock: 0,
      distance: "4.1km",
      address: "45 Phan Đình Phùng, PN",
    },
    {
      id: "r3",
      name: "FoodHub CN Thủ Đức",
      stock: 12,
      distance: "8.5km",
      address: "89 Võ Văn Ngân, TĐ",
    },
  ],

  // Thông tin chi tiết
  description:
    "Tôm hùm Alaska được nhập khẩu sống 100% qua đường hàng không. Thịt tôm săn chắc, ngọt ngào, kết hợp cùng các loại nước sốt đặc quyền của bếp trưởng nhà hàng mang lại trải nghiệm ẩm thực hoàng gia.",
  ingredients: [
    "Tôm hùm Alaska nguyên con",
    "Bơ lạt Pháp",
    "Tỏi Lý Sơn",
    "Phô mai Mozzarella",
    "Thảo mộc Tây Bắc",
  ],
  portionSize:
    "Phù hợp cho 2-4 người ăn. Mỗi phần đi kèm 1 bánh mì bơ tỏi và salad dầu dấm.",
  nutrition:
    "Lượng Calo: ~450kcal / 100g thịt tôm. Giàu Protein, Omega-3 và Canxi.",
};

const FoodDetail = ({ onClose }) => {
  const [food] = useState(MOCK_FOOD_DETAIL);
  const [mainImage, setMainImage] = useState(food.images[0]);

  // States cho các lựa chọn của khách hàng
  const [selectedSize, setSelectedSize] = useState(food.sizes[0]);
  const [selectedPrep, setSelectedPrep] = useState(food.prepMethods[0]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(
    food.restaurants.find((r) => r.stock > 0) || food.restaurants[0],
  );
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("detail"); // 'detail' | 'reviews'

  // Tính toán tổng giá dựa trên lựa chọn
  const currentUnitPrice = useMemo(() => {
    let price = food.discountPrice || food.basePrice;
    price += selectedSize.priceAdd;
    price += selectedPrep.priceAdd;
    return price;
  }, [food, selectedSize, selectedPrep]);

  const totalPrice = currentUnitPrice * quantity;

  // Format tiền tệ
  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const handleAddToCart = () => {
    if (selectedRestaurant.stock === 0) {
      alert("Chi nhánh này đã hết hàng, vui lòng chọn chi nhánh khác!");
      return;
    }
    const cartItem = {
      foodId: food.id,
      name: food.name,
      size: selectedSize.name,
      prep: selectedPrep.name,
      restaurantId: selectedRestaurant.id,
      quantity,
      price: currentUnitPrice,
      total: totalPrice,
    };
    console.log("Đã thêm vào giỏ:", cartItem);
    alert("Đã thêm món vào giỏ hàng thành công! 🛒");
  };

  return (
    <div className="food-detail-wrapper">
      <div className="food-detail-container">
        {/* BREADCRUMB & HEADER */}
        <div className="fd-breadcrumb">
          <span>Trang chủ</span> <ChevronRight size={14} />
          <span>{food.categories[0]}</span> <ChevronRight size={14} />
          <span className="current">{food.name}</span>
        </div>

        <div className="fd-main-grid">
          {/* CỘT TRÁI: HÌNH ẢNH */}
          <div className="fd-gallery">
            <div className="main-image-box">
              <img src={mainImage} alt={food.name} />
              <div className="badges">
                {food.discountPrice && (
                  <span className="badge-sale">Giảm giá</span>
                )}
                <span className="badge-hot">
                  <Flame size={12} fill="currentColor" /> Bán chạy
                </span>
              </div>
            </div>
            <div className="thumbnail-list">
              {food.images.map((img, idx) => (
                <div
                  key={idx}
                  className={`thumb-item ${mainImage === img ? "active" : ""}`}
                  onClick={() => setMainImage(img)}
                >
                  <img src={img} alt={`thumbnail-${idx}`} />
                </div>
              ))}
            </div>
          </div>

          {/* CỘT PHẢI: THÔNG TIN & ĐẶT HÀNG */}
          <div className="fd-info-section">
            <div className="info-header">
              <span className="album-tag">{food.album}</span>
              <div className="actions">
                <button className="btn-icon">
                  <Heart size={20} />
                </button>
                <button className="btn-icon">
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            <h1 className="food-name">{food.name}</h1>

            <div className="meta-info">
              <div className="rating">
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <span>{food.rating}</span>
                <span className="text-gray">
                  ({food.reviewsCount} đánh giá)
                </span>
              </div>
              <div className="divider"></div>
              <div className="sold">Đã bán {food.sold}</div>
              <div className="divider"></div>
              <div className="prep-time">
                <Clock size={16} /> Thời gian chuẩn bị: {food.prepTime}
              </div>
            </div>

            {/* Giá */}
            <div className="price-box">
              <span className="current-price">
                {formatPrice(currentUnitPrice)}
              </span>
              {food.discountPrice &&
                selectedSize.priceAdd === 0 &&
                selectedPrep.priceAdd === 0 && (
                  <span className="old-price">
                    {formatPrice(food.basePrice)}
                  </span>
                )}
            </div>

            {/* Khuyến mãi */}
            <div className="promo-box">
              <div className="promo-title">
                <Tag size={16} /> Ưu đãi áp dụng:
              </div>
              <ul className="promo-list">
                {food.promotions.map((promo, i) => (
                  <li key={i}>{promo}</li>
                ))}
              </ul>
            </div>

            <div className="options-divider"></div>

            {/* Các Tùy chọn */}
            <div className="selection-area">
              {/* Size / Trọng lượng */}
              <div className="option-group">
                <div className="option-title">
                  Chọn khẩu phần / Trọng lượng{" "}
                  <span className="required">*</span>
                </div>
                <div className="radio-grid">
                  {food.sizes.map((size) => (
                    <button
                      key={size.id}
                      className={`radio-btn ${selectedSize.id === size.id ? "selected" : ""}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size.name}
                      {size.priceAdd > 0 && (
                        <span className="price-add">
                          +{formatPrice(size.priceAdd)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cách chế biến */}
              <div className="option-group">
                <div className="option-title">
                  Cách chế biến <span className="required">*</span>
                </div>
                <div className="radio-grid">
                  {food.prepMethods.map((prep) => (
                    <button
                      key={prep.id}
                      className={`radio-btn ${selectedPrep.id === prep.id ? "selected" : ""}`}
                      onClick={() => setSelectedPrep(prep)}
                    >
                      {prep.name}
                      {prep.priceAdd !== 0 && (
                        <span className="price-add">
                          {prep.priceAdd > 0 ? "+" : ""}
                          {formatPrice(prep.priceAdd)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chi nhánh có sẵn */}
              <div className="option-group">
                <div className="option-title">
                  Chọn chi nhánh đặt hàng <span className="required">*</span>
                </div>
                <div className="restaurant-list">
                  {food.restaurants.map((rest) => (
                    <div
                      key={rest.id}
                      className={`restaurant-item ${selectedRestaurant.id === rest.id ? "selected" : ""} ${rest.stock === 0 ? "out-of-stock" : ""}`}
                      onClick={() =>
                        rest.stock > 0 && setSelectedRestaurant(rest)
                      }
                    >
                      <div className="rest-info">
                        <Store size={18} />
                        <div>
                          <p className="rest-name">{rest.name}</p>
                          <p className="rest-address">
                            {rest.address} • Cách {rest.distance}
                          </p>
                        </div>
                      </div>
                      <div className="rest-stock">
                        {rest.stock > 0 ? (
                          <span className="in-stock">
                            Còn {rest.stock} phần
                          </span>
                        ) : (
                          <span className="out-stock">Hết món</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Số lượng & Action */}
            <div className="action-area">
              <div className="quantity-control">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                  <Minus size={18} />
                </button>
                <input type="number" value={quantity} readOnly />
                <button onClick={() => setQuantity(quantity + 1)}>
                  <Plus size={18} />
                </button>
              </div>

              <div className="action-buttons">
                <button className="btn-add-cart" onClick={handleAddToCart}>
                  <ShoppingCart size={20} />
                  Thêm vào giỏ
                </button>
                <button className="btn-buy-now">Đặt hàng ngay</button>
              </div>
            </div>
          </div>
        </div>

        {/* TABS CHI TIẾT & ĐÁNH GIÁ */}
        <div className="fd-bottom-section">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === "detail" ? "active" : ""}`}
              onClick={() => setActiveTab("detail")}
            >
              Thông tin chi tiết
            </button>
            <button
              className={`tab-btn ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              Đánh giá từ khách hàng ({food.reviewsCount})
            </button>
          </div>

          <div className="tabs-content">
            {activeTab === "detail" && (
              <div className="detail-content fade-in">
                <div className="detail-grid">
                  <div className="desc-block">
                    <h3>Mô tả món ăn</h3>
                    <p>{food.description}</p>
                  </div>
                  <div className="specs-block">
                    <div className="spec-item">
                      <ShieldCheck className="icon" />
                      <div>
                        <h4>Thành phần chính</h4>
                        <p>{food.ingredients.join(", ")}</p>
                      </div>
                    </div>
                    <div className="spec-item">
                      <Info className="icon" />
                      <div>
                        <h4>Khẩu phần & Phụ đính</h4>
                        <p>{food.portionSize}</p>
                      </div>
                    </div>
                    <div className="spec-item">
                      <Flame className="icon" />
                      <div>
                        <h4>Thông tin dinh dưỡng</h4>
                        <p>{food.nutrition}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="reviews-content fade-in">
                <div className="empty-reviews">
                  <Star size={48} color="#e5e7eb" />
                  <p>
                    Phần hiển thị đánh giá của khách hàng (Tích hợp module
                    Review ở đây)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodDetail;
