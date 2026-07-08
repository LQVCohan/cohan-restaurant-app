import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { io } from "socket.io-client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  Leaf,
  Minus,
  Plus,
  RefreshCw,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Users,
} from "lucide-react";
import { AuthContext } from "../../../context/AuthContext";
import { useCart } from "../../../context/CartProvider";
import { useActiveMenuPromotions } from "../../../hooks/useActiveMenuPromotions";
import { useCustomerCartActions } from "../../../hooks/useCustomerCartActions";
import { useNotification } from "../../../hooks/useNotification";
import useFoodPreferences from "../../../hooks/useFoodPreferences";
import { analyzeMenuItemForFoodPreferences } from "../../../utils/foodPreferenceMatcher";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
} from "../../../utils/menuItemAvailability";
import { getCannotOrderReason } from "../../../utils/restaurantStatus";
import {
  FOOD_ORDER_ACTION,
  getFoodOrderingActionState,
} from "../../../utils/foodOrderingActionState";
import {
  FOR_YOU_ANALYTICS_EVENTS,
  recordForYouAnalyticsEvent,
} from "../../../utils/forYouAnalytics";
import { recordForYouItemInteraction } from "../../../utils/forYouBehaviorSignals";
import { getForYouReasonType } from "../../../utils/forYouRanking";
import Cart from "../Homepage_Client/components/Cart";
import FoodAvailabilityWatchPanel from "./FoodAvailabilityWatchPanel";
import "./FoodDetailV2.scss";

const FOOD_PLACEHOLDER = "/default-dishes.jpg";

const CUSTOMER_MENU_ITEM = gql`
  query CustomerFoodDetailV2($id: ID!, $restaurantId: ID) {
    customerMenuItem(id: $id, restaurantId: $restaurantId) {
      id
      restaurantId
      menuId
      categoryId
      name
      description
      basePrice
      defaultServingKey
      thumbImage
      labels
      foodType
      meatTypes
      dietTags
      allergenTags
      ingredientNames
      servingPortion
      servingUnit
      avgPrepTimeMin
      point
      rate
      orderCounter
      status
      inventoryStatus
      stockWarnings
      tasteProfile {
        containsOnion
        containsCilantro
        sugar
        spice
      }
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

const PUBLIC_RESTAURANT = gql`
  query PublicRestaurantForFoodDetailV2($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      canOrder
      openingStatus
      openingStatusReason
      address {
        line1
        line2
        ward
        district
        city
      }
    }
  }
`;

const CUSTOMER_MODIFIER_GROUPS = gql`
  query CustomerModifierGroupsForFoodDetail(
    $restaurantId: ID!
    $menuItemId: ID!
  ) {
    customerModifierGroups(
      restaurantId: $restaurantId
      menuItemId: $menuItemId
    ) {
      id
      name
      selectionType
      required
      minSelected
      maxSelected
      options {
        id
        name
        isDefault
        priceRule {
          rule
          amount
        }
      }
    }
  }
`;

const MENU_ITEM_LIVE_STATE = gql`
  query MenuItemLiveStateForFoodDetailV2($input: MenuItemLiveStateInput!) {
    menuItemLiveState(input: $input) {
      itemType
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

const FOOD_REVIEW_SUMMARY = gql`
  query FoodReviewSummaryV2($restaurantId: ID!, $targetId: ID!) {
    reviewStats(
      restaurantId: $restaurantId
      targetType: "food"
      targetId: $targetId
    ) {
      total
      avgRating
    }
    reviews(
      restaurantId: $restaurantId
      targetType: "food"
      targetId: $targetId
      status: "published"
      limit: 5
      skip: 0
    ) {
      total
      items {
        id
        customerName
        customerAvatar
        rating
        title
        content
        verifiedPurchase
        createdAt
      }
    }
  }
`;

const MY_FOOD_FAVORITES = gql`
  query MyFoodFavoritesForFoodDetailV2 {
    myFavorites(type: "food") {
      id
      targetId
    }
  }
`;

const TOGGLE_FAVORITE = gql`
  mutation ToggleFavoriteForFoodDetailV2($input: ToggleFavoriteInput!) {
    toggleFavorite(input: $input) {
      id
      type
      targetId
    }
  }
`;

const ADD_CART_ITEM = gql`
  mutation AddCartItemFromFoodDetailV2($input: AddCartItemInput!) {
    addCartItem(input: $input) {
      id
      totalQuantity
      totalAmount
      items {
        id
        itemType
        restaurantId
        menuItemId
        name
        price
        modifiersPrice
        quantity
        thumbImage
        note
        servingVariantKey
        holdExpiresAt
        holdStatus
        modifiers {
          groupId
          groupName
          optionId
          optionName
          priceRule {
            rule
            amount
          }
        }
      }
    }
  }
`;

const normalizeText = (value) => String(value || "").trim();
const normalizeNote = (value) => normalizeText(value);

export const buildModifierSelectionKey = (modifiers = []) =>
  (modifiers || [])
    .map((modifier) => `${modifier?.groupId || ""}:${modifier?.optionId || ""}`)
    .sort()
    .join("|");

export const getModifierSelectionError = (groups = [], selected = {}) => {
  for (const group of groups || []) {
    const selectedIds = Array.isArray(selected[group.id]) ? selected[group.id] : [];
    const count = selectedIds.length;

    if (group.selectionType === "single") {
      if (group.required && count < 1) {
        return `Vui lòng chọn một lựa chọn cho ${group.name}.`;
      }
      if (count > 1) return `${group.name} chỉ cho phép chọn một lựa chọn.`;
      continue;
    }

    const minimum = group.required
      ? Math.max(1, Number(group.minSelected || 0))
      : Number(group.minSelected || 0);
    const maximum =
      group.maxSelected == null ? null : Number(group.maxSelected);
    if (!group.required && count === 0) continue;
    if (count < minimum) {
      return `Vui lòng chọn ít nhất ${minimum} lựa chọn cho ${group.name}.`;
    }
    if (maximum != null && count > maximum) {
      return `Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`;
    }
  }
  return "";
};

export const calculateModifierPricing = (basePrice, groups = [], selected = {}) => {
  let setPrice = null;
  let setCount = 0;
  let delta = 0;

  for (const group of groups || []) {
    const selectedIds = selected[group.id] || [];
    for (const optionId of selectedIds) {
      const option = (group.options || []).find(
        (candidate) => String(candidate.id) === String(optionId),
      );
      if (!option) continue;
      const amount = Number(option.priceRule?.amount || 0);
      if (option.priceRule?.rule === "SET") {
        setCount += 1;
        if (setPrice == null) setPrice = amount;
      } else {
        delta += amount;
      }
    }
  }

  const base = Number(basePrice || 0);
  const unitPrice = Math.max(0, (setPrice == null ? base : setPrice) + delta);
  return {
    unitPrice,
    modifiersPrice: unitPrice - base,
    setCount,
  };
};

export const shareFoodDetail = async ({ title, text, url, navigatorRef }) => {
  const nav = navigatorRef || (typeof navigator !== "undefined" ? navigator : null);
  if (!nav) return "unsupported";

  if (typeof nav.share === "function") {
    await nav.share({ title, text, url });
    return "shared";
  }

  if (nav.clipboard?.writeText) {
    await nav.clipboard.writeText(url);
    return "copied";
  }

  return "unsupported";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatCountdown = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
};

const formatAddress = (address) =>
  [
    address?.line1,
    address?.line2,
    address?.ward,
    address?.district,
    address?.city,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(", ");

const formatTag = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const FOOD_TYPE_LABELS = {
  VEGETARIAN: "Món chay",
  VEGAN: "Thuần chay",
  NON_VEGETARIAN: "Món mặn",
  MIXED: "Có lựa chọn chay và mặn",
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

const getGroupHint = (group) => {
  if (group.selectionType === "single") return group.required ? "Chọn 1" : "Tối đa 1";
  const minimum = group.required
    ? Math.max(1, Number(group.minSelected || 0))
    : Number(group.minSelected || 0);
  const maximum = group.maxSelected == null ? null : Number(group.maxSelected);
  if (minimum && maximum) return `Chọn ${minimum}–${maximum}`;
  if (maximum) return `Tối đa ${maximum}`;
  if (minimum) return `Ít nhất ${minimum}`;
  return "Có thể chọn nhiều";
};

const getOptionPriceLabel = (option) => {
  const amount = Number(option.priceRule?.amount || 0);
  if (option.priceRule?.rule === "SET") return formatCurrency(amount);
  if (!amount) return "Không thêm phí";
  return `${amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(amount))}`;
};

const getVariantMeta = (variant) => {
  const quantity = Number(variant?.sellQty || 1).toLocaleString("vi-VN");
  const unit = variant?.sellUnit || (variant?.mode === "BY_WEIGHT" ? "kg" : "portion");
  return variant?.mode === "BY_WEIGHT"
    ? `${quantity}${unit}`
    : `${quantity} ${unit === "portion" ? "phần" : unit}`;
};

const resolveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.VITE_API_URL) {
    try {
      return new URL(import.meta.env.VITE_API_URL).origin;
    } catch {
      return String(import.meta.env.VITE_API_URL).replace(/\/graphql\/?$/, "");
    }
  }
  return typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:4000";
};

const getMutationError = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const FoodDetailV2 = () => {
  const { foodId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const preloadedDish = location.state?.dish || null;
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const restaurantHint =
    location.state?.restaurantId ||
    preloadedDish?.restaurantId ||
    queryParams.get("restaurantId") ||
    null;
  const selectedVariantHint = location.state?.selectedVariantKey || null;

  const { user, isAuthenticated } = useContext(AuthContext) || {};
  const roleName = String(
    user?.roleName || user?.role?.slug || user?.role?.name || "",
  ).toLowerCase();
  const isCustomer = roleName === "customer";
  const { showNotification } = useNotification();

  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
    getTotalItems,
    getTotalPrice,
    upsertCartLine,
  } = useCart();
  const {
    updateCartItemQuantity,
    removeCartLineItem,
    clearCustomerCart,
    removeRestaurantScopedItems,
    isBusy: cartBusy,
    busyItemIds,
    busyRestaurantIds,
    isClearing,
  } = useCustomerCartActions({
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    removeRestaurantItems,
  });

  const [selectedVariantKey, setSelectedVariantKey] = useState(
    selectedVariantHint || "",
  );
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [modifierAttempted, setModifierAttempted] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const viewRecordedRef = useRef(null);

  const hasUsefulPreload =
    String(preloadedDish?.id || "") === String(foodId || "") &&
    preloadedDish?.name &&
    preloadedDish?.restaurantId;

  const {
    data: dishData,
    loading: dishLoading,
    error: dishError,
    refetch: refetchDish,
  } = useQuery(CUSTOMER_MENU_ITEM, {
    variables: { id: foodId, restaurantId: restaurantHint || undefined },
    skip: !foodId,
    fetchPolicy: "cache-and-network",
  });

  const dish = useMemo(() => {
    const serverDish = dishData?.customerMenuItem;
    if (!serverDish && !hasUsefulPreload) return null;
    return { ...(hasUsefulPreload ? preloadedDish : {}), ...(serverDish || {}) };
  }, [dishData?.customerMenuItem, hasUsefulPreload, preloadedDish]);

  const variants = useMemo(() => {
    const source = Array.isArray(dish?.servingVariants)
      ? dish.servingVariants.filter((variant) => variant?.key)
      : [];
    if (source.length) return source;
    if (!dish) return [];
    return [
      {
        key: dish.defaultServingKey || "portion",
        name: "Phần tiêu chuẩn",
        mode: "PORTION",
        sellQty: 1,
        sellUnit: "portion",
        price: Number(dish.basePrice || 0),
        isDefault: true,
      },
    ];
  }, [dish]);

  useEffect(() => {
    if (!variants.length) return;
    const preferred =
      variants.find((variant) => variant.key === selectedVariantHint) ||
      variants.find((variant) => variant.key === dish?.defaultServingKey) ||
      variants.find((variant) => variant.isDefault) ||
      variants[0];
    setSelectedVariantKey((current) =>
      variants.some((variant) => variant.key === current)
        ? current
        : preferred.key,
    );
  }, [dish?.defaultServingKey, selectedVariantHint, variants]);

  const selectedVariant = useMemo(
    () =>
      variants.find((variant) => variant.key === selectedVariantKey) ||
      variants[0] ||
      null,
    [selectedVariantKey, variants],
  );

  const { data: restaurantData, loading: restaurantLoading } = useQuery(
    PUBLIC_RESTAURANT,
    {
      variables: { id: dish?.restaurantId },
      skip: !dish?.restaurantId,
      fetchPolicy: "cache-and-network",
    },
  );
  const restaurant = restaurantData?.publicRestaurant || null;

  const {
    data: modifierData,
    loading: modifierLoading,
    error: modifierError,
  } = useQuery(CUSTOMER_MODIFIER_GROUPS, {
    variables: {
      restaurantId: dish?.restaurantId,
      menuItemId: dish?.id,
    },
    skip: !dish?.restaurantId || !dish?.id,
    fetchPolicy: "cache-and-network",
  });
  const modifierGroups = useMemo(
    () => modifierData?.customerModifierGroups || [],
    [modifierData?.customerModifierGroups],
  );

  useEffect(() => {
    if (modifierLoading) return;
    const next = {};
    for (const group of modifierGroups) {
      const defaults = (group.options || [])
        .filter((option) => option.isDefault)
        .map((option) => option.id);
      next[group.id] =
        group.selectionType === "single" ? defaults.slice(0, 1) : defaults;
    }
    setSelectedModifiers(next);
    setModifierAttempted(false);
  }, [dish?.id, modifierGroups, modifierLoading]);

  const modifierSelections = useMemo(
    () =>
      modifierGroups.flatMap((group) =>
        (selectedModifiers[group.id] || []).map((optionId) => ({
          groupId: group.id,
          optionId,
        })),
      ),
    [modifierGroups, selectedModifiers],
  );
  const modifierErrorMessage = useMemo(
    () => getModifierSelectionError(modifierGroups, selectedModifiers),
    [modifierGroups, selectedModifiers],
  );
  const baseUnitPrice = Number(
    selectedVariant?.price ?? dish?.basePrice ?? 0,
  );
  const modifierPricing = useMemo(
    () =>
      calculateModifierPricing(
        baseUnitPrice,
        modifierGroups,
        selectedModifiers,
      ),
    [baseUnitPrice, modifierGroups, selectedModifiers],
  );

  const { getPromotionForMenuItem, getPromotionLabel } =
    useActiveMenuPromotions(dish?.restaurantId, {
      skip: !dish?.restaurantId,
    });
  const promotion = useMemo(
    () => getPromotionForMenuItem(dish),
    [dish, getPromotionForMenuItem],
  );
  const promotionLabel = getPromotionLabel(promotion);

  const { data: reviewData, loading: reviewsLoading } = useQuery(
    FOOD_REVIEW_SUMMARY,
    {
      variables: {
        restaurantId: dish?.restaurantId,
        targetId: dish?.id,
      },
      skip: !dish?.restaurantId || !dish?.id,
      fetchPolicy: "cache-and-network",
    },
  );
  const reviewStats = reviewData?.reviewStats || { total: 0, avgRating: 0 };
  const reviews = reviewData?.reviews?.items || [];

  const { data: favoriteData, refetch: refetchFavorites } = useQuery(
    MY_FOOD_FAVORITES,
    {
      skip: !isAuthenticated || !isCustomer,
      fetchPolicy: "cache-and-network",
    },
  );
  const isFavorite = (favoriteData?.myFavorites || []).some(
    (favorite) => String(favorite.targetId) === String(dish?.id),
  );
  const [toggleFavorite, { loading: favoriteBusy }] = useMutation(
    TOGGLE_FAVORITE,
    {
      onCompleted: () => refetchFavorites?.(),
      onError: () =>
        showNotification("Không thể cập nhật món yêu thích.", "error"),
    },
  );

  const { preferences, loading: preferenceLoading } = useFoodPreferences({
    skip: !isAuthenticated || !isCustomer,
  });
  const preferenceMeta = useMemo(
    () =>
      isAuthenticated && isCustomer && dish
        ? analyzeMenuItemForFoodPreferences(dish, preferences)
        : null,
    [dish, isAuthenticated, isCustomer, preferences],
  );

  const liveStateVariables = useMemo(
    () => ({
      input: {
        itemType: "MENU_ITEM",
        restaurantId: dish?.restaurantId,
        menuItemId: dish?.id,
        servingVariantKey: selectedVariant?.key,
        selectedModifiers: modifierSelections,
        ...(user?.id ? { userId: user.id } : {}),
      },
    }),
    [dish?.id, dish?.restaurantId, modifierSelections, selectedVariant?.key, user?.id],
  );
  const shouldSkipLiveState =
    !dish?.restaurantId ||
    !dish?.id ||
    !selectedVariant?.key ||
    modifierLoading ||
    Boolean(modifierErrorMessage);
  const {
    data: liveData,
    loading: liveLoading,
    error: liveError,
    refetch: refetchLiveState,
  } = useQuery(MENU_ITEM_LIVE_STATE, {
    variables: liveStateVariables,
    skip: shouldSkipLiveState,
    fetchPolicy: "network-only",
    pollInterval: 10000,
  });
  const liveState = liveData?.menuItemLiveState || null;

  useEffect(() => {
    if (!dish?.restaurantId || !dish?.id) return undefined;
    const socket = io(resolveSocketUrl(), { transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("joinRestaurant", dish.restaurantId);
      socket.emit("joinMenuItemView", {
        restaurantId: dish.restaurantId,
        menuItemId: dish.id,
      });
    });
    socket.on("inventoryEvents", (event) => {
      if (String(event?.menuItemId || "") === String(dish.id)) {
        refetchLiveState?.();
      }
    });
    return () => {
      socket.emit("leaveMenuItemView", {
        restaurantId: dish.restaurantId,
        menuItemId: dish.id,
      });
      socket.disconnect();
    };
  }, [dish?.id, dish?.restaurantId, refetchLiveState]);

  useEffect(() => {
    if (!liveState?.myHoldExpiresAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveState?.myHoldExpiresAt]);

  const holdSeconds = useMemo(() => {
    if (!liveState?.myHoldExpiresAt) return null;
    const expiresAt = new Date(liveState.myHoldExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return null;
    return Math.max(0, Math.floor((expiresAt - now) / 1000));
  }, [liveState?.myHoldExpiresAt, now]);

  useEffect(() => {
    if (!dish?.id || !isAuthenticated || !isCustomer) return;
    if (viewRecordedRef.current === String(dish.id)) return;
    viewRecordedRef.current = String(dish.id);
    const analyticsDish = { ...dish, foodPreferenceMeta: preferenceMeta };
    recordForYouItemInteraction(
      user?.id,
      {
        id: dish.id,
        name: dish.name,
        restaurantId: dish.restaurantId,
        restaurantName: restaurant?.name,
        categoryId: dish.categoryId,
      },
      "view",
    );
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.FOOD_DETAIL_VIEW, {
      userId: user?.id,
      itemId: dish.id,
      restaurantId: dish.restaurantId,
      categoryId: dish.categoryId,
      source: "food_detail_v2",
      reasonType: getForYouReasonType(analyticsDish),
    });
  }, [dish, isAuthenticated, isCustomer, preferenceMeta, restaurant?.name, user?.id]);

  const [addCartItem, { loading: adding }] = useMutation(ADD_CART_ITEM);
  const availability = getMenuItemAvailability(dish || {});
  const catalogOrderable = dish ? canCustomerOrderMenuItem(dish) : false;
  const restaurantCanOrder = Boolean(restaurant?.canOrder);
  const restaurantBlockedReason = getCannotOrderReason(
    restaurant?.openingStatus,
  );
  const maxAvailable = Number(liveState?.maxAvailableQty || 0);
  const outOfStock =
    !catalogOrderable ||
    Boolean(liveState?.outOfStock) ||
    (Boolean(liveState) && maxAvailable < 1);
  const quantityExceedsAvailable =
    Boolean(liveState) && maxAvailable > 0 && quantity > maxAvailable;
  const totalPrice = modifierPricing.unitPrice * quantity;

  const orderAction = getFoodOrderingActionState({
    adding,
    restaurantLoading,
    hasRestaurant: Boolean(restaurant),
    restaurantCanOrder,
    restaurantBlockedReason,
    modifierLoading,
    modifierErrorMessage,
    hasSelectedVariant: Boolean(selectedVariant),
    liveLoading,
    liveError: Boolean(liveError),
    hasLiveState: Boolean(liveState),
    liveBlocked: Boolean(liveState?.blocked),
    outOfStock,
    quantityExceedsAvailable,
    isAuthenticated,
    isCustomer,
  });
  const buyButtonLabel =
    orderAction.intent === FOOD_ORDER_ACTION.LOGIN
      ? "Đăng nhập để đặt"
      : "Đặt ngay";

  const toggleModifier = (group, optionId) => {
    setModifierAttempted(false);
    setSelectedModifiers((current) => {
      const previous = current[group.id] || [];
      if (group.selectionType === "single") {
        return { ...current, [group.id]: [optionId] };
      }
      const exists = previous.some((id) => String(id) === String(optionId));
      if (exists) {
        return {
          ...current,
          [group.id]: previous.filter(
            (id) => String(id) !== String(optionId),
          ),
        };
      }
      const maximum =
        group.maxSelected == null ? null : Number(group.maxSelected);
      if (maximum != null && previous.length >= maximum) {
        showNotification(
          `Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`,
          "warning",
        );
        return current;
      }
      return { ...current, [group.id]: [...previous, optionId] };
    });
  };

  const redirectToLogin = () => {
    const returnPath = `${location.pathname}${location.search || ""}`;
    showNotification("Vui lòng đăng nhập bằng tài khoản khách hàng để đặt món.", "warning");
    navigate("/login", { state: { from: returnPath } });
  };

  const syncAddedLine = (cartData) => {
    const wantedKey = buildModifierSelectionKey(modifierSelections);
    const returnedItem = (cartData?.items || []).find((item) => {
      const itemKey = buildModifierSelectionKey(item.modifiers || []);
      return (
        String(item.menuItemId) === String(dish.id) &&
        String(item.servingVariantKey || "portion") ===
          String(selectedVariant.key || "portion") &&
        normalizeNote(item.note) === normalizeNote(note) &&
        itemKey === wantedKey
      );
    });
    if (!returnedItem) return false;

    upsertCartLine?.(
      {
        id: dish.id,
        dishId: dish.id,
        menuItemId: dish.id,
        restaurantId: dish.restaurantId,
        menuId: dish.menuId,
        categoryId: dish.categoryId,
        name: returnedItem.name || dish.name,
        price: Number(returnedItem.price || baseUnitPrice),
        modifiersPrice: Number(returnedItem.modifiersPrice || 0),
        quantity: Number(returnedItem.quantity || quantity),
        image: returnedItem.thumbImage || dish.thumbImage || FOOD_PLACEHOLDER,
        thumbImage: returnedItem.thumbImage || dish.thumbImage || FOOD_PLACEHOLDER,
        note: returnedItem.note || "",
        servingVariantKey: returnedItem.servingVariantKey || selectedVariant.key,
        servingKey: returnedItem.servingVariantKey || selectedVariant.key,
        servingVariant: selectedVariant,
        method: selectedVariant.name,
        modifiers: returnedItem.modifiers || [],
        selectedModifiers: (returnedItem.modifiers || []).map((modifier) => ({
          groupId: modifier.groupId,
          optionId: modifier.optionId,
        })),
        backendCartId: cartData.id,
        backendCartItemId: returnedItem.id,
        holdExpiresAt: returnedItem.holdExpiresAt,
        holdStatus: returnedItem.holdStatus,
      },
      { preserveQuantity: false },
    );
    return true;
  };

  const addSelectionToCart = async () => {
    setModifierAttempted(true);
    if (modifierErrorMessage) {
      const modifierSection = document.querySelector(
        ".food-detail-v2__modifiers",
      );
      modifierSection?.scrollIntoView({ behavior: "smooth", block: "center" });
      modifierSection?.querySelector("input")?.focus();
      return false;
    }
    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_STOCK) {
      showNotification("Đang kiểm tra lại tồn kho…", "info");
      await refetchLiveState?.();
      return false;
    }
    if (orderAction.intent === FOOD_ORDER_ACTION.LOGIN) {
      redirectToLogin();
      return false;
    }
    if (orderAction.disabled) return false;

    try {
      const { data } = await addCartItem({
        variables: {
          input: {
            userId: user.id,
            restaurantId: dish.restaurantId,
            menuItemId: dish.id,
            quantity,
            note: normalizeNote(note) || null,
            servingVariantKey: selectedVariant.key,
            selectedModifiers: modifierSelections,
          },
        },
      });
      const cartData = data?.addCartItem;
      if (!cartData?.id || !syncAddedLine(cartData)) {
        throw new Error("Không nhận được dòng giỏ hàng đã đồng bộ từ máy chủ.");
      }

      recordForYouItemInteraction(
        user?.id,
        {
          id: dish.id,
          name: dish.name,
          restaurantId: dish.restaurantId,
          restaurantName: restaurant?.name,
          categoryId: dish.categoryId,
        },
        "order_intent",
      );
      recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.ADD_TO_CART_INTENT, {
        userId: user?.id,
        itemId: dish.id,
        restaurantId: dish.restaurantId,
        categoryId: dish.categoryId,
        source: "food_detail_v2",
        reasonType: getForYouReasonType({
          ...dish,
          foodPreferenceMeta: preferenceMeta,
        }),
      });
      await refetchLiveState?.();
      showNotification("Đã giữ món trong giỏ hàng trong 5 phút.", "success");
      return true;
    } catch (error) {
      showNotification(
        getMutationError(
          error,
          "Không thể giữ món trong giỏ. Vui lòng thử lại.",
        ),
        "error",
      );
      await refetchLiveState?.();
      return false;
    }
  };

  const handleBuyNow = async () => {
    const added = await addSelectionToCart();
    if (!added) return;
    navigate("/checkout", {
      state: { from: `${location.pathname}${location.search || ""}` },
    });
  };

  const handleFavorite = () => {
    if (!isAuthenticated || !isCustomer) {
      redirectToLogin();
      return;
    }
    toggleFavorite({
      variables: { input: { type: "food", targetId: dish.id } },
    }).then(() =>
      showNotification(
        isFavorite ? "Đã bỏ món khỏi yêu thích." : "Đã lưu món vào yêu thích.",
        "success",
      ),
    );
  };

  const handleShare = async () => {
    try {
      const result = await shareFoodDetail({
        title: dish.name,
        text: `Xem ${dish.name} tại ${restaurant?.name || "Cohan"}`,
        url: window.location.href,
      });
      if (result === "copied") {
        showNotification("Đã sao chép liên kết món ăn.", "success");
      } else if (result === "unsupported") {
        showNotification("Trình duyệt chưa hỗ trợ chia sẻ liên kết.", "warning");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        showNotification("Không thể chia sẻ món ăn lúc này.", "error");
      }
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(
      dish?.restaurantId
        ? `/cus-menu?restaurantId=${encodeURIComponent(dish.restaurantId)}`
        : "/cus-menu",
    );
  };

  if (dishLoading && !dish) {
    return (
      <main className="food-detail-v2 food-detail-v2--state" aria-busy="true">
        <div className="food-detail-v2__state-card">
          <div className="food-detail-v2__loader" aria-hidden="true" />
          <h1>Đang tải thông tin món ăn</h1>
          <p>Hệ thống đang kiểm tra giá, tùy chọn và tồn kho mới nhất.</p>
        </div>
      </main>
    );
  }

  if ((dishError && !dish) || (!dishLoading && !dish)) {
    return (
      <main className="food-detail-v2 food-detail-v2--state">
        <div className="food-detail-v2__state-card" role="alert">
          <AlertTriangle size={32} />
          <h1>Món này hiện không thể hiển thị</h1>
          <p>
            Món có thể đã được ẩn, menu ngừng hoạt động hoặc nhà hàng chưa công
            khai.
          </p>
          <div className="food-detail-v2__state-actions">
            <button type="button" onClick={() => refetchDish?.()}>
              <RefreshCw size={17} /> Thử lại
            </button>
            <button type="button" className="secondary" onClick={() => navigate("/cus-menu")}>
              Xem thực đơn khác
            </button>
          </div>
        </div>
      </main>
    );
  }

  const restaurantAddress = formatAddress(restaurant?.address);
  const foodTypeLabel = FOOD_TYPE_LABELS[String(dish.foodType || "").toUpperCase()];
  const ingredientNames = Array.isArray(dish.ingredientNames)
    ? dish.ingredientNames.filter(Boolean)
    : [];
  const servingLabel =
    dish.servingPortion && dish.servingUnit
      ? `${Number(dish.servingPortion).toLocaleString("vi-VN")} ${dish.servingUnit}`
      : null;
  const prepLabel =
    Number(dish.avgPrepTimeMin) > 0 ? `${dish.avgPrepTimeMin} phút` : null;

  return (
    <main className="food-detail-v2">
      <div className="food-detail-v2__shell">
        <nav className="food-detail-v2__breadcrumb" aria-label="Điều hướng món ăn">
          <button type="button" onClick={handleBack}>
            <ArrowLeft size={17} /> Quay lại thực đơn
          </button>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{dish.name}</span>
        </nav>

        <section className="food-detail-v2__hero" aria-labelledby="food-detail-title">
          <div className="food-detail-v2__media">
            <div className="food-detail-v2__image-wrap">
              <img
                src={dish.thumbImage || FOOD_PLACEHOLDER}
                alt={dish.name}
                width="1200"
                height="900"
                fetchPriority="high"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = FOOD_PLACEHOLDER;
                }}
              />
              <div className="food-detail-v2__media-badges">
                <span className={`status status--${availability.badgeClassName}`}>
                  {availability.label}
                </span>
                {promotionLabel ? (
                  <span className="promotion">
                    <Sparkles size={14} /> {promotionLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="food-detail-v2__facts" aria-label="Thông tin nhanh">
              {servingLabel ? (
                <div>
                  <Users size={18} />
                  <span>Khẩu phần</span>
                  <strong>{servingLabel}</strong>
                </div>
              ) : null}
              {prepLabel ? (
                <div>
                  <Clock3 size={18} />
                  <span>Chuẩn bị dự kiến</span>
                  <strong>{prepLabel}</strong>
                </div>
              ) : null}
              <div>
                <Star size={18} />
                <span>Đánh giá</span>
                <strong>
                  {reviewStats.total
                    ? `${Number(reviewStats.avgRating || 0).toFixed(1)} / 5`
                    : "Chưa có"}
                </strong>
              </div>
            </div>

            <section className="food-detail-v2__about" aria-labelledby="food-about-title">
              <div className="food-detail-v2__section-heading">
                <div>
                  <span>Thông tin món</span>
                  <h2 id="food-about-title">Khách cần biết trước khi đặt</h2>
                </div>
              </div>
              {dish.description ? <p>{dish.description}</p> : <p>Nhà hàng chưa cập nhật mô tả chi tiết cho món này.</p>}

              <div className="food-detail-v2__chips">
                {foodTypeLabel ? <span><Leaf size={14} /> {foodTypeLabel}</span> : null}
                {(dish.meatTypes || []).map((type) => (
                  <span key={type}>{MEAT_TYPE_LABELS[type] || formatTag(type)}</span>
                ))}
                {(dish.dietTags || []).map((tag) => (
                  <span key={`diet-${tag}`}>{formatTag(tag)}</span>
                ))}
              </div>

              {ingredientNames.length ? (
                <div className="food-detail-v2__ingredient-block">
                  <strong>Thành phần chính</strong>
                  <p>{ingredientNames.join(", ")}.</p>
                  <small>Danh sách tóm tắt, không bao gồm định lượng hoặc công thức nội bộ.</small>
                </div>
              ) : null}

              {(dish.allergenTags || []).length ? (
                <div className="food-detail-v2__allergen" role="note">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Cảnh báo dị ứng</strong>
                    <p>
                      Món được đánh dấu có thể chứa: {(dish.allergenTags || []).map(formatTag).join(", ")}.
                      Hãy ghi chú hoặc liên hệ nhà hàng nếu bạn cần xác nhận kỹ hơn.
                    </p>
                  </div>
                </div>
              ) : null}

              {!preferenceLoading && preferenceMeta ? (
                <div
                  className={`food-detail-v2__preference ${
                    preferenceMeta.hasAllergyWarning ? "is-warning" : "is-match"
                  }`}
                >
                  {preferenceMeta.hasAllergyWarning ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                  <div>
                    <strong>
                      {preferenceMeta.hasAllergyWarning
                        ? "Cần kiểm tra với khẩu vị và dị ứng của bạn"
                        : preferenceMeta.isRecommended
                          ? "Phù hợp với lựa chọn ăn uống của bạn"
                          : "Thông tin cá nhân hóa"}
                    </strong>
                    <p>
                      {preferenceMeta.warningReason ||
                        (preferenceMeta.reasons || []).slice(0, 2).join(". ") ||
                        "Hãy xem thành phần và ghi chú món trước khi đặt."}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="food-detail-v2__order-card" aria-label="Chọn và đặt món">
            <div className="food-detail-v2__title-row">
              <div>
                <p>{restaurant?.name || "Nhà hàng"}</p>
                <h1 id="food-detail-title">{dish.name}</h1>
              </div>
              <div className="food-detail-v2__icon-actions">
                <button
                  type="button"
                  className={isFavorite ? "is-active" : ""}
                  aria-label={isFavorite ? "Bỏ món khỏi yêu thích" : "Lưu món yêu thích"}
                  aria-pressed={isFavorite}
                  disabled={favoriteBusy}
                  onClick={handleFavorite}
                >
                  <Heart size={19} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                <button type="button" aria-label="Chia sẻ món ăn" onClick={handleShare}>
                  <Share2 size={19} />
                </button>
              </div>
            </div>

            <div className="food-detail-v2__restaurant-meta">
              <Store size={17} />
              <div>
                <strong>
                  {restaurantCanOrder ? "Đang nhận đơn" : "Hiện chưa nhận đơn"}
                </strong>
                <span>{restaurantAddress || "Địa chỉ đang cập nhật"}</span>
              </div>
            </div>

            {!restaurantLoading && restaurant && !restaurantCanOrder ? (
              <div className="food-detail-v2__notice" role="status">
                <Info size={18} />
                <div>
                  <strong>Bạn vẫn có thể xem và chọn trước</strong>
                  <p>{restaurantBlockedReason}</p>
                </div>
              </div>
            ) : null}

            <div className="food-detail-v2__price">
              <span>Giá theo lựa chọn</span>
              <strong>{formatCurrency(modifierPricing.unitPrice)}</strong>
              {modifierPricing.modifiersPrice !== 0 ? (
                <small>
                  Tùy chọn {modifierPricing.modifiersPrice > 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(modifierPricing.modifiersPrice))}
                </small>
              ) : null}
            </div>

            <fieldset className="food-detail-v2__variants">
              <legend>Chọn khẩu phần hoặc cách bán</legend>
              <div className="food-detail-v2__option-grid">
                {variants.map((variant) => {
                  const checked = variant.key === selectedVariant?.key;
                  return (
                    <label key={variant.key} className={checked ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="serving-variant"
                        value={variant.key}
                        checked={checked}
                        onChange={() => setSelectedVariantKey(variant.key)}
                      />
                      <span>
                        <strong>{variant.name || "Phần tiêu chuẩn"}</strong>
                        <small>{getVariantMeta(variant)}</small>
                      </span>
                      <b>{formatCurrency(variant.price ?? dish.basePrice)}</b>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="food-detail-v2__modifiers">
              <div className="food-detail-v2__subheading">
                <div>
                  <span>Tùy chỉnh món</span>
                  <strong>Chọn theo nhu cầu của bạn</strong>
                </div>
                {modifierLoading ? <small>Đang tải...</small> : null}
              </div>

              {modifierError ? (
                <div className="food-detail-v2__inline-error" role="alert">
                  Không thể tải tùy chọn món. Vui lòng thử lại sau.
                </div>
              ) : null}

              {!modifierLoading && !modifierError && !modifierGroups.length ? (
                <p className="food-detail-v2__muted">Món này không có tùy chọn thêm.</p>
              ) : null}

              {modifierGroups.map((group) => {
                const selectedIds = selectedModifiers[group.id] || [];
                return (
                  <fieldset key={group.id} className="food-detail-v2__modifier-group">
                    <legend>
                      <span>{group.name}</span>
                      <small>
                        {group.required ? "Bắt buộc" : "Tùy chọn"} · {getGroupHint(group)}
                      </small>
                    </legend>
                    <div>
                      {(group.options || []).map((option) => {
                        const checked = selectedIds.some(
                          (id) => String(id) === String(option.id),
                        );
                        return (
                          <label key={option.id} className={checked ? "is-selected" : ""}>
                            <input
                              type={group.selectionType === "single" ? "radio" : "checkbox"}
                              name={`modifier-${group.id}`}
                              checked={checked}
                              onChange={() => toggleModifier(group, option.id)}
                            />
                            <span>
                              <strong>{option.name}</strong>
                              {option.isDefault ? <small>Mặc định</small> : null}
                            </span>
                            <b>{getOptionPriceLabel(option)}</b>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              {modifierAttempted && modifierErrorMessage ? (
                <div className="food-detail-v2__inline-error" role="alert">
                  {modifierErrorMessage}
                </div>
              ) : null}
            </div>

            <label className="food-detail-v2__note">
              <span>Ghi chú cho nhà hàng</span>
              <textarea
                name="orderNote"
                autoComplete="off"
                value={note}
                maxLength={180}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: ít cay, không hành, đóng gói riêng…"
              />
              <small>{note.length}/180</small>
            </label>

            <div className="food-detail-v2__live" aria-live="polite">
              <div className="food-detail-v2__subheading">
                <div>
                  <span>Tình trạng hiện tại</span>
                  <strong>
                    {liveError
                      ? "Chưa kiểm tra được tồn kho"
                      : liveLoading || !liveState
                        ? "Đang kiểm tra..."
                        : outOfStock
                          ? "Món hiện chưa khả dụng"
                          : `Còn có thể đặt ${maxAvailable} suất`}
                  </strong>
                </div>
                {liveError ? (
                  <button type="button" onClick={() => refetchLiveState?.()}>
                    <RefreshCw size={15} /> Thử lại
                  </button>
                ) : null}
              </div>
              {liveState ? (
                <div className="food-detail-v2__live-meta">
                  <span>{liveState.viewerCount} người đang xem</span>
                  <span>{liveState.reservedCartQty} suất đang được giữ</span>
                  {liveState.myCartQty > 0 ? (
                    <span>Bạn đang giữ {liveState.myCartQty} suất</span>
                  ) : null}
                  {holdSeconds != null ? (
                    <span>Hết hạn sau {formatCountdown(holdSeconds)}</span>
                  ) : null}
                </div>
              ) : null}
              {liveState?.abuseWarning ? (
                <p className="food-detail-v2__live-warning">{liveState.abuseWarning}</p>
              ) : null}
            </div>

            <FoodAvailabilityWatchPanel
              restaurantId={dish.restaurantId}
              menuItemId={dish.id}
              servingKey={selectedVariant?.key || dish.defaultServingKey || "portion"}
              desiredQuantity={quantity}
              userId={user?.id}
              source="online"
              isVisible={outOfStock}
              isOutOfStock={outOfStock}
              onRegistered={() => refetchLiveState?.()}
            />

            <div className="food-detail-v2__purchase-row">
              <div className="food-detail-v2__quantity" aria-label="Chọn số lượng">
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={adding || quantity <= 1}
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  <Minus size={17} />
                </button>
                <output aria-live="polite">{quantity}</output>
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  disabled={
                    adding ||
                    outOfStock ||
                    (Boolean(liveState) && maxAvailable > 0 && quantity >= maxAvailable)
                  }
                  onClick={() =>
                    setQuantity((current) =>
                      liveState && maxAvailable > 0
                        ? Math.min(maxAvailable, current + 1)
                        : current + 1,
                    )
                  }
                >
                  <Plus size={17} />
                </button>
              </div>
              <div className="food-detail-v2__total">
                <span>Tạm tính</span>
                <strong>{formatCurrency(totalPrice)}</strong>
              </div>
            </div>

            <div className="food-detail-v2__actions">
              <button
                type="button"
                className="secondary"
                disabled={orderAction.disabled}
                aria-describedby="food-order-action-status"
                onClick={addSelectionToCart}
              >
                <ShoppingCart size={19} aria-hidden="true" /> {orderAction.label}
              </button>
              <button
                type="button"
                disabled={orderAction.disabled}
                aria-describedby="food-order-action-status"
                onClick={handleBuyNow}
              >
                <ShoppingBag size={19} aria-hidden="true" /> {buyButtonLabel}
              </button>
            </div>
            <p id="food-order-action-status" className="food-detail-v2__hold-note">
              Khi thêm vào giỏ, hệ thống giữ tồn kho tối đa 5 phút. Giá và tồn kho
              được xác nhận lại trên máy chủ.
            </p>
          </aside>
        </section>

        <section className="food-detail-v2__reviews" aria-labelledby="food-reviews-title">
          <div className="food-detail-v2__section-heading">
            <div>
              <span>Trải nghiệm thực tế</span>
              <h2 id="food-reviews-title">Đánh giá từ khách hàng</h2>
            </div>
            <div className="food-detail-v2__review-score">
              <Star size={20} fill="currentColor" />
              <strong>{Number(reviewStats.avgRating || 0).toFixed(1)}</strong>
              <span>{reviewStats.total || 0} đánh giá</span>
            </div>
          </div>

          {reviewsLoading ? (
            <div className="food-detail-v2__review-state">Đang tải đánh giá...</div>
          ) : !reviews.length ? (
            <div className="food-detail-v2__review-state">
              Chưa có đánh giá được công khai cho món này.
            </div>
          ) : (
            <div className="food-detail-v2__review-grid">
              {reviews.map((review) => (
                <article key={review.id}>
                  <div className="food-detail-v2__review-head">
                    <div>
                      <strong>{review.customerName || "Khách hàng"}</strong>
                      <span>{formatDate(review.createdAt)}</span>
                    </div>
                    <span className="food-detail-v2__stars" aria-label={`${review.rating} trên 5 sao`}>
                      <Star size={15} fill="currentColor" /> {review.rating}/5
                    </span>
                  </div>
                  {review.title ? <h3>{review.title}</h3> : null}
                  <p>{review.content}</p>
                  {review.verifiedPurchase ? <small><Check size={13} /> Đã xác minh mua hàng</small> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {cart.length > 0 ? (
        <button
          type="button"
          className="food-detail-v2__cart-fab"
          onClick={() => setIsCartOpen(true)}
          aria-label={`Mở giỏ hàng, ${getTotalItems()} món, tổng ${formatCurrency(getTotalPrice())}`}
        >
          <ShoppingCart size={20} />
          <span>{getTotalItems() > 99 ? "99+" : getTotalItems()}</span>
          <strong>{formatCurrency(getTotalPrice())}</strong>
        </button>
      ) : null}

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateCartItemQuantity}
        totalPrice={getTotalPrice()}
        onClearCart={clearCustomerCart}
        onRemoveRestaurantItems={removeRestaurantScopedItems}
        onRemoveItem={removeCartLineItem}
        isBusy={cartBusy || adding}
        busyItemIds={busyItemIds}
        busyRestaurantIds={busyRestaurantIds}
        isClearing={isClearing}
      />
    </main>
  );
};

export default FoodDetailV2;
