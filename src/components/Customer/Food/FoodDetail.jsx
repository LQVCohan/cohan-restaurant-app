import React, { useMemo, useState, useEffect } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Star,
  Clock,
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
import { useCart } from "../../../context/CartProvider";
import Cart from "../Homepage_Client/components/Cart";
import "./FoodDetail.scss";

const GET_TOP_MENU_ITEMS = gql`
  query GetTopMenuItemsForDetail($limit: Int = 120) {
    topMenuItems(limit: $limit) {
      id
      name
      description
      basePrice
      thumbImage
      point
      avgPrepTimeMin
      restaurantId
      menuId
      categoryId
      servingVariants {
        key
        name
        price
      }
    }
  }
`;

const RESTAURANT_BY_ID = gql`
  query RestaurantByIdForFoodDetail($id: ID!) {
    restaurant(id: $id) {
      id
      name
      address {
        line1
        district
        city
      }
    }
  }
`;

const formatPrice = (price) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price || 0);

const FoodDetail = () => {
  const { foodId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const preloadedDish = location.state?.dish || null;

  const {
    cart,
    addToCart,
    updateQuantity,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
  } = useQuery(GET_TOP_MENU_ITEMS, {
    variables: { limit: 120 },
    fetchPolicy: "cache-and-network",
    skip: !!preloadedDish,
  });

  const foundDish = useMemo(() => {
    if (preloadedDish) return preloadedDish;
    const list = menuData?.topMenuItems || [];
    return list.find((item) => String(item.id) === String(foodId)) || null;
  }, [menuData, foodId, preloadedDish]);

  const { data: restaurantData } = useQuery(RESTAURANT_BY_ID, {
    variables: { id: foundDish?.restaurantId },
    skip: !foundDish?.restaurantId,
  });

  const sizes = useMemo(() => {
    if (!foundDish) return [];
    const variants = foundDish.servingVariants || [];
    if (!variants.length) {
      return [
        {
          id: "standard",
          key: "standard",
          name: "Phần tiêu chuẩn",
          price: Number(foundDish.basePrice) || 0,
          priceAdd: 0,
        },
      ];
    }

    const base = Number(foundDish.basePrice) || 0;
    return variants.map((variant, idx) => {
      const finalPrice = Number(variant.price) || base;
      return {
        id: variant.key || `variant-${idx}`,
        key: variant.key || `variant-${idx}`,
        name: variant.name || `Tùy chọn ${idx + 1}`,
        price: finalPrice,
        priceAdd: finalPrice - base,
      };
    });
  }, [foundDish]);

  const [mainImage, setMainImage] = useState("/default-dishes.jpg");
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("detail");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAnimatingCart, setIsAnimatingCart] = useState(false);

  useEffect(() => {
    if (foundDish?.thumbImage) {
      setMainImage(foundDish.thumbImage);
    }
  }, [foundDish]);

  useEffect(() => {
    if (sizes.length) setSelectedSize(sizes[0]);
  }, [sizes]);

  const currentUnitPrice = selectedSize?.price ?? Number(foundDish?.basePrice) ?? 0;
  const totalPrice = currentUnitPrice * quantity;

  const restaurant = restaurantData?.restaurant;
  const restaurantAddress = [
    restaurant?.address?.line1,
    restaurant?.address?.district,
    restaurant?.address?.city,
  ]
    .filter(Boolean)
    .join(", ");

  const makeCartPayload = () => {
    if (!foundDish) return null;

    const selectedVariantName =
      selectedSize?.name && selectedSize.name !== "Phần tiêu chuẩn"
        ? selectedSize.name
        : "Phần tiêu chuẩn";

    return {
      id: selectedSize?.key
        ? `${foundDish.id}_${selectedSize.key}`
        : String(foundDish.id),
      dishId: foundDish.id,
      restaurantId: String(foundDish.restaurantId || restaurant?.id || ""),
      menuId: foundDish.menuId || null,
      categoryId: foundDish.categoryId || null,
      variantKey: selectedSize?.key || "standard",
      name: foundDish.name,
      price: currentUnitPrice,
      image: foundDish.thumbImage || "/default-dishes.jpg",
      method: selectedVariantName,
      quantity,
      restaurantName: restaurant?.name || null,
    };
  };

  const handleAddToCart = () => {
    const payload = makeCartPayload();
    if (!payload || !payload.restaurantId) return;
    addToCart(payload);
    setIsAnimatingCart(true);
    setTimeout(() => setIsAnimatingCart(false), 600);
  };

  const handleBuyNow = () => {
    const payload = makeCartPayload();
    if (!payload || !payload.restaurantId) return;
    addToCart(payload);
    navigate("/checkout", { state: { from: "/food/" + foodId } });
  };

  if (menuLoading && !foundDish) {
    return <div className="food-detail-wrapper">Đang tải thông tin món ăn...</div>;
  }

  if (menuError && !foundDish) {
    return (
      <div className="food-detail-wrapper">
        Không thể tải chi tiết món ăn. Vui lòng thử lại sau.
      </div>
    );
  }

  if (!foundDish) {
    return <div className="food-detail-wrapper">Không tìm thấy món ăn phù hợp.</div>;
  }

  return (
    <div className="food-detail-wrapper">
      <div className="food-detail-container">
        <div className="fd-breadcrumb">
          <span onClick={() => navigate("/")}>Trang chủ</span> <ChevronRight size={14} />
          <span className="current">{foundDish.name}</span>
        </div>

        <div className="fd-main-grid">
          <div className="fd-gallery">
            <div className="main-image-box">
              <img src={mainImage} alt={foundDish.name} />
              <div className="badges">
                <span className="badge-hot">
                  <Flame size={12} fill="currentColor" /> Món nổi bật
                </span>
              </div>
            </div>
            <div className="thumbnail-list">
              {[foundDish.thumbImage || "/default-dishes.jpg"].map((img, idx) => (
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

          <div className="fd-info-section">
            <div className="info-header">
              <span className="album-tag">Món ăn nhà hàng</span>
              <div className="actions">
                <button className="btn-icon" type="button">
                  <Heart size={20} />
                </button>
                <button className="btn-icon" type="button">
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            <h1 className="food-name">{foundDish.name}</h1>

            <div className="meta-info">
              <div className="rating">
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <span>{Number(foundDish.point || 0).toFixed(1)}</span>
                <span className="text-gray">(đánh giá cộng đồng)</span>
              </div>
              <div className="divider"></div>
              <div className="prep-time">
                <Clock size={16} />
                Thời gian chuẩn bị: {foundDish.avgPrepTimeMin || 20} phút
              </div>
            </div>

            <div className="price-box">
              <span className="current-price">{formatPrice(currentUnitPrice)}</span>
            </div>

            <div className="promo-box">
              <div className="promo-title">
                <Tag size={16} /> Ưu đãi áp dụng:
              </div>
              <ul className="promo-list">
                <li>Giảm giá theo chương trình của nhà hàng</li>
                <li>Giá thực tế sẽ được xác nhận tại bước thanh toán</li>
              </ul>
            </div>

            <div className="options-divider"></div>

            <div className="selection-area">
              <div className="option-group">
                <div className="option-title">
                  Chọn tùy chọn món <span className="required">*</span>
                </div>
                <div className="radio-grid">
                  {sizes.map((size) => (
                    <button
                      key={size.id}
                      className={`radio-btn ${selectedSize?.id === size.id ? "selected" : ""}`}
                      onClick={() => setSelectedSize(size)}
                      type="button"
                    >
                      {size.name}
                      {size.priceAdd > 0 && (
                        <span className="price-add">+{formatPrice(size.priceAdd)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-group">
                <div className="option-title">
                  Chi nhánh phục vụ <span className="required">*</span>
                </div>
                <div className="restaurant-list">
                  <div className="restaurant-item selected">
                    <div className="rest-info">
                      <Store size={18} />
                      <div>
                        <p className="rest-name">{restaurant?.name || "Nhà hàng"}</p>
                        <p className="rest-address">{restaurantAddress || "Đang cập nhật địa chỉ"}</p>
                      </div>
                    </div>
                    <div className="rest-stock">
                      <span className="in-stock">Sẵn sàng phục vụ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="action-area">
              <div className="quantity-control">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} type="button">
                  <Minus size={18} />
                </button>
                <input type="number" value={quantity} readOnly />
                <button onClick={() => setQuantity(quantity + 1)} type="button">
                  <Plus size={18} />
                </button>
              </div>

              <div className="action-buttons">
                <button className="btn-add-cart" onClick={handleAddToCart} type="button">
                  <ShoppingCart size={20} />
                  Thêm vào giỏ
                </button>
                <button className="btn-buy-now" onClick={handleBuyNow} type="button">
                  Đặt hàng ngay
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, fontWeight: 600 }}>
              Tạm tính: {formatPrice(totalPrice)}
            </div>
          </div>
        </div>

        <div className="fd-bottom-section">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === "detail" ? "active" : ""}`}
              onClick={() => setActiveTab("detail")}
              type="button"
            >
              Thông tin chi tiết
            </button>
            <button
              className={`tab-btn ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
              type="button"
            >
              Đánh giá từ khách hàng
            </button>
          </div>

          <div className="tabs-content">
            {activeTab === "detail" && (
              <div className="detail-content fade-in">
                <div className="detail-grid">
                  <div className="desc-block">
                    <h3>Mô tả món ăn</h3>
                    <p>
                      {foundDish.description ||
                        "Món ăn được chế biến từ nguyên liệu tươi ngon, phù hợp cho trải nghiệm ẩm thực hàng ngày."}
                    </p>
                  </div>
                  <div className="specs-block">
                    <div className="spec-item">
                      <ShieldCheck className="icon" />
                      <div>
                        <h4>Chất lượng đảm bảo</h4>
                        <p>Thông tin món ăn được đồng bộ trực tiếp từ menu nhà hàng.</p>
                      </div>
                    </div>
                    <div className="spec-item">
                      <Info className="icon" />
                      <div>
                        <h4>Giá hiển thị theo lựa chọn</h4>
                        <p>
                          Giá món thay đổi theo tùy chọn bạn chọn, hỗ trợ thêm vào giỏ và
                          đặt ngay.
                        </p>
                      </div>
                    </div>
                    <div className="spec-item">
                      <Flame className="icon" />
                      <div>
                        <h4>Phục vụ nhanh</h4>
                        <p>{foundDish.avgPrepTimeMin || 20} phút (ước tính).</p>
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
                  <p>Hiện chưa có module chi tiết đánh giá cho trang này.</p>
                </div>
              </div>
            )}
          </div>
        </div>

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        totalPrice={getTotalPrice()}
        onCheckoutSuccess={clearCart}
        onClearCart={clearCart}
        onRemoveRestaurantItems={removeRestaurantItems}
      />

      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setIsCartOpen(!isCartOpen)}
          className={`fd-cart-floating-btn ${isAnimatingCart ? "fd-cart-animating" : ""}`}
          aria-label="Xem giỏ hàng"
        >
          <span className="fd-cart-floating-btn__icon">🛒</span>
          <span className="fd-cart-floating-btn__count">
            {getTotalItems() > 99 ? "99+" : getTotalItems()}
          </span>
        </button>
      )}

      </div>
    </div>
  );
};

export default FoodDetail;
