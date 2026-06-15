import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useContext,
} from "react";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
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
  AlertTriangle,
} from "lucide-react";
import { useCart } from "../../../context/CartProvider";
import { AuthContext } from "../../../context/AuthContext";
import { useActiveMenuPromotions } from "../../../hooks/useActiveMenuPromotions";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
  shouldShowMenuItemToCustomer,
} from "../../../utils/menuItemAvailability";
import { getCannotOrderReason } from "../../../utils/restaurantStatus";
import Cart from "../Homepage_Client/components/Cart";
import { useCustomerCartActions } from "../../../hooks/useCustomerCartActions";
import { useNotification } from "../../../hooks/useNotification";
import useFoodPreferences from "../../../hooks/useFoodPreferences";
import { analyzeMenuItemForFoodPreferences } from "../../../utils/foodPreferenceMatcher";
import { recordForYouItemInteraction } from "../../../utils/forYouBehaviorSignals";
import { FOR_YOU_ANALYTICS_EVENTS, recordForYouAnalyticsEvent } from "../../../utils/forYouAnalytics";
import { getForYouReasonType } from "../../../utils/forYouRanking";
import "./FoodDetail.scss";

const GET_MENU_ITEMS_FOR_FOOD_DETAIL = gql`
  query GetMenuItemsForFoodDetail(
    $filter: MenuItemFilter!
    $limit: Int = 100
    $cursor: ID
  ) {
    menuItemsConnection(limit: $limit, cursor: $cursor, filter: $filter) {
      edges {
        node {
      id
      name
      description
      basePrice
      thumbImage
      point
      labels
      foodType
      meatTypes
      dietTags
      allergenTags
      tasteProfile {
        containsOnion
        containsCilantro
        sugar
        spice
      }
      rate
      orderCounter
      avgPrepTimeMin
      restaurantId
      menuId
      categoryId
      status
      inventoryStatus
      stockWarnings
      servingVariants {
        key
        mode
        sellQty
        sellUnit
        name
        price
        isDefault
      }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
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


const PUBLIC_RESTAURANT_BY_ID = gql`
  query PublicRestaurantByIdForFoodDetail($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      canOrder
      openingStatus
      openingStatusReason
      address {
        line1
        district
        city
      }
    }
  }
`;
const CUSTOMER_MENU_ITEM = gql`
  query CustomerMenuItemForFoodDetail($id: ID!, $restaurantId: ID) {
    customerMenuItem(id: $id, restaurantId: $restaurantId) {
      id
      name
      description
      basePrice
      thumbImage
      point
      labels
      foodType
      meatTypes
      dietTags
      allergenTags
      tasteProfile {
        containsOnion
        containsCilantro
        sugar
        spice
      }
      rate
      orderCounter
      avgPrepTimeMin
      restaurantId
      menuId
      categoryId
      status
      inventoryStatus
      stockWarnings
      servingVariants {
        key
        mode
        sellQty
        sellUnit
        name
        price
        isDefault
      }
    }
  }
`;
const GET_FOOD_REVIEWS = gql`
  query GetFoodReviewsForFoodDetail(
    $restaurantId: ID!
    $targetId: ID!
    $limit: Int = 5
  ) {
    reviews(
      restaurantId: $restaurantId
      targetType: "food"
      targetId: $targetId
      limit: $limit
      skip: 0
    ) {
      items {
        id
        targetId
        customerName
        rating
        content
        createdAt
      }
    }
  }
`;

const formatPrice = (price) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price || 0);

const normalizeCartNote = (value) => String(value || "").trim();

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const resolveFoodDetailSocketUrl = () => {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitSocketUrl) return explicitSocketUrl;

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      return String(apiUrl).replace(/\/graphql\/?$/, "");
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://localhost:4000";
};

const getCartMutationErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const getAddToCartButtonText = ({
  addingToBackendCart,
  restaurantLoading,
  restaurantUnavailable,
  restaurantCanOrder,
  restaurantOrderBlockReason,
  selectedServingKey,
  liveStateReady,
  isBlocked,
  isOutOfStock,
  quantityExceedsAvailable,
}) => {
  if (addingToBackendCart) return "Đang giữ món...";
  if (restaurantLoading) return "Đang kiểm tra nhà hàng...";
  if (restaurantUnavailable) return "Nhà hàng không khả dụng";
  if (!restaurantCanOrder) return restaurantOrderBlockReason;
  if (!selectedServingKey) return "Đang tải tùy chọn...";
  if (!liveStateReady) return "Đang kiểm tra tồn...";
  if (isBlocked) return "Tạm chặn giữ món";
  if (isOutOfStock) return "Hết hàng";
  if (quantityExceedsAvailable) return "Không đủ số lượng";
  return "Thêm vào giỏ";
};

const hasFoodPreferenceMetadata = (dish) =>
  Array.isArray(dish?.dietTags) ||
  Array.isArray(dish?.allergenTags) ||
  Boolean(dish?.foodType) ||
  Boolean(dish?.tasteProfile);

const FOOD_TYPE_META = {
  VEGETARIAN: { label: "Chay", className: "vegetarian" },
  NON_VEGETARIAN: { label: "Mặn", className: "non-vegetarian" },
  VEGAN: { label: "Thuần chay", className: "vegan" },
  MIXED: { label: "Có cả chay và mặn", className: "mixed" },
  UNKNOWN: { label: "Chưa phân loại", className: "unknown" },
};

const MEAT_TYPE_LABELS = {
  BEEF: "Bò",
  PORK: "Heo",
  CHICKEN: "Gà",
  DUCK: "Vịt",
  SEAFOOD: "Hải sản",
  FISH: "Cá",
  LAMB: "Cừu",
  OTHER: "Khác",
};

const formatTagLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatServingVariant = (variant = {}) => {
  const qty = Number(variant.sellQty || 0);
  const qtyLabel = Number.isFinite(qty) && qty > 0 ? qty.toLocaleString("vi-VN") : "1";
  const unit = variant.sellUnit || (variant.mode === "BY_WEIGHT" ? "kg" : "portion");
  return variant.mode === "BY_WEIGHT"
    ? `${qtyLabel}${unit}`
    : `${qtyLabel} ${unit === "portion" ? "phần" : unit}`;
};

const FoodDetail = () => {
  const { foodId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const preloadedDish = location.state?.dish || null;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const restaurantIdFromQuery = searchParams.get("restaurantId");
  const timeSlotFromQuery = searchParams.get("timeSlot");
  const categoryIdFromQuery = searchParams.get("categoryId");
  const restaurantIdFromState =
    location.state?.restaurantId ||
    preloadedDish?.restaurantId ||
    restaurantIdFromQuery ||
    null;
  const timeSlotFromState = location.state?.timeSlot || timeSlotFromQuery || null;
  const categoryIdFromState =
    location.state?.categoryId ||
    preloadedDish?.categoryId ||
    categoryIdFromQuery ||
    null;
  const selectedVariantKeyFromState = location.state?.selectedVariantKey || null;
  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const normalizedRole = String(
    user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase();
  const isCustomer = normalizedRole === "customer";
  const { showNotification } = useNotification();

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  const hasUsablePreloadedDish =
    String(preloadedDish?.id || "") === String(foodId || "") &&
    !!preloadedDish?.name &&
    !!(preloadedDish?.restaurantId || restaurantIdFromState);
  const preloadedDishHasPreferenceMetadata = hasFoodPreferenceMetadata(preloadedDish);

  const menuItemFilter = useMemo(() => {
    if (!restaurantIdFromState) return null;
    return {
      restaurantId: restaurantIdFromState,
      ...(timeSlotFromState ? { timeSlot: timeSlotFromState } : {}),
      ...(categoryIdFromState ? { categoryId: categoryIdFromState } : {}),
    };
  }, [categoryIdFromState, restaurantIdFromState, timeSlotFromState]);

  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
  } = useQuery(GET_MENU_ITEMS_FOR_FOOD_DETAIL, {
    variables: { filter: menuItemFilter, limit: 100, cursor: null },
    fetchPolicy: "cache-and-network",
    skip: hasUsablePreloadedDish || !menuItemFilter,
  });

  const foundDish = useMemo(() => {
    if (hasUsablePreloadedDish) return preloadedDish;
    const list =
      menuData?.menuItemsConnection?.edges?.map((edge) => edge?.node).filter(Boolean) || [];
    return list.find((item) => String(item.id) === String(foodId)) || null;
  }, [menuData, foodId, hasUsablePreloadedDish, preloadedDish]);
  const {
    data: directDishData,
    loading: directDishLoading,
    error: directDishError,
  } = useQuery(CUSTOMER_MENU_ITEM, {
    variables: { id: foodId, restaurantId: restaurantIdFromState || undefined },
    skip:
      (hasUsablePreloadedDish && preloadedDishHasPreferenceMetadata) ||
      !!foundDish ||
      !foodId,
    fetchPolicy: "network-only",
  });
  const serverDish = foundDish || directDishData?.customerMenuItem || null;
  const resolvedDish = useMemo(() => (preloadedDish || serverDish
    ? {
        ...(preloadedDish || {}),
        ...(serverDish || {}),
      }
    : null), [preloadedDish, serverDish]);
  const { getPromotionForMenuItem, getPromotionLabel } = useActiveMenuPromotions(
    resolvedDish?.restaurantId,
    { skip: !resolvedDish?.restaurantId },
  );
  const activePromotion = useMemo(
    () => getPromotionForMenuItem(resolvedDish),
    [getPromotionForMenuItem, resolvedDish],
  );
  const promotionLabel = getPromotionLabel(activePromotion);

  const { data: restaurantData, loading: restaurantLoading } = useQuery(PUBLIC_RESTAURANT_BY_ID, {
    variables: { id: resolvedDish?.restaurantId },
    skip: !resolvedDish?.restaurantId,
  });
  const { data: foodReviewsData } = useQuery(GET_FOOD_REVIEWS, {
    variables: {
      restaurantId: resolvedDish?.restaurantId,
      targetId: resolvedDish?.id,
      limit: 5,
    },
    skip: !resolvedDish?.restaurantId || !resolvedDish?.id,
  });
  const foodReviews = useMemo(() => {
    const rows = foodReviewsData?.reviews?.items || [];
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [foodReviewsData]);
  const averageFoodRating = useMemo(() => {
    if (!foodReviews.length) return 0;
    const sum = foodReviews.reduce((acc, row) => acc + Number(row?.rating || 0), 0);
    return sum / foodReviews.length;
  }, [foodReviews]);

  const {
    preferences: customerFoodPreferences,
    loading: foodPreferenceLoading,
  } = useFoodPreferences({ skip: !isAuthenticated || !isCustomer });

  const foodPreferenceMeta = useMemo(() => {
    if (!isAuthenticated || !isCustomer || !resolvedDish?.id) return null;
    return analyzeMenuItemForFoodPreferences(resolvedDish, customerFoodPreferences);
  }, [customerFoodPreferences, isAuthenticated, isCustomer, resolvedDish]);

  const shouldShowFoodPreferencePanel = useMemo(() => {
    if (!foodPreferenceMeta || foodPreferenceLoading) return false;
    if (foodPreferenceMeta.hasAllergyWarning || foodPreferenceMeta.isRecommended) return true;
    return Array.isArray(foodPreferenceMeta.reasons) && foodPreferenceMeta.reasons.length > 0;
  }, [foodPreferenceLoading, foodPreferenceMeta]);

  const sizes = useMemo(() => {
    if (!resolvedDish) return [];
    const variants = resolvedDish.servingVariants || [];
    if (!variants.length) {
      return [
        {
          id: "portion",
          key: "portion",
          name: "Phần tiêu chuẩn",
          price: Number(resolvedDish.basePrice) || 0,
          priceAdd: 0,
        },
      ];
    }

    const base = Number(resolvedDish.basePrice) || 0;
    return variants.map((variant, idx) => {
      const finalPrice = Number(variant.price) || base;
      return {
        id: variant.key || `variant-${idx}`,
        key: variant.key || `variant-${idx}`,
        name: variant.name || `Tùy chọn ${idx + 1}`,
        price: finalPrice,
        priceAdd: finalPrice - base,
        mode: variant.mode,
        sellQty: variant.sellQty,
        sellUnit: variant.sellUnit,
        isDefault: variant.isDefault,
      };
    });
  }, [resolvedDish]);

  const foodTypeKey = String(resolvedDish?.foodType || "UNKNOWN").toUpperCase();
  const foodTypeMeta = FOOD_TYPE_META[foodTypeKey] || FOOD_TYPE_META.UNKNOWN;
  const hasByWeightVariant = useMemo(
    () =>
      (resolvedDish?.servingVariants || []).some(
        (variant) => String(variant?.mode || "").toUpperCase() === "BY_WEIGHT",
      ),
    [resolvedDish?.servingVariants],
  );
  const shouldShowMeatTypes =
    ["NON_VEGETARIAN", "MIXED"].includes(foodTypeKey) &&
    Array.isArray(resolvedDish?.meatTypes) &&
    resolvedDish.meatTypes.length > 0;

  const [mainImage, setMainImage] = useState("/default-dishes.jpg");
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customerNote, setCustomerNote] = useState("");
  const [activeTab, setActiveTab] = useState("detail");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAnimatingCart, setIsAnimatingCart] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const recordedForYouViewRef = useRef(null);

  useEffect(() => {
    if (resolvedDish?.thumbImage) {
      setMainImage(resolvedDish.thumbImage);
    }
  }, [resolvedDish]);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer || !resolvedDish?.id) return;
    const dishId = String(resolvedDish.id);
    if (recordedForYouViewRef.current === dishId) return;
    recordedForYouViewRef.current = dishId;
    const analyticsDish = {
      ...resolvedDish,
      restaurantId: resolvedDish.restaurantId || restaurantIdFromState,
      categoryId: resolvedDish.categoryId || categoryIdFromState,
      foodPreferenceMeta,
    };
    recordForYouItemInteraction(user?.id, {
      id: resolvedDish.id,
      name: resolvedDish.name,
      restaurantId: analyticsDish.restaurantId,
      restaurantName: resolvedDish.restaurantName,
      categoryId: analyticsDish.categoryId,
    }, "view");
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.FOOD_DETAIL_VIEW, {
      userId: user?.id,
      itemId: resolvedDish.id,
      restaurantId: analyticsDish.restaurantId,
      categoryId: analyticsDish.categoryId,
      source: "food_detail",
      reasonType: getForYouReasonType(analyticsDish),
    });
  }, [categoryIdFromState, foodPreferenceMeta, isAuthenticated, isCustomer, resolvedDish, restaurantIdFromState, user?.id]);

  useEffect(() => {
    if (!sizes.length) return;

    const preferredSize = selectedVariantKeyFromState
      ? sizes.find(
          (size) =>
            String(size.key || "") === String(selectedVariantKeyFromState) ||
            String(size.id || "") === String(selectedVariantKeyFromState),
        )
      : null;

    setSelectedSize(preferredSize || sizes[0]);
  }, [sizes, selectedVariantKeyFromState]);

  const selectedServingKey = selectedSize?.key || null;

  const {
    data: liveStateData,
    refetch: refetchLiveState,
  } = useQuery(MENU_ITEM_LIVE_STATE, {
    variables: {
      input: {
        restaurantId: resolvedDish?.restaurantId,
        menuItemId: resolvedDish?.id,
        servingVariantKey: selectedServingKey,
        userId: user?.id,
      },
    },
    skip: !resolvedDish?.restaurantId || !resolvedDish?.id || !selectedServingKey,
    fetchPolicy: "network-only",
    pollInterval: 10000,
  });

  const [addCartItemMutation, { loading: addingToBackendCart }] =
    useMutation(ADD_CART_ITEM);

  const liveState = liveStateData?.menuItemLiveState;
  const socketRef = useRef(null);
  const expiredHoldRefetchKeyRef = useRef(null);

  useEffect(() => {
    if (!resolvedDish?.restaurantId || !resolvedDish?.id) return;
    const socket = io(resolveFoodDetailSocketUrl(), { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("joinRestaurant", resolvedDish.restaurantId);
      socket.emit("joinMenuItemView", {
        restaurantId: resolvedDish.restaurantId,
        menuItemId: resolvedDish.id,
      });
    });
    socket.on("inventoryEvents", (evt) => {
      if (!evt) return;
      if (String(evt.menuItemId || "") === String(resolvedDish.id)) {
        refetchLiveState?.();
      }
    });
    return () => {
      socket.emit("leaveMenuItemView", {
        restaurantId: resolvedDish.restaurantId,
        menuItemId: resolvedDish.id,
      });
      socket.disconnect();
    };
  }, [resolvedDish?.restaurantId, resolvedDish?.id, refetchLiveState]);

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

  const currentUnitPrice = selectedSize?.price ?? Number(resolvedDish?.basePrice || 0);
  const totalPrice = currentUnitPrice * quantity;

  const publicRestaurant = restaurantData?.publicRestaurant || null;
  const restaurantUnavailable = !restaurantLoading && !publicRestaurant;
  const restaurant = publicRestaurant;
  const restaurantCanOrder = !!publicRestaurant?.canOrder;
  const restaurantOrderBlockReason = getCannotOrderReason(publicRestaurant?.openingStatus);
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
    restaurantLoading ||
    restaurantUnavailable ||
    !restaurantCanOrder ||
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

  const addToCartButtonText = getAddToCartButtonText({
    addingToBackendCart,
    restaurantLoading,
    restaurantUnavailable,
    restaurantCanOrder,
    restaurantOrderBlockReason,
    selectedServingKey,
    liveStateReady,
    isBlocked,
    isOutOfStock,
    quantityExceedsAvailable,
  });

  const redirectToLoginForOrdering = () => {
    const returnPath = `${location.pathname}${location.search || ""}${location.hash || ""}`;
    showNotification("Vui lòng đăng nhập để giữ món và đặt món.", "warning");
    navigate("/login", { state: { from: returnPath } });
  };

  const makeCartPayload = () => {
    if (!resolvedDish) return null;
    const servingVariantKey = selectedServingKey || "portion";

    const selectedVariantName =
      selectedSize?.name && selectedSize.name !== "Phần tiêu chuẩn"
        ? selectedSize.name
        : "Phần tiêu chuẩn";

    return {
      id: `${resolvedDish.id}_${servingVariantKey}`,
      dishId: resolvedDish.id,
      restaurantId: String(resolvedDish.restaurantId || restaurant?.id || ""),
      menuId: resolvedDish.menuId || null,
      categoryId: resolvedDish.categoryId || null,
      variantKey: servingVariantKey,
      servingVariantKey,
      name: resolvedDish.name,
      price: currentUnitPrice,
      image: resolvedDish.thumbImage || "/default-dishes.jpg",
      method: selectedVariantName,
      quantity,
      restaurantName: restaurant?.name || null,
      backendCartId: null,
      backendCartItemId: null,
      holdExpiresAt: null,
      holdStatus: null,
      note: customerNote.trim() || null,
    };
  };

  const addCurrentSelectionToBackendCart = async () => {
    if (!publicRestaurant) {
      showNotification(
        "Nhà hàng không khả dụng hoặc chưa công khai.",
        "warning",
      );
      return null;
    }
    if (!restaurantCanOrder) {
      showNotification(restaurantOrderBlockReason, "warning");
      return null;
    }
    const payload = makeCartPayload();
    if (!payload || !payload.restaurantId) return null;
    if (!selectedServingKey) {
      showNotification(
        "Vui lòng chọn tùy chọn món trước khi thêm vào giỏ.",
        "warning",
      );
      return null;
    }

    if (!isAuthenticated || !user?.id) {
      redirectToLoginForOrdering();
      return null;
    }

    if (!isCustomer) {
      showNotification(
        "Chỉ tài khoản khách hàng mới có thể giữ món và đặt món.",
        "warning",
      );
      return null;
    }

    if (isBlocked) {
      showNotification(
        liveState?.abuseWarning ||
          liveState?.policyMessage ||
          "Bạn đang bị tạm chặn giữ món.",
        "warning",
      );
      return null;
    }

    if (isOutOfStock || quantityExceedsAvailable) {
      showNotification(
        isOutOfStock
          ? "Món đã hết hàng."
          : "Số lượng bạn chọn vượt quá số suất còn có thể đặt.",
        "warning",
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
            note: customerNote.trim() || null,
            servingVariantKey: selectedServingKey || "portion",
          },
        },
      });

      const targetNote = normalizeCartNote(payload?.note);
      const returnedItem = data?.addCartItem?.items?.find((item) => {
        const sameMenuItem =
          String(item?.menuItemId) === String(resolvedDish?.id);
        const sameServing =
          String(item?.servingVariantKey) ===
          String(selectedServingKey || "portion");
        const sameNote = normalizeCartNote(item?.note) === targetNote;
        return sameMenuItem && sameServing && sameNote;
      });

      const backendCartId = data?.addCartItem?.id || null;
      const backendCartItemId = returnedItem?.id || null;

      if (!backendCartId || !backendCartItemId) {
        try {
          await refetchLiveState?.();
        } catch {
          // Giữ lỗi đồng bộ dòng giỏ hàng là lỗi chính cần báo cho người dùng.
        }

        showNotification(
          "Không thể đồng bộ dòng giỏ hàng từ máy chủ. Vui lòng thêm lại món.",
          "error",
        );
        return null;
      }

      const analyticsDish = {
        ...resolvedDish,
        restaurantId: resolvedDish.restaurantId || restaurant?.id,
        categoryId: resolvedDish.categoryId,
        foodPreferenceMeta,
      };
      recordForYouItemInteraction(user?.id, {
        id: resolvedDish.id,
        name: resolvedDish.name,
        restaurantId: analyticsDish.restaurantId,
        restaurantName: restaurant?.name || resolvedDish.restaurantName,
        categoryId: analyticsDish.categoryId,
      }, "order_intent");
      recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.ADD_TO_CART_INTENT, {
        userId: user?.id,
        itemId: resolvedDish.id,
        restaurantId: analyticsDish.restaurantId,
        categoryId: analyticsDish.categoryId,
        source: "food_detail",
        reasonType: getForYouReasonType(analyticsDish),
      });

      addToCart({
        ...payload,
        backendCartId,
        backendCartItemId,
        holdExpiresAt: returnedItem?.holdExpiresAt || payload.holdExpiresAt,
        holdStatus: returnedItem?.holdStatus || payload.holdStatus,
        servingVariantKey:
          returnedItem?.servingVariantKey || payload.servingVariantKey,
        note: returnedItem?.note ?? payload.note ?? null,
      });

      try {
        await refetchLiveState?.();
      } catch {
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
        note: returnedItem?.note ?? payload.note ?? null,
      };
    } catch (error) {
      showNotification(
        getCartMutationErrorMessage(
          error,
          "Không thể giữ món trong giỏ. Vui lòng thử lại.",
        ),
        "error",
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

    const returnPath = `${location.pathname}${location.search || ""}`;
    navigate("/checkout", { state: { from: returnPath } });
  };

  const {
    updateCartItemQuantity,
    removeCartLineItem,
    clearCustomerCart,
    removeRestaurantScopedItems,
    isBusy: cartActionBusy,
    busyItemIds,
    busyRestaurantIds,
    isClearing,
  } = useCustomerCartActions({
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    onAfterBackendCartChange: () => refetchLiveState?.(),
  });

  if ((menuLoading || directDishLoading) && !resolvedDish) {
    return <div className="food-detail-wrapper">Đang tải thông tin món ăn...</div>;
  }

  if ((menuError || directDishError) && !resolvedDish) {
    return (
      <div className="food-detail-wrapper">
        Không thể tải chi tiết món ăn. Vui lòng thử lại sau.
      </div>
    );
  }

  if (!resolvedDish) {
    return <div className="food-detail-wrapper">Món này hiện không khả dụng hoặc đã bị ẩn khỏi thực đơn.</div>;
  }
  const availability = getMenuItemAvailability(resolvedDish);
  const customerVisible = shouldShowMenuItemToCustomer(resolvedDish);
  const customerOrderable = canCustomerOrderMenuItem(resolvedDish);

  return (
    <div className="food-detail-wrapper">
      <div className="food-detail-container">
        <div className="fd-breadcrumb">
          <span onClick={() => navigate("/")}>Trang chủ</span>{" "}
          <ChevronRight size={14} />
          <span className="current">{resolvedDish.name}</span>
        </div>



          <div className="fd-note-box">
            <label htmlFor="dish-note">Ghi chú cho món</label>
            <textarea
              id="dish-note"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              maxLength={180}
              placeholder="Ví dụ: ít cay, không hành..."
            />
          </div>

        <div className="fd-main-grid">
          <div className="fd-gallery">
            <div className="main-image-box">
              <img src={mainImage} alt={resolvedDish.name} />
              <div className="badges">
                <span className="badge-hot">
                  <Flame size={12} fill="currentColor" /> Món nổi bật
                </span>
              </div>
            </div>
            <div className="thumbnail-list">
              {[resolvedDish.thumbImage || "/default-dishes.jpg"].map((img, idx) => (
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

            <h1 className="food-name">{resolvedDish.name}</h1>

            <section className="fd-food-profile" aria-label="Thông tin món ăn">
              <div className="fd-profile-badges">
                <span className={`fd-food-type-badge fd-food-type-badge--${foodTypeMeta.className}`}>
                  {foodTypeMeta.label}
                </span>
                {(resolvedDish.dietTags || []).map((tag) => (
                  <span className="fd-chip fd-chip--diet" key={`diet-${tag}`}>
                    {formatTagLabel(tag)}
                  </span>
                ))}
                {(resolvedDish.allergenTags || []).map((tag) => (
                  <span className="fd-chip fd-chip--allergen" key={`allergen-${tag}`}>
                    Dị ứng: {formatTagLabel(tag)}
                  </span>
                ))}
              </div>

              {shouldShowMeatTypes ? (
                <div className="fd-meat-types">
                  <span>Loại thịt:</span>
                  {(resolvedDish.meatTypes || []).map((type) => (
                    <strong key={type}>
                      {MEAT_TYPE_LABELS[type] || formatTagLabel(type)}
                    </strong>
                  ))}
                </div>
              ) : null}

              <div className="fd-serving-summary">
                <div>
                  <span>Khẩu phần</span>
                  <strong>
                    {Number(resolvedDish.servingPortion || 1).toLocaleString("vi-VN")}{" "}
                    {resolvedDish.servingUnit || "người"}
                  </strong>
                </div>
                <div>
                  <span>Chuẩn bị</span>
                  <strong>{resolvedDish.avgPrepTimeMin || 20} phút</strong>
                </div>
              </div>

              {hasByWeightVariant ? (
                <div className="fd-weight-note" role="note">
                  Món này tính theo cân nặng thực tế. Sau khi thanh toán, nhà hàng sẽ cập nhật ảnh cân minh chứng để khách hàng theo dõi.
                </div>
              ) : null}
            </section>

            <div className="meta-info">
              <div className="rating">
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <span>{foodReviews.length ? averageFoodRating.toFixed(1) : Number(resolvedDish.point || 0).toFixed(1)}</span>
                <span className="text-gray">({foodReviews.length} đánh giá)</span>
              </div>
              <div className="divider"></div>
              <div className="prep-time">
                <Clock size={16} />
                Thời gian chuẩn bị: {resolvedDish.avgPrepTimeMin || 20} phút
              </div>
            </div>

            <div className="price-box">
              <span className="current-price">{formatPrice(currentUnitPrice)}</span>
            </div>

            <div className="availability-box info">
              <div className="promo-title">
                <Tag size={16} /> Ưu đãi áp dụng:
              </div>
              <ul className="promo-list">{activePromotion ? <li>{activePromotion.name} ({promotionLabel})</li> : <li>Hiện chưa có ưu đãi áp dụng cho món này.</li>}</ul>
            </div>
            {!customerVisible && <div className="availability-box info"><div className="promo-title">Món hiện không hiển thị cho khách.</div></div>}
            {availability?.customerMessage && <div className="availability-box info"><div className="promo-title">{availability.customerMessage}</div></div>}
            {restaurantLoading && <div className="availability-box info"><div className="promo-title">Đang kiểm tra trạng thái nhà hàng...</div></div>}
            {restaurantUnavailable && <div className="availability-box info"><div className="promo-title">Nhà hàng không khả dụng hoặc chưa công khai.</div></div>}
            {publicRestaurant && !restaurantCanOrder && (
              <div className="availability-box info">
                <div className="promo-title">{restaurantOrderBlockReason}</div>
              </div>
            )}

            <div className="availability-box info">
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

            {shouldShowFoodPreferencePanel ? (
              <div
                className={`fd-for-you-panel ${
                  foodPreferenceMeta.hasAllergyWarning
                    ? "fd-for-you-panel--warning"
                    : foodPreferenceMeta.isRecommended
                      ? "fd-for-you-panel--match"
                      : "fd-for-you-panel--note"
                }`}
                role="status"
              >
                <div className="fd-for-you-panel__badge-row">
                  <span
                    className={`fd-for-you-chip ${
                      foodPreferenceMeta.hasAllergyWarning
                        ? "fd-for-you-chip--warning"
                        : "fd-for-you-chip--match"
                    }`}
                  >
                    {foodPreferenceMeta.hasAllergyWarning ? "⚠ Cần kiểm tra dị ứng" : "✨ Món phù hợp với bạn"}
                  </span>
                </div>
                <div className="fd-for-you-panel__title">
                  <AlertTriangle size={16} /> Gợi ý cho bạn
                </div>
                {foodPreferenceMeta.hasAllergyWarning ? (
                  <>
                    <p>{foodPreferenceMeta.warningReason}</p>
                    {foodPreferenceMeta.matchedAllergies?.length ? (
                      <p>Món này có thể chứa: {foodPreferenceMeta.matchedAllergies.join(" / ")}.</p>
                    ) : null}
                  </>
                ) : null}
                {!foodPreferenceMeta.hasAllergyWarning && foodPreferenceMeta.isRecommended ? (
                  <p>Món này khá hợp với khẩu vị/chế độ ăn bạn đã chọn.</p>
                ) : null}
                {!foodPreferenceMeta.hasAllergyWarning && !foodPreferenceMeta.isRecommended ? (
                  <p>Món này có thể chưa phù hợp với khẩu vị của bạn.</p>
                ) : null}
                {foodPreferenceMeta.reasons?.length ? (
                  <ul className="fd-for-you-panel__list">
                    {foodPreferenceMeta.reasons.slice(0, 2).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {foodPreferenceMeta.hasAllergyWarning ? (
                  <small>Hãy kiểm tra thành phần trước khi đặt.</small>
                ) : null}
              </div>
            ) : null}

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
                      {size.mode ? (
                        <span className="variant-meta">
                          {formatServingVariant(size)}
                        </span>
                      ) : null}
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
                  disabled={addDisabled || !customerOrderable}
                >
                  <ShoppingCart size={20} />
                  {addToCartButtonText}
                </button>
                <button
                  className="btn-buy-now"
                  onClick={handleBuyNow}
                  type="button"
                  disabled={addDisabled || !customerOrderable}
                >
                  {addingToBackendCart ? "Đang giữ món..." : "Đặt hàng ngay"}
                </button>
              </div>
            </div>

            <div className="review-summary">
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
                      {resolvedDish.description ||
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
                        <p>{resolvedDish.avgPrepTimeMin || 20} phút (ước tính).</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="reviews-content fade-in">
                {foodReviews.length === 0 ? (
                  <div className="empty-reviews">
                    <Star size={48} color="#e5e7eb" />
                    <p>Chưa có đánh giá cho món này.</p>
                  </div>
                ) : (
                  <div>
                    <p>
                      Điểm trung bình từ đánh giá gần đây:{" "}
                      <b>{averageFoodRating.toFixed(1)}</b> / 5 (
                      {foodReviews.length} đánh giá)
                    </p>
                    {foodReviews.slice(0, 5).map((review) => (
                      <div
                        key={review.id}
                        className="review-item"
                      >
                        <div className="review-author">{review.customerName || "Khách hàng"}</div>
                        <div className="review-rating">{review.rating}/5</div>
                        <div className="review-content">{review.content || "Không có nội dung."}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Cart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          onUpdateQuantity={updateCartItemQuantity}
          totalPrice={getTotalPrice()}
          onClearCart={clearCustomerCart}
          onRemoveRestaurantItems={removeRestaurantScopedItems}
          onRemoveItem={removeCartLineItem}
          isBusy={cartActionBusy}
          busyItemIds={busyItemIds}
          busyRestaurantIds={busyRestaurantIds}
          isClearing={isClearing}
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
