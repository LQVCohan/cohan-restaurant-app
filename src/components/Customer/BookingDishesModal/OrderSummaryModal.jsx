import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useContext,
} from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../common/Modal";
import ModifierModal from "./ModifierModal";
import { formatCurrency, formatQuantity } from "../../../utils/formatters";
import "./OrderSummaryModal.scss";
import { gql, useApolloClient } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import SuccessModal from "../SuccessModal/SuccessModal";
import { AuthContext } from "../../../context/AuthContext";
import {
  buildDiscountPricingInput,
  buildOrderDiscountPreviewInput,
  getDiscountBreakdownTotal,
  getShippingFeeForDiscountPreview,
  mapCartItemToOrderItemInput,
  mapDeliveryMethodToOrderType,
} from "../../../utils/discountPreviewPayload";
import {
  Store,
  MapPin,
  Clock,
  Truck,
  ShoppingBag,
  Utensils,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  CheckCircle,
  PlusCircle,
  CalendarDays,
  Receipt,
  AlertCircle,
} from "lucide-react";
import {
  getDiscountPreviewErrorMessage,
  useDiscountPreview,
} from "../../../hooks/useDiscountPreview";
import useFoodPreferences from "../../../hooks/useFoodPreferences";
import { analyzeMenuItemForFoodPreferences } from "../../../utils/foodPreferenceMatcher";
import { FOR_YOU_ANALYTICS_EVENTS, recordForYouAnalyticsEvent } from "../../../utils/forYouAnalytics";
const DEFAULT_SHIPPING = (prefill = {}) => ({
  fullName: prefill.fullName || "",
  phone: prefill.phone || "",
  email: prefill.email || "",
  address: "",
  note: "",
  deliveryMethod: "delivery",
  deliveryTime: "asap",
  scheduleDate: "",
  scheduleTime: "",
});

const ORDER_VAT_RATE = 0.1;

const getExpiredHoldItems = (items = []) =>
  items.filter((item) => {
    if (!item?.holdExpiresAt) return false;
    const expiresAt = new Date(item.holdExpiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date();
  });

const getEarliestHoldExpiry = (items = []) => {
  const timestamps = items
    .map((item) => item?.holdExpiresAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((time) => !Number.isNaN(time) && time > Date.now());

  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps));
};

const RESTAURANT_BY_ID = gql`
  query RestaurantById($id: ID!) {
    restaurant(id: $id) {
      id
      name
    }
  }
`;

const CREATE_CHECKOUT_ORDERS = gql`
  mutation CreateCheckoutOrders($input: CreateCheckoutOrdersInput!) {
    createCheckoutOrders(input: $input) {
      checkout {
        checkoutCode
        grandTotal
        orderIds
      }
      orders {
        id
        orderCode
        parentOrderCode
        restaurantId
        orderType
        totals {
          grandTotal
        }
        currentStatus
      }
    }
  }
`;
const CUSTOMER_MENU_ITEM_FOR_CHECKOUT_FOR_YOU = gql`
  query CustomerMenuItemForCheckoutForYou($id: ID!, $restaurantId: ID) {
    customerMenuItem(id: $id, restaurantId: $restaurantId) {
      id
      name
      description
      restaurantId
      categoryId
      menuId
      labels
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
    }
  }
`;

const getCheckoutItemMenuItemId = (item) => item?.dishId || item?.menuItemId || item?.id;
const getCheckoutItemMetadataKey = (item) =>
  `${item?.restaurantId || ""}:${getCheckoutItemMenuItemId(item) || ""}`;

function useRestaurantName(restaurantId) {
  const skip = !restaurantId;
  const { data } = useQuery(RESTAURANT_BY_ID, {
    variables: { id: restaurantId },
    skip,
  });
  return data?.restaurant?.name;
}

const OrderSummaryModal = ({
  isOpen,
  onClose,
  items = [],
  restaurantId,
  onSuccess, // Called after orders are persisted; parent should clear cart but not necessarily close.
}) => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const walletBalance = Number(user?.wallet?.balance || 0);
  const isCustomer = String(user?.roleName || "").toLowerCase() === "customer";
  const apolloClient = useApolloClient();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [currentView, setCurrentView] = useState("summary");
  const [currentEditingItem, setCurrentEditingItem] = useState(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [orderData, setOrderData] = useState([]);
  const [orderInfo, setOrderInfo] = useState({ id: "", time: "" });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [createCheckoutOrders] = useMutation(CREATE_CHECKOUT_ORDERS);

  const [shipping, setShipping] = useState(DEFAULT_SHIPPING());
  const [shippingTouched, setShippingTouched] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [receipt, setReceipt] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [selectedPromotionIds, setSelectedPromotionIds] = useState([]);
  const [discountBreakdown, setDiscountBreakdown] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountTouched, setDiscountTouched] = useState(false);
  const [menuItemMetadataByKey, setMenuItemMetadataByKey] = useState({});

  const { previewOrderDiscount, loading: isPreviewingDiscount } =
    useDiscountPreview();
  const {
    previewNote: foodPreferenceNote,
    preferences: customerFoodPreferences,
    loading: isLoadingFoodPreferences,
  } = useFoodPreferences({
    skip: !isAuthenticated || !isCustomer,
  });
  const hasMeaningfulFoodPreferenceNote =
    !!foodPreferenceNote &&
    foodPreferenceNote !== "Chưa có ghi chú đặc biệt." &&
    !isLoadingFoodPreferences;
  const isFoodPreferenceNoteApplied =
    hasMeaningfulFoodPreferenceNote &&
    (shipping?.note || "").includes(foodPreferenceNote);
  const handleCloseAll = () => {
    setIsSuccessOpen(false);
    onClose?.();
  };

  const mappedOrderData = useMemo(
    () =>
      (items || []).map((it) => ({
        id: it.id,
        dishId: it.dishId,
        restaurantId: it.restaurantId,
        name: it.name,
        image: it.image,
        cookingMethod: it.method || "",
        methodDelta: it.methodDelta || 0,
        description: it.description || "",
        unit: it.unit || "phần",
        quantity: it.quantity || 1,
        price: it.price || 0,
        modifiers: it.modifiers || [],
        modifiersPrice: it.modifiersPrice || 0,
        modifierGroupIds: it.modifierGroupIds || [],
        menuId: it.menuId,
        categoryId: it.categoryId,
        cartId: it.cartId || it.backendCartId || null,
        cartItemId: it.cartItemId || it.backendCartItemId || null,
        backendCartId: it.backendCartId || it.cartId || null,
        backendCartItemId: it.backendCartItemId || it.cartItemId || null,
        holdStatus: it.holdStatus || null,
        holdExpiresAt: it.holdExpiresAt || null,
        servingKey:
          it.servingKey || it.servingVariantKey || it.variantKey || null,
        servingVariantKey:
          it.servingVariantKey || it.variantKey || it.servingKey || null,
        variantKey:
          it.variantKey || it.servingVariantKey || it.servingKey || null,
      })),
    [items],
  );

  const groupedByRestaurant = useMemo(() => {
    const map = new Map();
    for (const item of orderData) {
      const rid = item.restaurantId || "unknown";
      if (!map.has(rid)) map.set(rid, []);
      map.get(rid).push(item);
    }
    return map;
  }, [orderData]);

  const restaurantCount = useMemo(
    () => new Set(orderData.map((i) => i.restaurantId || "unknown")).size,
    [orderData],
  );
  const previewRestaurantId = useMemo(() => {
    if (restaurantId) return restaurantId;
    const ids = [
      ...new Set(orderData.map((item) => item.restaurantId).filter(Boolean)),
    ];
    return ids.length === 1 ? ids[0] : null;
  }, [restaurantId, orderData]);

  const canPreviewDiscount =
    restaurantCount <= 1 && Boolean(previewRestaurantId);
  const itemsNeedingMetadata = useMemo(() => {
    const map = new Map();
    for (const item of orderData || []) {
      const menuItemId = getCheckoutItemMenuItemId(item);
      const itemRestaurantId = item?.restaurantId;
      if (!menuItemId) continue;
      const key = `${itemRestaurantId || ""}:${menuItemId}`;
      if (!map.has(key)) {
        map.set(key, { menuItemId, restaurantId: itemRestaurantId });
      }
    }
    return Array.from(map.values());
  }, [orderData]);
  const missingMetadataItems = useMemo(
    () =>
      itemsNeedingMetadata.filter(({ menuItemId, restaurantId: itemRestaurantId }) => {
        const key = `${itemRestaurantId || ""}:${menuItemId}`;
        return !Object.prototype.hasOwnProperty.call(menuItemMetadataByKey, key);
      }),
    [itemsNeedingMetadata, menuItemMetadataByKey],
  );
  useEffect(() => {
    if (isOpen) {
      const prefill = {
        fullName: user?.fullName,
        phone: user?.phone,
        email: user?.email,
      };
      generateOrderInfo();
      resetToSummaryView();
      setOrderData(mappedOrderData);
      setShipping(DEFAULT_SHIPPING(prefill));
      setShippingTouched(false);
      setNoteTouched(false);
      setCouponCode("");
      setSelectedPromotionIds([]);
      setDiscountBreakdown(null);
      setDiscountError("");
      setDiscountTouched(false);
      setCheckoutError("");
    }
  }, [isOpen, mappedOrderData, user]);
  useEffect(() => {
    if (!discountTouched) return;

    setDiscountBreakdown(null);
    setDiscountError("");
  }, [
    orderData,
    shipping.deliveryMethod,
    shipping.deliveryTime,
    shipping.address,
    selectedPromotionIds,
    discountTouched,
  ]);
  const generateOrderInfo = () => {
    const orderId =
      "DH" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const orderTime = new Date().toLocaleString("vi-VN");
    setOrderInfo({ id: orderId, time: orderTime });
  };

  const calculateSubtotals = () => {
    let subtotal = 0;
    let modifiersTotal = 0;
    orderData.forEach((item) => {
      subtotal += item.price * item.quantity;
      modifiersTotal += (item.modifiersPrice || 0) * item.quantity;
    });
    const total = subtotal + modifiersTotal;
    const tax = Math.round(total * ORDER_VAT_RATE);
    const finalTotal = total + tax;
    return { subtotal, modifiersTotal, tax, finalTotal };
  };

  const calcGroupTotals = useCallback((itemsOfGroup) => {
    let subtotal = 0;
    let modifiersTotal = 0;
    itemsOfGroup.forEach((item) => {
      subtotal += item.price * item.quantity;
      modifiersTotal += (item.modifiersPrice || 0) * item.quantity;
    });
    const total = subtotal + modifiersTotal;
    const tax = Math.round(total * ORDER_VAT_RATE);
    const finalTotal = total + tax;
    return { subtotal, modifiersTotal, tax, finalTotal };
  }, []);

  const handleShippingChange = useCallback((field, value) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
    setShippingTouched(true);
    if (field === "note") setNoteTouched(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || noteTouched) return;
    if (!hasMeaningfulFoodPreferenceNote) return;
    if ((shipping?.note || "").trim()) return;

    setShipping((prev) => ({ ...prev, note: foodPreferenceNote }));
  }, [
    isOpen,
    isAuthenticated,
    noteTouched,
    shipping?.note,
    hasMeaningfulFoodPreferenceNote,
    foodPreferenceNote,
  ]);

  const applyFoodPreferenceNote = useCallback(() => {
    if (!hasMeaningfulFoodPreferenceNote) return;

    setShipping((prev) => {
      const currentNote = (prev.note || "").trim();
      if (!currentNote) return { ...prev, note: foodPreferenceNote };
      if (currentNote.includes(foodPreferenceNote)) return prev;
      return { ...prev, note: `${currentNote}. ${foodPreferenceNote}` };
    });
    setNoteTouched(true);
  }, [hasMeaningfulFoodPreferenceNote, foodPreferenceNote]);

  const isShippingValid = useMemo(() => {
    const nameOk = (shipping.fullName || "").trim().length >= 2;
    const phoneRaw = (shipping.phone || "").trim();
    const emailRaw = (shipping.email || "").trim();
    const phoneOk = phoneRaw ? /^(\+?\d{7,15})$/.test(phoneRaw) : false;
    const emailOk = emailRaw
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      : false;
    const contactOk = phoneOk || emailOk;
    const needAddress = shipping.deliveryMethod === "delivery";
    const addressOk =
      !needAddress || (shipping.address || "").trim().length > 5;
    const scheduleOk =
      shipping.deliveryTime === "asap" ||
      (shipping.scheduleDate && shipping.scheduleTime);

    return nameOk && contactOk && scheduleOk && addressOk;
  }, [shipping]);

  const shippingErrors = useMemo(() => {
    if (!shippingTouched) return {};
    const errs = {};
    if (!shipping.fullName?.trim() || shipping.fullName.trim().length < 2) {
      errs.fullName = "Vui lòng nhập họ tên hợp lệ.";
    }
    const phoneRaw = (shipping.phone || "").trim();
    const emailRaw = (shipping.email || "").trim();
    const phoneOk = phoneRaw ? /^(\+?\d{7,15})$/.test(phoneRaw) : false;
    const emailOk = emailRaw
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      : false;
    if (!phoneOk && !emailOk) {
      errs.contact = "Cần ít nhất số điện thoại hợp lệ hoặc email hợp lệ.";
    }
    if (
      shipping.deliveryMethod === "delivery" &&
      (!shipping.address?.trim() || shipping.address.trim().length < 6)
    ) {
      errs.address = "Địa chỉ cần ít nhất 6 ký tự.";
    }
    if (
      shipping.deliveryTime === "schedule" &&
      (!shipping.scheduleDate || !shipping.scheduleTime)
    ) {
      errs.schedule = "Vui lòng chọn ngày/giờ giao hàng.";
    }
    return errs;
  }, [shipping, shippingTouched]);

  const handleAddModifier = (itemId) => {
    const item = orderData.find((i) => i.id === itemId);
    if (item) {
      setCurrentEditingItem(item);
      setIsModifierModalOpen(true);
    }
  };

  const handleApplyModifiers = (itemId, newModifiers, newModifiersPrice) => {
    setOrderData((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              modifiers: newModifiers,
              modifiersPrice: newModifiersPrice,
            }
          : item,
      ),
    );
  };
  const buildDiscountPreviewInput = useCallback(() => {
    const orderType = mapDeliveryMethodToOrderType(shipping?.deliveryMethod);
    const shippingFee = getShippingFeeForDiscountPreview({
      deliveryMethod: shipping?.deliveryMethod,
      shippingFee: shipping?.shippingFee,
    });

    return buildOrderDiscountPreviewInput({
      restaurantId: previewRestaurantId,
      orderType,
      items: orderData,
      taxRate: ORDER_VAT_RATE,
      serviceRate: 0,
      shippingFee,
      couponCode,
      promotionIds: selectedPromotionIds,
    });
  }, [
    orderData,
    previewRestaurantId,
    shipping?.deliveryMethod,
    shipping?.shippingFee,
    couponCode,
    selectedPromotionIds,
  ]);
  const handleApplyDiscountPreview = useCallback(async () => {
    setDiscountTouched(true);
    setDiscountError("");

    if (!orderData.length) {
      setDiscountBreakdown(null);
      setDiscountError("Giỏ hàng đang trống.");
      return;
    }

    if (!canPreviewDiscount || !previewRestaurantId) {
      setDiscountBreakdown(null);
      setDiscountError(
        "Coupon hiện chỉ hỗ trợ áp dụng cho đơn thuộc một nhà hàng. Vui lòng tách đơn hoặc bỏ coupon.",
      );
      return;
    }

    try {
      const breakdown = await previewOrderDiscount(buildDiscountPreviewInput());
      setDiscountBreakdown(breakdown);
    } catch (error) {
      setDiscountBreakdown(null);
      setDiscountError(getDiscountPreviewErrorMessage(error));
    }
  }, [
    orderData.length,
    previewOrderDiscount,
    buildDiscountPreviewInput,
    canPreviewDiscount,
    previewRestaurantId,
  ]);
  const hasCouponCode = couponCode.trim().length > 0;
  const hasUnappliedDiscount =
    hasCouponCode && discountTouched && !discountBreakdown;
  const shouldBlockCheckoutForDiscount =
    canPreviewDiscount &&
    hasCouponCode &&
    (!discountBreakdown || !!discountError);

  useEffect(() => {
    if (canPreviewDiscount) return;

    setCouponCode("");
    setSelectedPromotionIds([]);
    setDiscountBreakdown(null);
    setDiscountError("");
    setDiscountTouched(false);
  }, [canPreviewDiscount]);

  useEffect(() => {
    let cancelled = false;
    const fetchMenuMetadata = async () => {
      if (!isAuthenticated || !isCustomer || isLoadingFoodPreferences) return;
      if (!missingMetadataItems.length) return;

      const results = await Promise.all(
        missingMetadataItems.map(async ({ menuItemId, restaurantId: itemRestaurantId }) => {
          const key = `${itemRestaurantId || ""}:${menuItemId}`;
          const hasFetchedMetadata = Object.prototype.hasOwnProperty.call(
            menuItemMetadataByKey,
            key,
          );
          if (hasFetchedMetadata) return null;
          try {
            const { data } = await apolloClient.query({
              query: CUSTOMER_MENU_ITEM_FOR_CHECKOUT_FOR_YOU,
              variables: { id: menuItemId, restaurantId: itemRestaurantId || null },
              fetchPolicy: "cache-first",
            });
            return { key, metadata: data?.customerMenuItem || null };
          } catch (_error) {
            return { key, metadata: null };
          }
        }),
      );

      if (cancelled) return;
      const updates = {};
      for (const entry of results) {
        if (!entry) continue;
        updates[entry.key] = entry.metadata;
      }
      if (Object.keys(updates).length) {
        setMenuItemMetadataByKey((prev) => ({ ...prev, ...updates }));
      }
    };
    fetchMenuMetadata();
    return () => {
      cancelled = true;
    };
  }, [
    apolloClient,
    isAuthenticated,
    isCustomer,
    isLoadingFoodPreferences,
    missingMetadataItems,
    menuItemMetadataByKey,
  ]);

  const foodPreferenceReviewItems = useMemo(() => {
    if (!isAuthenticated || !isCustomer || isLoadingFoodPreferences) return [];
    return (orderData || [])
      .map((item) => {
        const metadata = menuItemMetadataByKey[getCheckoutItemMetadataKey(item)];
        const dishForAnalysis = {
          ...item,
          ...(metadata || {}),
          id: metadata?.id || getCheckoutItemMenuItemId(item),
          name: metadata?.name || item?.name,
          description: metadata?.description || item?.description,
          restaurantId: metadata?.restaurantId || item?.restaurantId,
        };
        const meta = analyzeMenuItemForFoodPreferences(
          dishForAnalysis,
          customerFoodPreferences,
        );
        return { item, dish: dishForAnalysis, meta };
      })
      .filter(
        (entry) =>
          entry.meta?.hasAllergyWarning ||
          entry.meta?.isRecommended ||
          entry.meta?.reasons?.length,
      );
  }, [
    customerFoodPreferences,
    isAuthenticated,
    isCustomer,
    isLoadingFoodPreferences,
    menuItemMetadataByKey,
    orderData,
  ]);

  const checkoutWarningAnalyticsKey = useMemo(() => (foodPreferenceReviewItems || [])
    .filter((entry) => entry?.meta?.hasAllergyWarning)
    .map((entry) => `${entry?.dish?.restaurantId || entry?.item?.restaurantId || ""}:${entry?.dish?.id || getCheckoutItemMenuItemId(entry?.item) || ""}`)
    .sort()
    .join("|"), [foodPreferenceReviewItems]);

  const recordedCheckoutWarningKeyRef = useRef("");
  useEffect(() => {
    if (!checkoutWarningAnalyticsKey || recordedCheckoutWarningKeyRef.current === checkoutWarningAnalyticsKey) return;
    recordedCheckoutWarningKeyRef.current = checkoutWarningAnalyticsKey;
    const firstWarning = (foodPreferenceReviewItems || []).find((entry) => entry?.meta?.hasAllergyWarning);
    recordForYouAnalyticsEvent(FOR_YOU_ANALYTICS_EVENTS.CHECKOUT_WARNING_SEEN, {
      userId: user?.id,
      itemId: firstWarning?.dish?.id || getCheckoutItemMenuItemId(firstWarning?.item),
      restaurantId: firstWarning?.dish?.restaurantId || firstWarning?.item?.restaurantId,
      categoryId: firstWarning?.dish?.categoryId || firstWarning?.item?.categoryId,
      source: "checkout",
      reasonType: "allergy_warning",
    });
  }, [checkoutWarningAnalyticsKey, foodPreferenceReviewItems, user?.id]);
  const validateCartHoldBeforeCheckout = useCallback(() => {
    const expiredHoldItems = getExpiredHoldItems(orderData);
    if (expiredHoldItems.length) {
      return "Một số món đã hết thời gian giữ. Vui lòng kiểm tra lại giỏ hàng.";
    }

    for (const item of orderData || []) {
      const cartId = item.backendCartId || item.cartId;
      const cartItemId = item.backendCartItemId || item.cartItemId;
      const hasAnyCartRef = Boolean(cartId || cartItemId);

      if (hasAnyCartRef && (!cartId || !cartItemId)) {
        return "Một số món chưa được đồng bộ đúng với giỏ hàng. Vui lòng thêm lại món.";
      }
    }

    return null;
  }, [orderData]);
  const persistAllOrders = useCallback(
    async (paymentMethod) => {
      if (canPreviewDiscount && couponCode.trim() && !discountBreakdown) {
        throw new Error("Vui lòng áp dụng coupon hợp lệ trước khi đặt hàng.");
      }
      const cartHoldError = validateCartHoldBeforeCheckout();
      if (cartHoldError) {
        throw new Error(cartHoldError);
      }
      const checkoutItems = orderData.map((item) =>
        mapCartItemToOrderItemInput(item, { includeCartHoldRef: true }),
      );

      const input = {
        orderType: mapDeliveryMethodToOrderType(shipping?.deliveryMethod),
        items: checkoutItems,
        shipping,
        paymentMethod,
        pricing: buildDiscountPricingInput({
          taxRate: ORDER_VAT_RATE,
          serviceRate: 0,
          shippingFee: getShippingFeeForDiscountPreview({
            deliveryMethod: shipping?.deliveryMethod,
            shippingFee: shipping?.shippingFee,
          }),
          couponCode:
            canPreviewDiscount && discountBreakdown ? couponCode : "",
        }),
        promotionIds:
          canPreviewDiscount && discountBreakdown ? selectedPromotionIds : [],
        note: shipping?.note || undefined,
        idempotencyKey: `checkout-${orderInfo.id}`,
      };

      if (!isAuthenticated) {
        input.customer = {
          fullName: shipping?.fullName || undefined,
          phone: shipping?.phone || undefined,
          email: shipping?.email || undefined,
        };
      }
      const res = await createCheckoutOrders({ variables: { input } });
      const checkout = res?.data?.createCheckoutOrders?.checkout || null;
      const created = res?.data?.createCheckoutOrders?.orders || [];
      return {
        orderCode: checkout?.checkoutCode,
        orders: created,
        checkout,
      };
    },
    [
      canPreviewDiscount,
      couponCode,
      discountBreakdown,
      validateCartHoldBeforeCheckout,
      orderData,
      shipping,
      selectedPromotionIds,
      orderInfo.id,
      isAuthenticated,
      createCheckoutOrders,
    ],
  );
  const payableTotal = getDiscountBreakdownTotal(
    discountBreakdown,
    calculateSubtotals().finalTotal,
  );
  const setAndShowSuccess = ({ orders: createdOrders = [], checkout, orderCode }) => {
    const totalPaidFromOrders = createdOrders.reduce(
      (s, o) => s + (o?.totals?.grandTotal || 0),
      0,
    );
    const checkoutCode = checkout?.checkoutCode || orderCode || "";
    const orderIds = checkout?.orderIds || createdOrders.map((o) => o?.id).filter(Boolean);
    const orderCodes = createdOrders.map((o) => o?.orderCode).filter(Boolean);
    const parentOrderCodes = createdOrders
      .map((o) => o?.parentOrderCode)
      .filter(Boolean);
    const resolvedTotalPaid = checkout?.grandTotal ?? totalPaidFromOrders;
    setReceipt({
      customerName: shipping.fullName,
      customerPhone: shipping.phone,
      address: shipping.address,
      deliveryMethod: shipping.deliveryMethod,
      deliveryTime: shipping.deliveryTime,
      scheduleDate: shipping.scheduleDate,
      scheduleTime: shipping.scheduleTime,
      note: shipping.note,
      paymentMethod: selectedPaymentMethod,
      totalPaid: resolvedTotalPaid,
      checkoutCode,
      orderIds,
      orderCodes,
      parentOrderCodes,
      orders: createdOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        parentOrderCode: o.parentOrderCode,
        restaurantId: o.restaurantId,
        grandTotal: o?.totals?.grandTotal || 0,
      })),
    });
    setIsSuccessOpen(true);
  };

  const handlePaymentMethodSelect = (method) =>
    setSelectedPaymentMethod(method);

  const handleConfirmPayment = async () => {
    setCheckoutError("");
    if (!orderData.length) {
      setCheckoutError("Giỏ hàng đang trống.");
      return;
    }
    if (!isShippingValid) {
      setShippingTouched(true);
      return;
    }
    if (!selectedPaymentMethod) {
      setCheckoutError("Vui lòng chọn phương thức thanh toán.");
      return;
    }

    if (selectedPaymentMethod === "cash") {
      try {
        setIsProcessingPayment(true);
        const checkoutResult = await persistAllOrders("cash");
        setIsProcessingPayment(false);
        setCurrentView("success");
        setAndShowSuccess(checkoutResult);
        onSuccess?.();
      } catch (err) {
        setIsProcessingPayment(false);
        setCheckoutError(
          err?.message ||
            "Không thể tạo đơn. Giỏ hàng của bạn vẫn được giữ, vui lòng thử lại.",
        );
      }
    } else if (selectedPaymentMethod === "transfer") {
      setCurrentView("qr");
    } else if (selectedPaymentMethod === "wallet") {
      try {
        setIsProcessingPayment(true);
        const checkoutResult = await persistAllOrders("wallet");
        setIsProcessingPayment(false);
        setCurrentView("success");
        setAndShowSuccess(checkoutResult);
        onSuccess?.();
      } catch (err) {
        setIsProcessingPayment(false);
        const message = String(err?.message || "");
        if (message.toLowerCase().includes("insufficient wallet balance")) {
          setCheckoutError(
            "Số dư ví không đủ. Vui lòng nạp thêm tiền trong trang hồ sơ.",
          );
          return;
        }
        setCheckoutError(
          message ||
            "Không thể tạo đơn. Giỏ hàng của bạn vẫn được giữ, vui lòng thử lại.",
        );
      }
    }
  };

  const handleQRPayment = async () => {
    setCheckoutError("");
    try {
      setIsProcessingPayment(true);
      const checkoutResult = await persistAllOrders("transfer");
      setIsProcessingPayment(false);
      setCurrentView("success");
      setAndShowSuccess(checkoutResult);
      onSuccess?.();
    } catch (err) {
      setIsProcessingPayment(false);
      setCheckoutError(
        err?.message ||
          "Không thể tạo đơn. Giỏ hàng của bạn vẫn được giữ, vui lòng thử lại.",
      );
    }
  };

  const resetToSummaryView = () => {
    setCurrentView("summary");
    setSelectedPaymentMethod(null);
    setIsProcessingPayment(false);
  };

  const renderContent = () => {
    const expiredHoldItems = getExpiredHoldItems(orderData);
    const earliestHoldExpiry = getEarliestHoldExpiry(orderData);

    switch (currentView) {
      case "success":
        return (
          <SuccessScreen
            receipt={receipt}
            isAuthenticated={isAuthenticated}
            onContinueBrowsing={onClose}
            onTrackOrder={() => {
              if (!isAuthenticated) return;
              const orders = receipt?.orders || [];
              if (orders.length === 1) {
                const firstOrder = orders[0];
                const normalizedOrderType = String(firstOrder?.orderType || "").toLowerCase();
                const isDeliveryOrder = ["delivery", "ship", "giao_hang"].includes(normalizedOrderType);
                if (isDeliveryOrder && firstOrder?.id && firstOrder?.restaurantId) {
                  const params = new URLSearchParams();
                  params.set(
                    "restaurantId",
                    String(firstOrder.restaurantId),
                  );
                  if (firstOrder?.orderCode) {
                    params.set(
                      "orderCode",
                      String(firstOrder.orderCode),
                    );
                  }
                  navigate(`/track-delivery/${firstOrder.id}?${params.toString()}`);
                  return;
                }
                navigate("/orders");
                return;
              }
              navigate("/orders");
            }}
          />
        );
      case "qr":
        return (
          <QRPaymentScreen
            amount={payableTotal}
            onConfirm={handleQRPayment}
            isProcessing={isProcessingPayment}
          />
        );
      default:
        return (
          <SummaryContent
            orderInfo={orderInfo}
            canPreviewDiscount={canPreviewDiscount}
            orderData={orderData}
            groupedByRestaurant={groupedByRestaurant}
            subtotals={calculateSubtotals()}
            shipping={shipping}
            shippingErrors={shippingErrors}
            onShippingChange={handleShippingChange}
            foodPreferenceNote={foodPreferenceNote}
            hasMeaningfulFoodPreferenceNote={hasMeaningfulFoodPreferenceNote}
            isFoodPreferenceNoteApplied={isFoodPreferenceNoteApplied}
            onApplyFoodPreferenceNote={applyFoodPreferenceNote}
            selectedPaymentMethod={selectedPaymentMethod}
            onAddModifier={handleAddModifier}
            onPaymentMethodSelect={handlePaymentMethodSelect}
            restaurantCount={restaurantCount}
            calcGroupTotals={calcGroupTotals}
            walletBalance={walletBalance}
            isAuthenticated={isAuthenticated}
            couponCode={couponCode}
            onCouponCodeChange={setCouponCode}
            discountBreakdown={discountBreakdown}
            discountError={discountError}
            isPreviewingDiscount={isPreviewingDiscount}
            onApplyDiscountPreview={handleApplyDiscountPreview}
            hasUnappliedDiscount={hasUnappliedDiscount}
            payableTotal={payableTotal}
            expiredHoldItems={expiredHoldItems}
            earliestHoldExpiry={earliestHoldExpiry}
            foodPreferenceReviewItems={foodPreferenceReviewItems}
          />
        );
    }
  };

  const renderFooter = () => {
    const hasExpiredHolds = getExpiredHoldItems(orderData).length > 0;

    switch (currentView) {
      case "success":
        return null;
      case "qr":
        return (
          <Modal.Footer>
            <button className="btn btn--secondary" onClick={resetToSummaryView}>
              Quay lại
            </button>
            <button
              className="btn btn--success"
              onClick={handleQRPayment}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <span className="loading-spinner" /> Đang xử lý...
                </>
              ) : (
                "Tôi đã thanh toán"
              )}
            </button>
          </Modal.Footer>
        );
      default:
        return (
          <Modal.Footer>
            <button className="btn btn--secondary" onClick={onClose}>
              Đóng
            </button>
            <button className="btn btn--primary" onClick={onClose}>
              Quay lại giỏ hàng
            </button>
            <button
              className="btn btn--success"
              onClick={handleConfirmPayment}
              disabled={
                !isShippingValid ||
                !selectedPaymentMethod ||
                isProcessingPayment ||
                shouldBlockCheckoutForDiscount ||
                isPreviewingDiscount ||
                hasExpiredHolds
              }
              title={
                !isShippingValid
                  ? "Vui lòng nhập đầy đủ thông tin giao hàng"
                  : !selectedPaymentMethod
                    ? "Chọn phương thức thanh toán"
                    : shouldBlockCheckoutForDiscount
                      ? "Vui lòng áp dụng coupon hợp lệ trước khi đặt hàng"
                      : hasExpiredHolds
                        ? "Một số món đã hết thời gian giữ. Vui lòng quay lại giỏ hàng."
                      : undefined
              }
            >
              {isProcessingPayment ? "Đang tạo đơn..." : "Xác nhận đặt hàng"}
            </button>
          </Modal.Footer>
        );
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="modal-title-with-icon">
            <Receipt size={24} /> Xác nhận đơn hàng
          </div>
        }
        size="lg"
        className="order-summary-modal"
      >
        <div className="order-summary-wrapper">
          {!!checkoutError && (
            <div className="order-summary-error" role="alert">
              {checkoutError}
            </div>
          )}
          <div className="order-summary-content">{renderContent()}</div>
          {renderFooter()}
        </div>
      </Modal>

      <ModifierModal
        isOpen={isModifierModalOpen}
        onClose={() => setIsModifierModalOpen(false)}
        item={currentEditingItem}
        onApply={handleApplyModifiers}
        restaurantId={currentEditingItem?.restaurantId ?? restaurantId}
      />

      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={handleCloseAll}
        kind="order"
        orderReceipt={receipt}
      />
    </>
  );
};

export default OrderSummaryModal;

/* ===================== Sub-components ===================== */

const SummaryContent = ({
  orderInfo,
  orderData,
  canPreviewDiscount,
  groupedByRestaurant,
  subtotals,
  shipping,
  shippingErrors,
  onShippingChange,
  foodPreferenceNote,
  hasMeaningfulFoodPreferenceNote,
  isFoodPreferenceNoteApplied,
  onApplyFoodPreferenceNote,
  selectedPaymentMethod,
  onAddModifier,
  onPaymentMethodSelect,
  restaurantCount,
  calcGroupTotals,
  walletBalance,
  couponCode,
  onCouponCodeChange,
  discountBreakdown,
  discountError,
  isPreviewingDiscount,
  onApplyDiscountPreview,
  hasUnappliedDiscount,
  payableTotal,
  expiredHoldItems,
  earliestHoldExpiry,
  foodPreferenceReviewItems,
}) => (
  <>
    {!!earliestHoldExpiry && (
      <div className="section section-highlight">
        Món đang được giữ tạm thời đến {earliestHoldExpiry.toLocaleString("vi-VN")}
      </div>
    )}
    {!!expiredHoldItems?.length && (
      <div className="order-summary-error" role="alert">
        Một số món đã hết thời gian giữ. Vui lòng kiểm tra lại giỏ hàng.
      </div>
    )}
    <RestaurantInfo
      orderInfo={orderInfo}
      orderData={orderData}
      restaurantCount={restaurantCount}
    />
    <ShippingForm
      value={shipping}
      errors={shippingErrors}
      onChange={onShippingChange}
      foodPreferenceNote={foodPreferenceNote}
      hasMeaningfulFoodPreferenceNote={hasMeaningfulFoodPreferenceNote}
      isFoodPreferenceNoteApplied={isFoodPreferenceNoteApplied}
      onApplyFoodPreferenceNote={onApplyFoodPreferenceNote}
    />
    <CheckoutForYouReview foodPreferenceReviewItems={foodPreferenceReviewItems} />
    <OrderItems
      groupedByRestaurant={groupedByRestaurant}
      onAddModifier={onAddModifier}
      calcGroupTotals={calcGroupTotals}
      foodPreferenceReviewItems={foodPreferenceReviewItems}
    />
    <DiscountSection
      couponCode={couponCode}
      onCouponCodeChange={onCouponCodeChange}
      discountBreakdown={discountBreakdown}
      discountError={discountError}
      isPreviewingDiscount={isPreviewingDiscount}
      onApplyDiscountPreview={onApplyDiscountPreview}
      hasUnappliedDiscount={hasUnappliedDiscount}
      canPreviewDiscount={canPreviewDiscount}
    />

    <PriceBreakdown
      subtotals={subtotals}
      discountBreakdown={discountBreakdown}
    />
    <PaymentMethods
      selectedMethod={selectedPaymentMethod}
      onSelect={onPaymentMethodSelect}
      walletBalance={walletBalance}
      amount={payableTotal}
    />
  </>
);

const RestaurantInfo = ({ orderInfo, orderData, restaurantCount }) => {
  const rid = orderData[0]?.restaurantId;
  const nameFromHook = useRestaurantName(rid);
  const singleName = nameFromHook || "Nhà hàng";

  if (restaurantCount <= 1) {
    return (
      <div className="section section-highlight">
        <div className="restaurant-info">
          <h3 className="restaurant-name">
            <Store size={20} /> {singleName}
          </h3>
          <p className="restaurant-address">
            <MapPin size={16} /> Địa chỉ nhà hàng đang cập nhật
          </p>
          <div className="order-info-boxes">
            <div className="info-box">
              <span className="label">Mã đơn tạm</span>
              <span className="value">#{orderInfo.id}</span>
            </div>
            <div className="info-box">
              <span className="label">Thời gian</span>
              <span className="value">{orderInfo.time}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section section-highlight">
      <div className="restaurant-info">
        <h3 className="restaurant-name">
          <Store size={20} /> Đơn hàng nhiều nhà hàng
        </h3>
        <p className="restaurant-address">
          <MapPin size={16} /> Hệ thống sẽ điều phối phù hợp theo từng nhà hàng.
        </p>
        <div className="order-info-boxes">
          <div className="info-box">
            <span className="label">Mã giao dịch</span>
            <span className="value">#{orderInfo.id}</span>
          </div>
          <div className="info-box">
            <span className="label">Thời gian</span>
            <span className="value">{orderInfo.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShippingForm = ({
  value,
  errors = {},
  onChange,
  foodPreferenceNote,
  hasMeaningfulFoodPreferenceNote,
  isFoodPreferenceNoteApplied,
  onApplyFoodPreferenceNote,
}) => {
  const {
    fullName,
    phone,
    email,
    address,
    note,
    deliveryMethod,
    deliveryTime,
    scheduleDate,
    scheduleTime,
  } = value || {};

  return (
    <div className="section">
      <h3 className="section-title">
        <Truck size={20} /> Thông tin giao hàng
      </h3>

      <div className="form-grid">
        <div className="form-col">
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Họ và tên</label>
              <input
                className={`form-input ${errors.fullName ? "is-invalid" : ""}`}
                type="text"
                placeholder="VD: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => onChange("fullName", e.target.value)}
              />
              {errors.fullName && (
                <div className="form-error">{errors.fullName}</div>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">Số điện thoại</label>
              <input
                className={`form-input ${errors.contact ? "is-invalid" : ""}`}
                type="tel"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => onChange("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              className={`form-input ${errors.contact ? "is-invalid" : ""}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => onChange("email", e.target.value)}
            />
            {errors.contact && (
              <div className="form-error">{errors.contact}</div>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Địa chỉ nhận hàng</label>
            <input
              className={`form-input ${errors.address ? "is-invalid" : ""}`}
              type="text"
              placeholder="Số nhà, đường, phường/xã, quận/huyện..."
              value={address}
              onChange={(e) => onChange("address", e.target.value)}
              disabled={deliveryMethod !== "delivery"}
            />
            {errors.address && (
              <div className="form-error">{errors.address}</div>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Ghi chú cho tài xế/quán</label>
            <textarea
              className="form-textarea"
              placeholder="Ví dụ: ít cay, gọi khi tới nơi..."
              rows={2}
              value={note}
              onChange={(e) => onChange("note", e.target.value)}
            />
            {hasMeaningfulFoodPreferenceNote && (
              <div className="food-preference-note-suggestion">
                <div className="food-preference-note-suggestion__text">
                  Gợi ý dựa trên khẩu vị của bạn: {foodPreferenceNote}
                </div>
                <div className="food-preference-note-suggestion__actions">
                  {isFoodPreferenceNoteApplied ? (
                    <span className="food-preference-note-suggestion__applied">
                      Đã áp dụng ghi chú khẩu vị
                    </span>
                  ) : (
                    <button type="button" onClick={onApplyFoodPreferenceNote}>
                      Dùng ghi chú này
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-col">
          <div className="form-field">
            <label className="form-label">Phương thức nhận</label>
            <div className="segmented">
              <button
                type="button"
                className={`segmented__option ${deliveryMethod === "delivery" ? "is-active" : ""}`}
                onClick={() => onChange("deliveryMethod", "delivery")}
              >
                <Truck size={16} /> Giao tận nơi
              </button>
              <button
                type="button"
                className={`segmented__option ${deliveryMethod === "pickup" ? "is-active" : ""}`}
                onClick={() => onChange("deliveryMethod", "pickup")}
              >
                <ShoppingBag size={16} /> Tự đến lấy
              </button>
              <button
                type="button"
                className={`segmented__option ${deliveryMethod === "dinein" ? "is-active" : ""}`}
                onClick={() => onChange("deliveryMethod", "dinein")}
              >
                <Utensils size={16} /> Dùng tại chỗ
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Thời gian nhận</label>
            <div className="segmented">
              <button
                type="button"
                className={`segmented__option ${deliveryTime === "asap" ? "is-active" : ""}`}
                onClick={() => onChange("deliveryTime", "asap")}
              >
                <Clock size={16} /> Ngay khi có thể
              </button>
              <button
                type="button"
                className={`segmented__option ${deliveryTime === "schedule" ? "is-active" : ""}`}
                onClick={() => onChange("deliveryTime", "schedule")}
              >
                <CalendarDays size={16} /> Hẹn giờ
              </button>
            </div>
          </div>

          {deliveryTime === "schedule" && (
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Ngày</label>
                <input
                  className={`form-input ${errors.schedule ? "is-invalid" : ""}`}
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => onChange("scheduleDate", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Giờ</label>
                <input
                  className={`form-input ${errors.schedule ? "is-invalid" : ""}`}
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => onChange("scheduleTime", e.target.value)}
                />
              </div>
              {errors.schedule && (
                <div className="form-error">{errors.schedule}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OrderItems = ({
  groupedByRestaurant,
  onAddModifier,
  calcGroupTotals,
  foodPreferenceReviewItems,
}) => {
  const foodPreferenceMetaByOrderItemId = useMemo(() => {
    const map = {};
    for (const entry of foodPreferenceReviewItems || []) {
      if (entry?.item?.id) map[entry.item.id] = entry.meta;
    }
    return map;
  }, [foodPreferenceReviewItems]);
  if (!groupedByRestaurant || groupedByRestaurant.size === 0) {
    return (
      <div className="section">
        <h3 className="section-title">
          <Receipt size={20} /> Chi tiết đơn hàng
        </h3>
        <p className="empty-text">Chưa có món nào trong giỏ hàng.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h3 className="section-title">
        <Receipt size={20} /> Chi tiết đơn hàng
      </h3>
      {Array.from(groupedByRestaurant.entries()).map(([rid, items]) => (
        <RestaurantGroup
          key={rid}
          restaurantId={rid}
          items={items}
          onAddModifier={onAddModifier}
          calcGroupTotals={calcGroupTotals}
          foodPreferenceMetaByOrderItemId={foodPreferenceMetaByOrderItemId}
        />
      ))}
    </div>
  );
};
const DiscountSection = ({
  couponCode,
  onCouponCodeChange,
  discountBreakdown,
  discountError,
  isPreviewingDiscount,
  onApplyDiscountPreview,
  hasUnappliedDiscount,
  canPreviewDiscount,
}) => (
  <div className="section discount-section">
    <h3 className="section-title">
      <Receipt size={20} /> Ưu đãi & coupon
    </h3>

    <div className="coupon-row">
      <input
        className="form-input"
        type="text"
        placeholder={
          canPreviewDiscount
            ? "Nhập mã coupon"
            : "Coupon chưa hỗ trợ cho đơn nhiều nhà hàng"
        }
        value={couponCode}
        onChange={(event) => onCouponCodeChange(event.target.value)}
        disabled={!canPreviewDiscount}
      />
      <button
        type="button"
        className="btn btn--secondary"
        onClick={onApplyDiscountPreview}
        disabled={
          isPreviewingDiscount || !couponCode.trim() || !canPreviewDiscount
        }
      >
        {isPreviewingDiscount ? "Đang kiểm tra..." : "Áp dụng"}
      </button>
      {!canPreviewDiscount && (
        <div className="discount-message discount-message--warning">
          <AlertCircle size={16} /> Coupon hiện chỉ áp dụng cho đơn thuộc một
          nhà hàng.
        </div>
      )}
    </div>

    {discountError && (
      <div className="discount-message discount-message--error">
        <AlertCircle size={16} /> {discountError}
      </div>
    )}

    {hasUnappliedDiscount && !discountError && (
      <div className="discount-message discount-message--warning">
        <AlertCircle size={16} /> Coupon đã thay đổi. Vui lòng áp dụng lại
        trước khi đặt hàng.
      </div>
    )}

    {discountBreakdown?.voucherCode && (
      <div className="discount-message discount-message--success">
        <CheckCircle size={16} /> Đã áp dụng coupon{" "}
        <strong>{discountBreakdown.voucherCode}</strong>
      </div>
    )}
  </div>
);
const RestaurantGroup = ({
  restaurantId,
  items,
  onAddModifier,
  calcGroupTotals,
  foodPreferenceMetaByOrderItemId = {},
}) => {
  const rName = useRestaurantName(restaurantId) || `Nhà hàng ${restaurantId}`;
  const groupTotals = calcGroupTotals(items);

  return (
    <div className="restaurant-group-card">
      <div className="restaurant-group-header">
        <Store size={18} />
        <h4>{rName}</h4>
      </div>

      <div className="order-items-list">
        {items.map((item) => (
          <OrderItem
            key={item.id}
            item={item}
            onAddModifier={onAddModifier}
            foodPreferenceMeta={foodPreferenceMetaByOrderItemId[item.id]}
          />
        ))}
      </div>

      <div className="price-breakdown group-breakdown">
        <div className="price-row">
          <span className="price-label">Tổng món ăn ({rName})</span>
          <span className="price-value">
            {formatCurrency(groupTotals.subtotal)}
          </span>
        </div>
        <div className="price-row">
          <span className="price-label">Phí tùy chọn thêm</span>
          <span className="price-value">
            {formatCurrency(groupTotals.modifiersTotal)}
          </span>
        </div>
        <div className="price-row">
          <span className="price-label">VAT (10%)</span>
          <span className="price-value">{formatCurrency(groupTotals.tax)}</span>
        </div>
        <div className="price-row total">
          <span className="price-label">Tạm tính {rName}</span>
          <span className="price-value">
            {formatCurrency(groupTotals.finalTotal)}
          </span>
        </div>
      </div>
    </div>
  );
};

const OrderItem = ({ item, onAddModifier, foodPreferenceMeta }) => {
  const itemTotal = (item.price + (item.modifiersPrice || 0)) * item.quantity;
  const unitPrice = item.price + (item.modifiersPrice || 0);

  return (
    <div className="order-item">
      <div className="item-image">
        {typeof item.image === "string" ? (
          <img src={item.image} alt={item.name} />
        ) : (
          item.image || (
            <div className="img-placeholder">
              <Utensils size={24} />
            </div>
          )
        )}
      </div>

      <div className="item-details">
        <div className="item-header">
          <h4 className="item-name">
            {item.name}
            {item.cookingMethod && (
              <span className="cooking-method"> • {item.cookingMethod}</span>
            )}
          </h4>
          <span className="item-total-price">{formatCurrency(itemTotal)}</span>
        </div>

        {item.description && (
          <p className="item-description">{item.description}</p>
        )}

        <div className="item-meta">
          <span className="item-quantity">
            {formatQuantity(item.quantity, item.unit)}
          </span>
          <span className="item-unit-price">x {formatCurrency(unitPrice)}</span>
        </div>
        {foodPreferenceMeta && (
          <div className="order-item-for-you-badges">
            {foodPreferenceMeta.hasAllergyWarning ? (
              <span className="order-item-for-you-badge order-item-for-you-badge--warning">
                ⚠ Cần kiểm tra dị ứng
              </span>
            ) : foodPreferenceMeta.isRecommended ? (
              <span className="order-item-for-you-badge order-item-for-you-badge--match">
                ✨ Món phù hợp với bạn
              </span>
            ) : (
              <span className="order-item-for-you-badge order-item-for-you-badge--note">
                Món phổ biến để tham khảo
              </span>
            )}
          </div>
        )}

        {item.modifiers && item.modifiers.length > 0 && (
          <div className="item-modifiers">
            {item.modifiers.map((modifier, index) => (
              <span key={index} className="modifier-tag">
                {modifier.optionName}
                {modifier.price > 0 && ` (+${formatCurrency(modifier.price)})`}
              </span>
            ))}
          </div>
        )}

        <div className="item-actions">
          <button
            className="add-modifier-btn"
            onClick={() => onAddModifier(item.id)}
          >
            <PlusCircle size={14} /> Thêm ghi chú / tùy chọn
          </button>
        </div>
      </div>
    </div>
  );
};

const PriceBreakdown = ({ subtotals, discountBreakdown }) => {
  const hasBackendBreakdown = Boolean(discountBreakdown);

  if (hasBackendBreakdown) {
    return (
      <div className="section">
        <h3 className="section-title">
          <CreditCard size={20} /> Tổng thanh toán
        </h3>

        <div className="price-breakdown">
          <div className="price-row">
            <span className="price-label">Tạm tính</span>
            <span className="price-value">
              {formatCurrency(discountBreakdown.subtotal)}
            </span>
          </div>

          {discountBreakdown.promotionDiscount > 0 && (
            <div className="price-row discount">
              <span className="price-label">Giảm khuyến mãi</span>
              <span className="price-value">
                -{formatCurrency(discountBreakdown.promotionDiscount)}
              </span>
            </div>
          )}

          {discountBreakdown.voucherDiscount > 0 && (
            <div className="price-row discount">
              <span className="price-label">Giảm coupon</span>
              <span className="price-value">
                -{formatCurrency(discountBreakdown.voucherDiscount)}
              </span>
            </div>
          )}

          {discountBreakdown.totalDiscount > 0 && (
            <div className="price-row discount-total">
              <span className="price-label">Tổng giảm</span>
              <span className="price-value">
                -{formatCurrency(discountBreakdown.totalDiscount)}
              </span>
            </div>
          )}

          {discountBreakdown.service > 0 && (
            <div className="price-row">
              <span className="price-label">Phí dịch vụ</span>
              <span className="price-value">
                {formatCurrency(discountBreakdown.service)}
              </span>
            </div>
          )}

          {discountBreakdown.tax > 0 && (
            <div className="price-row">
              <span className="price-label">VAT</span>
              <span className="price-value">
                {formatCurrency(discountBreakdown.tax)}
              </span>
            </div>
          )}

          {discountBreakdown.shippingFee > 0 && (
            <div className="price-row">
              <span className="price-label">Phí giao hàng</span>
              <span className="price-value">
                {formatCurrency(discountBreakdown.shippingFee)}
              </span>
            </div>
          )}

          <div className="price-row total">
            <span className="price-label">Thành tiền</span>
            <span className="price-value">
              {formatCurrency(
                discountBreakdown.grandTotal || discountBreakdown.finalTotal,
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h3 className="section-title">
        <CreditCard size={20} /> Tổng thanh toán
      </h3>

      <div className="price-breakdown">
        <div className="price-row">
          <span className="price-label">Tạm tính món ăn</span>
          <span className="price-value">
            {formatCurrency(subtotals.subtotal)}
          </span>
        </div>

        {subtotals.modifiersTotal > 0 && (
          <div className="price-row">
            <span className="price-label">Phí tùy chọn thêm</span>
            <span className="price-value">
              {formatCurrency(subtotals.modifiersTotal)}
            </span>
          </div>
        )}

        <div className="price-row">
          <span className="price-label">VAT (10%)</span>
          <span className="price-value">{formatCurrency(subtotals.tax)}</span>
        </div>

        <div className="price-row total">
          <span className="price-label">Thành tiền tạm tính</span>
          <span className="price-value">
            {formatCurrency(subtotals.finalTotal)}
          </span>
        </div>
      </div>
    </div>
  );
};

const PaymentMethods = ({
  selectedMethod,
  onSelect,
  walletBalance,
  amount,
  isAuthenticated,
}) => (
  <div className="section">
    <h3 className="section-title">
      <CreditCard size={20} /> Phương thức thanh toán
    </h3>
    <div className="payment-methods-grid">
      <div
        className={`payment-method-card ${selectedMethod === "cash" ? "selected" : ""}`}
        onClick={() => onSelect("cash")}
      >
        <div className="payment-icon">
          <Banknote size={28} />
        </div>
        <div className="payment-info">
          <h4 className="payment-name">Tiền mặt</h4>
          <p className="payment-desc">Thanh toán khi nhận hàng</p>
        </div>
        <div className="check-circle">
          <CheckCircle size={20} />
        </div>
      </div>

      <div
        className={`payment-method-card ${selectedMethod === "transfer" ? "selected" : ""}`}
        onClick={() => onSelect("transfer")}
      >
        <div className="payment-icon">
          <QrCode size={28} />
        </div>
        <div className="payment-info">
          <h4 className="payment-name">Chuyển khoản / QR</h4>
          <p className="payment-desc">Quét mã QR qua ứng dụng ngân hàng</p>
        </div>
        <div className="check-circle">
          <CheckCircle size={20} />
        </div>
      </div>

      <div
        className={`payment-method-card ${selectedMethod === "wallet" ? "selected" : ""} ${!isAuthenticated ? "disabled" : ""}`}
        onClick={() => {
          if (!isAuthenticated) return;
          onSelect("wallet");
        }}
        role="button"
        aria-disabled={!isAuthenticated}
      >
        <div className="payment-icon">
          <Wallet size={28} />
        </div>
        <div className="payment-info">
          <h4 className="payment-name">Ví nội bộ</h4>
          <p className="payment-desc">
            Số dư {formatCurrency(walletBalance)} ·{" "}
            {!isAuthenticated ? "Đăng nhập để dùng ví nội bộ" : walletBalance >= amount ? "Đủ thanh toán" : "Không đủ số dư"}
          </p>
        </div>
        <div className="check-circle">
          <CheckCircle size={20} />
        </div>
      </div>
    </div>
  </div>
);

const CheckoutForYouReview = ({ foodPreferenceReviewItems = [] }) => {
  if (!foodPreferenceReviewItems.length) return null;
  const sorted = [...foodPreferenceReviewItems].sort(
    (a, b) => Number(b?.meta?.hasAllergyWarning) - Number(a?.meta?.hasAllergyWarning),
  );
  const topItems = sorted.slice(0, 5);
  const moreCount = sorted.length - topItems.length;
  const hasAllergyWarning = sorted.some((entry) => entry?.meta?.hasAllergyWarning);
  const title = hasAllergyWarning ? "⚠ Cần kiểm tra dị ứng" : "✨ Món phù hợp với bạn";
  const description = hasAllergyWarning
    ? "Một số món cần kiểm tra dị ứng. Hãy kiểm tra thành phần trước khi đặt."
    : "Gợi ý dựa trên khẩu vị của bạn.";

  return (
    <div
      className={`section checkout-for-you-review ${hasAllergyWarning ? "checkout-for-you-review--warning" : "checkout-for-you-review--match"}`}
    >
      <h3 className="checkout-for-you-review__title">{title}</h3>
      <p>{description}</p>
      <ul className="checkout-for-you-review__list">
        {topItems.map((entry) => (
          <li className="checkout-for-you-review__item" key={entry.item?.id}>
            <span className="checkout-for-you-review__item-name">{entry.dish?.name || entry.item?.name}</span>
            <span className="checkout-for-you-review__reason">
              {entry.meta?.warningReason || entry.meta?.reasons?.[0] || "Món này có thể chưa phù hợp hoàn toàn với khẩu vị của bạn."}
            </span>
          </li>
        ))}
      </ul>
      {moreCount > 0 && (
        <div className="checkout-for-you-review__more">và {moreCount} món khác</div>
      )}
    </div>
  );
};

const SuccessScreen = ({
  receipt,
  isAuthenticated,
  onContinueBrowsing,
  onTrackOrder,
}) => {
  const orderCodes = receipt?.orderCodes || [];
  const displayCode = receipt?.checkoutCode || orderCodes[0] || "";
  const firstOrder = receipt?.orders?.[0];
  const orderCount = receipt?.orders?.length || 0;
  const hasMultipleOrders = orderCount > 1;
  const canTrackSingleOrder = Boolean(
    isAuthenticated &&
      orderCount === 1 &&
      firstOrder?.id &&
      firstOrder?.restaurantId,
  );
  const canViewOrders = Boolean(isAuthenticated && orderCount > 1);
  const canTrackOrder = canTrackSingleOrder || canViewOrders;

  return (
    <div className="section text-center">
      <div className="success-screen">
        <div className="success-icon-large">
          <CheckCircle size={64} />
        </div>
        <h3 className="success-title">Đặt đơn thành công</h3>

        {displayCode ? (
          <p className="success-message">Mã đơn: {displayCode}</p>
        ) : (
          <p className="success-message">Đơn hàng của bạn đã được tạo.</p>
        )}

        {hasMultipleOrders && (
          <div className="mt-2">
            <p className="success-message">Đã tạo {orderCount} đơn hàng.</p>
            {!!orderCodes.length && (
              <ul>
                {orderCodes.slice(0, 5).map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {Number(receipt?.totalPaid) > 0 && (
          <p className="success-message mt-2">
            Tổng tiền đã đặt: {formatCurrency(receipt.totalPaid)}
          </p>
        )}

        <div className="mt-4 d-flex gap-2 justify-content-center">
          {canTrackOrder && (
            <button className="btn btn--secondary" onClick={onTrackOrder}>
              Theo dõi đơn hàng
            </button>
          )}
          <button className="btn btn--primary" onClick={onContinueBrowsing}>
            Tiếp tục xem món
          </button>
        </div>
      </div>
    </div>
  );
};

const QRPaymentScreen = ({ amount }) => (
  <div className="section text-center">
    <div className="qr-payment-screen">
      <h3 className="qr-title">Quét mã QR để thanh toán</h3>
      <p className="qr-subtitle">
        Sử dụng ứng dụng ngân hàng hoặc ví điện tử để quét mã
      </p>

      <div className="qr-code-box">
        <QrCode size={120} strokeWidth={1} />
      </div>

      <div className="qr-amount-box">
        <span className="label">Số tiền cần thanh toán</span>
        <span className="amount">{formatCurrency(amount)}</span>
      </div>

      <div className="qr-instructions">
        <h4>
          <AlertCircle size={16} /> Hướng dẫn thanh toán:
        </h4>
        <ol>
          <li>Mở ứng dụng ngân hàng trên điện thoại</li>
          <li>
            Chọn tính năng <strong>Quét mã QR</strong>
          </li>
          <li>Hướng camera vào mã QR phía trên</li>
          <li>
            Kiểm tra số tiền và <strong>Xác nhận</strong>
          </li>
        </ol>
      </div>
    </div>
  </div>
);
