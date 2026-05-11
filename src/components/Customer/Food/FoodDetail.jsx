import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useContext,
} from "react";
import { gql, useQuery, useMutation } from "@apollo/client";
import { io } from "socket.io-client";
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
import { AuthContext } from "../../../context/AuthContext";
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

const MENU_ITEM_LIVE_STATE = gql`
  query MenuItemLiveState($input: MenuItemLiveStateInput!) {
    menuItemLiveState(input: $input) {
      viewerCount
      maxAvailableQty
      outOfStock
      blocked
      blockedUntil
      abuseWarning
      policyMessage
      holdTtlSeconds
      myCartQty
      myHoldExpiresAt
      reservedCartQty
    }
  }
`;

const ADD_CART_ITEM = gql`
  mutation AddCartItem($input: AddCartItemInput!) {
    addCartItem(input: $input) {
      id
      totalQuantity
      totalAmount
      items {
        id
        restaurantId
        menuItemId
        name
        price
        quantity
        thumbImage
        note
        servingVariantKey
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const UPDATE_CART_ITEM = gql`
  mutation UpdateCartItem($input: UpdateCartItemInput!) {
    updateCartItem(input: $input) {
      id
      totalQuantity
      totalAmount
      items {
        id
        restaurantId
        menuItemId
        name
        price
        quantity
        thumbImage
        note
        servingVariantKey
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const REMOVE_CART_ITEM = gql`
  mutation RemoveCartItem($input: RemoveCartItemInput!) {
    removeCartItem(input: $input) {
      id
      totalQuantity
      totalAmount
      items {
        id
        restaurantId
        menuItemId
        quantity
        servingVariantKey
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const CLEAR_CART = gql`
  mutation ClearCart($input: ClearCartInput!) {
    clearCart(input: $input)
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

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const getCartMutationErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const FoodDetail = () => {
  const { foodId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const preloadedDish = location.state?.dish || null;
  const { user } = useContext(AuthContext) || {};

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
          id: "portion",
          key: "portion",
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
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (foundDish?.thumbImage) {
      setMainImage(foundDish.thumbImage);
    }
  }, [foundDish]);

  useEffect(() => {
    if (sizes.length) setSelectedSize(sizes[0]);
  }, [sizes]);

  const selectedServingKey = selectedSize?.key || null;

  const {
    data: liveStateData,
    refetch: refetchLiveState,
  } = useQuery(MENU_ITEM_LIVE_STATE, {
    variables: {
      input: {
        restaurantId: foundDish?.restaurantId,
        menuItemId: foundDish?.id,
        servingVariantKey: selectedServingKey,
        userId: user?.id,
      },
    },
    skip: !foundDish?.restaurantId || !foundDish?.id || !selectedServingKey,
    fetchPolicy: "network-only",
    pollInterval: 10000,
  });

  const [addCartItemMutation, { loading: addingToBackendCart }] =
    useMutation(ADD_CART_ITEM);
  const [updateCartItemMutation, { loading: updatingBackendCart }] =
    useMutation(UPDATE_CART_ITEM);
  const [removeCartItemMutation, { loading: removingBackendCart }] =
    useMutation(REMOVE_CART_ITEM);
  const [clearCartMutation, { loading: clearingBackendCart }] =
    useMutation(CLEAR_CART);

  const liveState = liveStateData?.menuItemLiveState;
  const socketRef = useRef(null);
  const expiredHoldRefetchKeyRef = useRef(null);

  useEffect(() => {
    if (!foundDish?.restaurantId || !foundDish?.id) return;
    const socket = io("http://localhost:4000", { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("joinRestaurant", foundDish.restaurantId);
      socket.emit("joinMenuItemView", {
        restaurantId: foundDish.restaurantId,
        menuItemId: foundDish.id,
      });
    });
    socket.on("inventoryEvents", (evt) => {
      if (!evt) return;
      if (String(evt.menuItemId || "") === String(foundDish.id)) {
        refetchLiveState?.();
      }
    });
    return () => {
      socket.emit("leaveMenuItemView", {
        restaurantId: foundDish.restaurantId,
        menuItemId: foundDish.id,
      });
      socket.disconnect();
    };
  }, [foundDish?.restaurantId, foundDish?.id, refetchLiveState]);

  useEffect(() => {
    if (!liveState?.myHoldExpiresAt) return undefined;
    setNowTick(Date.now());
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [liveState?.myHoldExpiresAt]);

  const myHoldRemainingSeconds = useMemo(() => {
    if (!liveState?.myHoldExpiresAt) return null;
    const expiresAtMs = new Date(liveState.myHoldExpiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) return null;
    return Math.max(0, Math.floor((expiresAtMs - nowTick) / 1000));
  }, [liveState?.myHoldExpiresAt, nowTick]);

  useEffect(() => {
    if (!liveState?.myHoldExpiresAt || myHoldRemainingSeconds !== 0) {
      expiredHoldRefetchKeyRef.current = null;
      return;
    }
    if (expiredHoldRefetchKeyRef.current === liveState.myHoldExpiresAt) return;
    expiredHoldRefetchKeyRef.current = liveState.myHoldExpiresAt;
    refetchLiveState?.();
  }, [liveState?.myHoldExpiresAt, myHoldRemainingSeconds, refetchLiveState]);

  const currentUnitPrice = selectedSize?.price ?? Number(foundDish?.basePrice || 0);
  const totalPrice = currentUnitPrice * quantity;

  const restaurant = restaurantData?.restaurant;
  const restaurantAddress = [
    restaurant?.address?.line1,
    restaurant?.address?.district,
    restaurant?.address?.city,
  ]
    .filter(Boolean)
    .join(", ");

  const liveStateReady = !!liveState;
  const maxAvailableQty = Number(liveState?.maxAvailableQty || 0);
  const isBlocked = !!liveState?.blocked;
  const isOutOfStock =
    liveStateReady && (!!liveState?.outOfStock || maxAvailableQty < 1);
  const quantityExceedsAvailable =
    liveStateReady && maxAvailableQty > 0 && quantity > maxAvailableQty;
  const addDisabled =
    addingToBackendCart ||
    !selectedServingKey ||
    !liveStateReady ||
    isBlocked ||
    isOutOfStock ||
    quantityExceedsAvailable;
  const plusDisabled =
    addingToBackendCart ||
    !selectedServingKey ||
    (liveStateReady &&
      (isBlocked ||
        isOutOfStock ||
        (maxAvailableQty > 0 && quantity >= maxAvailableQty)));

  const addToCartButtonText = addingToBackendCart
    ? "Đang giữ món..."
    : !selectedServingKey
      ? "Đang tải tùy chọn..."
      : !liveStateReady
        ? "Đang kiểm tra tồn..."
        : isBlocked
          ? "Tạm chặn giữ món"
          : isOutOfStock
            ? "Hết hàng"
            : quantityExceedsAvailable
              ? "Không đủ số lượng"
              : "Thêm vào giỏ";

  const cartActionBusy =
    updatingBackendCart || removingBackendCart || clearingBackendCart;

  const makeCartPayload = () => {
    if (!foundDish) return null;
    const servingVariantKey = selectedServingKey || "portion";

    const selectedVariantName =
      selectedSize?.name && selectedSize.name !== "Phần tiêu chuẩn"
        ? selectedSize.name
        : "Phần tiêu chuẩn";

    return {
      id: `${foundDish.id}_${servingVariantKey}`,
      dishId: foundDish.id,
      restaurantId: String(foundDish.restaurantId || restaurant?.id || ""),
      menuId: foundDish.menuId || null,
      categoryId: foundDish.categoryId || null,
      variantKey: servingVariantKey,
      servingVariantKey,
      name: foundDish.name,
      price: currentUnitPrice,
      image: foundDish.thumbImage || "/default-dishes.jpg",
      method: selectedVariantName,
      quantity,
      restaurantName: restaurant?.name || null,
      backendCartId: null,
      backendCartItemId: null,
      holdExpiresAt: null,
      holdStatus: null,
    };
  };

  const addCurrentSelectionToBackendCart = async () => {
    const payload = makeCartPayload();
    if (!payload || !payload.restaurantId) return null;
    if (!selectedServingKey) {
      alert("Vui lòng chọn tùy chọn món trước khi thêm vào giỏ.");
      return null;
    }

    if (!user?.id) {
      alert("Vui lòng đăng nhập trước khi thêm món vào giỏ.");
      return null;
    }

    if (isBlocked) {
      alert(liveState?.abuseWarning || "Bạn đang bị tạm chặn giữ món.");
      return null;
    }

    if (isOutOfStock || quantityExceedsAvailable) {
      alert(
        isOutOfStock
          ? "Món đã hết hàng."
          : "Số lượng bạn chọn vượt quá số suất còn có thể đặt.",
      );
      return null;
    }

    try {
      const { data } = await addCartItemMutation({
        variables: {
          input: {
            userId: user.id,
            restaurantId: payload.restaurantId,
            menuItemId: payload.dishId,
            name: payload.name,
            price: payload.price,
            quantity,
            thumbImage: payload.image,
            note: null,
            servingVariantKey: selectedServingKey || "portion",
          },
        },
      });

      const returnedItem = data?.addCartItem?.items?.find(
        (item) =>
          String(item?.menuItemId) === String(foundDish?.id) &&
          String(item?.servingVariantKey) ===
            String(selectedServingKey || "portion"),
      );

      const backendCartId = data?.addCartItem?.id || null;
      const backendCartItemId = returnedItem?.id || null;

      if (!backendCartId || !backendCartItemId) {
        try {
          await refetchLiveState?.();
        } catch (_refetchError) {
          // Giữ lỗi đồng bộ dòng giỏ hàng là lỗi chính cần báo cho người dùng.
        }

        alert("Không thể đồng bộ dòng giỏ hàng từ máy chủ. Vui lòng thử lại.");
        return null;
      }

      addToCart({
        ...payload,
        backendCartId,
        backendCartItemId,
        holdExpiresAt: returnedItem?.holdExpiresAt || payload.holdExpiresAt,
        holdStatus: returnedItem?.holdStatus || payload.holdStatus,
        servingVariantKey:
          returnedItem?.servingVariantKey || payload.servingVariantKey,
      });

      try {
        await refetchLiveState?.();
      } catch (_refetchError) {
        // Giữ flow add-to-cart thành công dù lần refetch realtime này bị trượt.
      }

      return {
        ...payload,
        backendCartId,
        backendCartItemId,
        holdExpiresAt: returnedItem?.holdExpiresAt || null,
        holdStatus: returnedItem?.holdStatus || null,
        servingVariantKey:
          returnedItem?.servingVariantKey || payload.servingVariantKey,
      };
    } catch (error) {
      alert(
        getCartMutationErrorMessage(
          error,
          "Không thể giữ món trong giỏ. Vui lòng thử lại.",
        ),
      );
      return null;
    }
  };

  const handleAddToCart = async () => {
    const addedItem = await addCurrentSelectionToBackendCart();
    if (!addedItem) return;
    setIsAnimatingCart(true);
    window.setTimeout(() => setIsAnimatingCart(false), 600);
  };

  const handleBuyNow = async () => {
    const addedItem = await addCurrentSelectionToBackendCart();
    if (!addedItem) return;
    navigate("/checkout", { state: { from: "/food/" + foodId } });
  };

  const getPrimaryBackendCartId = () =>
    cart.find((item) => item.backendCartId)?.backendCartId || null;

  const handleCartUpdateQuantity = async (itemId, delta) => {
    const item = cart.find((entry) => entry.id === itemId);
    if (!item) return;

    const nextQuantity = Math.max(
      1,
      Number(item.quantity || 1) + Number(delta || 0),
    );
    if (nextQuantity === Number(item.quantity || 1)) return;

    if (!item.backendCartId || !item.backendCartItemId) {
      alert(
        "Món này chưa được đồng bộ với giỏ hàng máy chủ. Vui lòng thêm lại món.",
      );
      return;
    }

    try {
      await updateCartItemMutation({
        variables: {
          input: {
            cartId: item.backendCartId,
            itemId: item.backendCartItemId,
            quantity: nextQuantity,
          },
        },
      });

      updateQuantity(itemId, delta);
      await refetchLiveState?.();
    } catch (error) {
      alert(
        getCartMutationErrorMessage(
          error,
          "Không thể cập nhật số lượng món. Vui lòng thử lại.",
        ),
      );
    }
  };

  const handleClearCart = async () => {
    if (!cart.length) return;

    const backendCartId = getPrimaryBackendCartId();
    if (!backendCartId) {
      alert("Giỏ hàng chưa được đồng bộ với máy chủ. Vui lòng tải lại trang.");
      return;
    }

    try {
      await clearCartMutation({
        variables: { input: { cartId: backendCartId } },
      });

      clearCart();
      await refetchLiveState?.();
    } catch (error) {
      alert(
        getCartMutationErrorMessage(
          error,
          "Không thể xóa giỏ hàng vì chưa trả được món đã giữ. Vui lòng thử lại.",
        ),
      );
    }
  };

  const handleRemoveRestaurantItems = async (restaurantId) => {
    const itemsToRemove = (cart || []).filter(
      (item) => String(item.restaurantId) === String(restaurantId),
    );

    if (!itemsToRemove.length) return;

    const missingBackend = itemsToRemove.some(
      (item) => !item.backendCartId || !item.backendCartItemId,
    );

    if (missingBackend) {
      alert(
        "Một số món chưa được đồng bộ với giỏ hàng máy chủ. Vui lòng tải lại trang.",
      );
      return;
    }

    try {
      for (const item of itemsToRemove) {
        await removeCartItemMutation({
          variables: {
            input: {
              cartId: item.backendCartId,
              itemId: item.backendCartItemId,
            },
          },
        });
      }

      removeRestaurantItems(restaurantId);
      await refetchLiveState?.();
    } catch (error) {
      alert(
        getCartMutationErrorMessage(
          error,
          "Không thể xóa món của nhà hàng này. Vui lòng thử lại.",
        ),
      );
    }
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
          <span onClick={() => navigate("/")}>Trang chủ</span>{" "}
          <ChevronRight size={14} />
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

            <div className="promo-box">
              <div className="promo-title">
                <Info size={16} /> Trạng thái realtime:
              </div>
              <ul className="promo-list fd-live-state-list">
                <li>
                  Người đang xem món: <b>{liveState?.viewerCount ?? 0}</b>
                </li>
                <li>
                  Còn đặt ngay: <b>{maxAvailableQty} suất</b>
                </li>
                <li>
                  Đang được giữ tạm: <b>{liveState?.reservedCartQty ?? 0} suất</b>
                </li>
                {Number(liveState?.myCartQty || 0) > 0 ? (
                  <li>
                    Bạn đang giữ: <b>{liveState?.myCartQty ?? 0} suất</b>
                  </li>
                ) : null}
                {liveState?.myHoldExpiresAt ? (
                  <li className="fd-live-state-countdown">
                    Hết hạn giữ món sau: <b>{formatCountdown(myHoldRemainingSeconds)}</b>
                  </li>
                ) : null}
                {liveState?.policyMessage ? <li>{liveState.policyMessage}</li> : null}
                {liveState?.abuseWarning ? (
                  <li className="fd-live-state-warning">{liveState.abuseWarning}</li>
                ) : null}
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
                        <p className="rest-address">
                          {restaurantAddress || "Đang cập nhật địa chỉ"}
                        </p>
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
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  type="button"
                  disabled={addingToBackendCart || quantity <= 1}
                >
                  <Minus size={18} />
                </button>
                <input type="number" value={quantity} readOnly />
                <button
                  onClick={() =>
                    setQuantity((current) =>
                      liveStateReady && maxAvailableQty > 0
                        ? Math.min(maxAvailableQty, current + 1)
                        : current + 1,
                    )
                  }
                  type="button"
                  disabled={plusDisabled}
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="action-buttons">
                <button
                  className="btn-add-cart"
                  onClick={handleAddToCart}
                  type="button"
                  disabled={addDisabled}
                >
                  <ShoppingCart size={20} />
                  {addToCartButtonText}
                </button>
                <button
                  className="btn-buy-now"
                  onClick={handleBuyNow}
                  type="button"
                  disabled={addDisabled}
                >
                  {addingToBackendCart ? "Đang giữ món..." : "Đặt hàng ngay"}
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
                          Giá món thay đổi theo tùy chọn bạn chọn, hỗ trợ thêm vào
                          giỏ và đặt ngay.
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
          onUpdateQuantity={handleCartUpdateQuantity}
          totalPrice={getTotalPrice()}
          onCheckoutSuccess={clearCart}
          onClearCart={handleClearCart}
          onRemoveRestaurantItems={handleRemoveRestaurantItems}
          isBusy={cartActionBusy}
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
