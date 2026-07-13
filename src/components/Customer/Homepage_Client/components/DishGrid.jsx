import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { Flame, Leaf, PartyPopper, Star, UtensilsCrossed } from "lucide-react";
import {
  buildFoodDetailPath,
  buildFoodDetailState,
} from "../../../../utils/customerFoodNavigation";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
} from "../../../../utils/menuItemAvailability";
import { AuthContext } from "../../../../context/AuthContext";
import { useCart } from "../../../../context/CartProvider";
import { useNotification } from "../../../../hooks/useNotification";
import {
  buildFeaturedMenuPath,
  buildRestaurantNameMap,
  getFeaturedDishCandidateLimit,
  resolveFeaturedDishRating,
  selectFeaturedDishes,
} from "./featuredDishUtils";
import "../../../../styles/Homepage/DishGrid.scss";

const GET_TOP_MENU_ITEMS = gql`
  query GetTopMenuItems(
    $limit: Int = 32
    $categoryId: ID
    $categoryName: String
    $timeSlot: TimeSlot
  ) {
    topMenuItems(
      limit: $limit
      categoryId: $categoryId
      categoryName: $categoryName
      timeSlot: $timeSlot
    ) {
      id
      name
      description
      basePrice
      thumbImage
      point
      rate
      orderCounter
      menuId
      categoryId
      restaurantId
      defaultServingKey
      status
      inventoryStatus
      maxAvailable
      stockWarnings
      avgPrepTimeMin
      servingVariants {
        key
        name
        mode
        sellQty
        sellUnit
        price
        isDefault
      }
    }
    publicRestaurants(limit: 200) {
      edges {
        node {
          id
          name
          canOrder
          openingStatus
        }
      }
    }
  }
`;

const ADD_CART_ITEM = gql`
  mutation AddCartItemFromHome($input: AddCartItemInput!) {
    addCartItem(input: $input) {
      id
    }
  }
`;

const fallbackDishSuggestions = [
  {
    key: "today-combo",
    Icon: Flame,
    name: "Combo no nhanh hôm nay",
    description: "Gợi ý các món dễ ăn, đặt nhanh, phù hợp bữa trưa hoặc bữa tối.",
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=620&q=80",
    cta: "Xem combo",
    path: "/combos",
  },
  {
    key: "healthy-pick",
    Icon: Leaf,
    name: "Món nhẹ bụng",
    description: "Ưu tiên món ít dầu, nhiều rau hoặc khẩu vị cân bằng hơn.",
    image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=620&q=80",
    cta: "Khám phá",
    path: "/search?q=Healthy%20Salad",
  },
  {
    key: "group-meal",
    Icon: PartyPopper,
    name: "Ăn cùng bạn bè",
    description: "Các lựa chọn dễ chia sẻ như lẩu, nướng, hải sản hoặc món gọi chung.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=620&q=80",
    cta: "Xem nhà hàng",
    path: "/restaurants",
  },
];

const getMutationErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const DishGrid = ({
  selectedCategoryId = null,
  selectedCategoryName = "",
  timeSlot = null,
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = String(
    user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase();
  const isCustomer = roleName === "customer";
  const { refetchServerCart } = useCart();
  const { showNotification } = useNotification();
  const [addCartItemMutation] = useMutation(ADD_CART_ITEM);
  const hasCategoryFilter = Boolean(selectedCategoryId || selectedCategoryName);
  const displayLimit = hasCategoryFilter ? 12 : 8;
  const { data, loading, error } = useQuery(GET_TOP_MENU_ITEMS, {
    variables: {
      limit: getFeaturedDishCandidateLimit(displayLimit),
      categoryId: selectedCategoryId || undefined,
      categoryName: selectedCategoryName || undefined,
      timeSlot: timeSlot || undefined,
    },
    fetchPolicy: "network-only",
  });

  const [selectedVariantKeyByDish, setSelectedVariantKeyByDish] = useState({});
  const [addingDishId, setAddingDishId] = useState(null);

  const dishes = useMemo(() => data?.topMenuItems ?? [], [data]);
  const restaurantNameById = useMemo(
    () => buildRestaurantNameMap(data?.publicRestaurants),
    [data?.publicRestaurants],
  );
  const visibleDishes = useMemo(
    () =>
      selectFeaturedDishes(dishes, {
        limit: displayLimit,
        restaurantNameById,
      }),
    [dishes, displayLimit, restaurantNameById],
  );
  const defaultImg =
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80";

  const getVariantKey = (variant, fallbackIndex = 0) =>
    variant?.key || `variant-${fallbackIndex}`;

  const getDefaultMethod = (dish) => {
    const variants = dish.servingVariants || [];
    if (!variants.length) return null;

    if (dish.defaultServingKey) {
      const byDefaultKey = variants.find(
        (variant) => String(variant?.key || "") === String(dish.defaultServingKey),
      );
      if (byDefaultKey) return byDefaultKey;
    }

    return variants.find((variant) => variant?.isDefault) || variants[0];
  };

  const getSelectedMethod = (dish) => {
    const variants = dish.servingVariants || [];
    const selectedKey = selectedVariantKeyByDish[dish.id];

    if (selectedKey) {
      const selectedVariant = variants.find(
        (variant, index) => getVariantKey(variant, index) === selectedKey,
      );
      if (selectedVariant) return selectedVariant;
    }

    return getDefaultMethod(dish);
  };

  const getSelectedVariantKey = (dish) => {
    const variants = dish.servingVariants || [];
    const selectedVariant = getSelectedMethod(dish);
    const selectedIndex = variants.findIndex(
      (variant) => variant === selectedVariant,
    );
    if (selectedVariant) {
      return getVariantKey(selectedVariant, selectedIndex >= 0 ? selectedIndex : 0);
    }
    return variants[0] ? getVariantKey(variants[0], 0) : "portion";
  };

  const getEffectivePrice = (basePrice, variant) => {
    const variantPrice = Number(variant?.price);
    if (Number.isFinite(variantPrice) && variantPrice >= 0) return variantPrice;
    return Number(basePrice) || 0;
  };

  const handleMethodChange = (dishId, variantKey) => {
    setSelectedVariantKeyByDish((prev) => ({ ...prev, [dishId]: variantKey }));
  };

  const handleOpenAllDishes = () => {
    navigate(buildFeaturedMenuPath(timeSlot));
  };

  const scrollToRestaurants = () => {
    document.getElementById("restaurants")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleOpenFoodDetail = (dish) => {
    if (!dish?.id) return;
    const selectedVariantKey = getSelectedVariantKey(dish);

    const state = buildFoodDetailState(dish, {
      restaurantId: dish.restaurantId,
      timeSlot,
      categoryId: dish.categoryId,
      selectedVariantKey,
    });

    navigate(buildFoodDetailPath(dish.id, state), { state });
  };

  const redirectToLoginForOrdering = () => {
    const returnPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`
        : "/";
    showNotification("Vui lòng đăng nhập để giữ món và đặt món.", "warning");
    navigate("/login", { state: { from: returnPath } });
  };

  const handleAddDishToCart = async (dish) => {
    if (!dish?.id || !dish?.restaurantId || addingDishId) return;

    const availability = getMenuItemAvailability(dish);
    if (!canCustomerOrderMenuItem(dish)) {
      showNotification(
        availability?.customerMessage || "Món này hiện chưa thể đặt.",
        "warning",
      );
      return;
    }

    if (!isAuthenticated || !user?.id) {
      redirectToLoginForOrdering();
      return;
    }

    if (!isCustomer) {
      showNotification(
        "Chỉ tài khoản khách hàng mới có thể giữ món và đặt món.",
        "warning",
      );
      return;
    }

    const servingVariantKey = getSelectedVariantKey(dish);

    setAddingDishId(dish.id);
    try {
      const { data: mutationData } = await addCartItemMutation({
        variables: {
          input: {
            userId: user.id,
            restaurantId: String(dish.restaurantId),
            menuItemId: dish.id,
            quantity: 1,
            note: null,
            servingVariantKey,
          },
        },
      });

      if (!mutationData?.addCartItem?.id) {
        throw new Error("Không nhận được giỏ hàng đã cập nhật từ máy chủ.");
      }

      await refetchServerCart();
      showNotification("Đã thêm món vào giỏ hàng.", "success");
    } catch (mutationError) {
      showNotification(
        getMutationErrorMessage(
          mutationError,
          "Không thể giữ món trong giỏ. Vui lòng thử lại.",
        ),
        "error",
      );
    } finally {
      setAddingDishId(null);
    }
  };

  return (
    <section id="menu" className="dish-grid">
      <div className="dish-grid__container">
        <div className="dish-grid__header">
          <div>
            <span className="dish-grid__badge">Gợi ý món ngon</span>
            <h3 className="dish-grid__title">Món ăn nổi bật</h3>
            <p className="dish-grid__subtitle">
              Các món đang bán, còn nguyên liệu và được khách hàng yêu thích.
            </p>
          </div>
          <button
            type="button"
            className="dish-grid__view-all"
            onClick={handleOpenAllDishes}
          >
            Xem tất cả món <span>→</span>
          </button>
        </div>

        {error ? (
          <div className="dish-grid__error">Có lỗi khi tải món ăn.</div>
        ) : (
          <div className="dish-grid__list">
            {loading
              ? Array.from({ length: 8 }).map((_, idx) => (
                  <SkeletonCard key={idx} />
                ))
              : visibleDishes.map((dish) => {
                  const method = getSelectedMethod(dish);
                  const availability = getMenuItemAvailability(dish);
                  const price = getEffectivePrice(dish.basePrice, method);
                  const img = dish.thumbImage || defaultImg;
                  const restaurantName = dish.restaurantName || "Nhà hàng";
                  const hasVariants = dish.servingVariants?.length > 0;
                  const isAdding = addingDishId === dish.id;
                  const rating = resolveFeaturedDishRating(dish);

                  return (
                    <div
                      key={dish.id}
                      className="dish-card"
                      onClick={() => handleOpenFoodDetail(dish)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Xem món ${dish.name} tại ${restaurantName}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenFoodDetail(dish);
                        }
                      }}
                    >
                      <div
                        className="dish-card__image-wrapper"
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFoodDetail(dish);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenFoodDetail(dish);
                          }
                        }}
                      >
                        <img src={img} alt={dish.name} className="dish-card__img" />
                        {rating && (
                          <div className="dish-card__rating">
                            <Star aria-hidden="true" /> {rating.toFixed(1)}
                          </div>
                        )}
                        {availability?.label && (
                          <div className="dish-card__availability">
                            {availability.label}
                          </div>
                        )}
                      </div>

                      <div className="dish-card__body">
                        <h4 className="dish-card__name" title={dish.name}>
                          {dish.name}
                        </h4>
                        <p className="dish-card__restaurant">{restaurantName}</p>
                        <div className="dish-card__meta">
                          <span className="dish-card__meta-item">
                            <Star aria-hidden="true" />
                            {rating ? rating.toFixed(1) : "Món mới"}
                          </span>
                          {dish.avgPrepTimeMin && (
                            <span>{dish.avgPrepTimeMin} phút</span>
                          )}
                        </div>

                        <div className="dish-card__variant-area">
                          {hasVariants ? (
                            <div
                              className="dish-card__select-wrapper"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <label className="dish-card__label">Tùy chọn:</label>
                              <select
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="dish-card__select"
                                value={getSelectedVariantKey(dish)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleMethodChange(dish.id, e.target.value);
                                }}
                              >
                                {dish.servingVariants.map((variant, idx) => (
                                  <option
                                    key={`${dish.id}-${getVariantKey(variant, idx)}`}
                                    value={getVariantKey(variant, idx)}
                                  >
                                    {variant.name} - {getEffectivePrice(
                                      dish.basePrice,
                                      variant,
                                    ).toLocaleString("vi-VN")}
                                    đ
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="dish-card__variant-spacer">
                              <span className="dish-card__label-static">
                                Món tiêu chuẩn
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="dish-card__footer">
                          <div className="dish-card__price-box">
                            <span className="price">
                              {price.toLocaleString("vi-VN")} <small>đ</small>
                            </span>
                          </div>
                          <button
                            className="dish-card__btn-add"
                            type="button"
                            disabled={isAdding || !canCustomerOrderMenuItem(dish)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddDishToCart(dish);
                            }}
                          >
                            {isAdding ? "Đang thêm..." : "Chọn món"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

            {!loading && visibleDishes.length === 0 && hasCategoryFilter && (
              <div className="dish-grid__empty dish-grid__empty--category">
                <span className="dish-grid__empty-icon" aria-hidden="true">
                  <UtensilsCrossed />
                </span>
                <strong>Chưa có món phù hợp đang bán</strong>
                <span>Hãy thử danh mục khác hoặc xem toàn bộ món ăn.</span>
                <button
                  type="button"
                  className="dish-grid__empty-cta"
                  onClick={handleOpenAllDishes}
                >
                  Xem tất cả món
                </button>
              </div>
            )}

            {!loading && visibleDishes.length === 0 && !hasCategoryFilter && (
              <FallbackDishSuggestions navigate={navigate} />
            )}
          </div>
        )}
      </div>

      <div className="dish-grid__wave-bottom">
        <svg
          viewBox="0 0 1440 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="wave-svg"
        >
          <path
            fill="#ffffff"
            fillOpacity="1"
            d="M0,96L48,122.7C96,149,192,203,288,208C384,213,480,171,576,138.7C672,107,768,85,864,101.3C960,117,1056,171,1152,197.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>
    </section>
  );
};

const FallbackDishSuggestions = ({ navigate }) => (
  <div
    className="dish-grid__fallback"
    aria-label="Gợi ý món thay thế khi món ăn đang cập nhật"
  >
    <div className="dish-grid__fallback-head">
      <span className="dish-grid__empty-icon" aria-hidden="true">
        <UtensilsCrossed />
      </span>
      <div>
        <strong>Món ăn đang được cập nhật</strong>
        <span>
          Trong lúc chờ món đang bán, bạn có thể bắt đầu bằng các gợi ý nhanh
          dưới đây.
        </span>
      </div>
    </div>
    <div className="dish-grid__fallback-list">
      {fallbackDishSuggestions.map((item) => {
        const Icon = item.Icon;
        return (
          <article key={item.key} className="dish-grid__fallback-card">
            <img src={item.image} alt={item.name} loading="lazy" />
            <div className="dish-grid__fallback-body">
              <div className="dish-grid__fallback-icon">
                <Icon size={16} />
              </div>
              <h4>{item.name}</h4>
              <p>{item.description}</p>
              <button type="button" onClick={() => navigate(item.path)}>
                {item.cta}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  </div>
);

const SkeletonCard = () => (
  <div className="dish-card dish-card--skeleton">
    <div className="skeleton-img" />
    <div className="dish-card__body">
      <div className="skeleton-text w-3-4" />
      <div className="skeleton-text w-1-2" />
      <div className="skeleton-input" />
      <div className="dish-card__footer">
        <div className="skeleton-text w-1-3" />
        <div className="skeleton-btn" />
      </div>
    </div>
  </div>
);

export default DishGrid;
