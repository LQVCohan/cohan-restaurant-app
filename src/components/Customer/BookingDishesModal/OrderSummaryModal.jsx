import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useContext,
} from "react";
import Modal from "../../common/Modal";
import ModifierModal from "./ModifierModal";
import { formatCurrency, formatQuantity } from "../../../utils/formatters";
import "./OrderSummaryModal.scss";
import { gql } from "@apollo/client";
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
        totals {
          grandTotal
        }
        currentStatus
      }
    }
  }
`;

function useRestaurantName(restaurantId) {
  const skip = !restaurantId;
  const { data } = useQuery(RESTAURANT_BY_ID, {
    variables: { id: restaurantId },
    skip,
  });
  return data?.restaurant?.name;
}

const CHECKOUT_CART_SYNC_ERROR =
  "Một số món chưa được đồng bộ đúng với giỏ hàng. Vui lòng thêm lại món.";
const CHECKOUT_CART_HOLD_EXPIRED_ERROR =
  "Một số món trong giỏ đã hết thời gian giữ. Vui lòng cập nhật lại giỏ.";

function getCheckoutCartHoldError(items = []) {
  const now = Date.now();

  for (const item of items || []) {
    const hasBackendRef = !!(item.backendCartId || item.backendCartItemId);
    const hasCartRef = !!(item.cartId || item.cartItemId);

    if (hasBackendRef && (!item.backendCartId || !item.backendCartItemId)) {
      return CHECKOUT_CART_SYNC_ERROR;
    }
    if (hasCartRef && (!item.cartId || !item.cartItemId)) {
      return CHECKOUT_CART_SYNC_ERROR;
    }

    if (item.holdExpiresAt) {
      const holdExpiresAt = new Date(item.holdExpiresAt).getTime();
      if (Number.isNaN(holdExpiresAt) || holdExpiresAt <= now) {
        return CHECKOUT_CART_HOLD_EXPIRED_ERROR;
      }
    }
  }

  return "";
}

const OrderSummaryModal = ({
  isOpen,
  onClose,
  items = [],
  restaurantId,
  onSuccess,
}) => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const walletBalance = Number(user?.wallet?.balance || 0);

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
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const [receipt, setReceipt] = useState(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [selectedPromotionIds, setSelectedPromotionIds] = useState([]);
  const [discountBreakdown, setDiscountBreakdown] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountTouched, setDiscountTouched] = useState(false);

  const { previewOrderDiscount, loading: isPreviewingDiscount } =
    useDiscountPreview();
  const handleCloseAll = () => {
    setIsSuccessOpen(false);
    onClose?.();
  };

  const mappedOrderData = useMemo(
    () =>
      (items || []).map((it) => ({
        id: it.id,
        cartId: it.cartId || it.backendCartId || null,
        cartItemId: it.cartItemId || it.backendCartItemId || null,
        backendCartId: it.backendCartId || it.cartId || null,
        backendCartItemId: it.backendCartItemId || it.cartItemId || null,
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
        holdStatus: it.holdStatus || null,
        holdExpiresAt: it.holdExpiresAt || null,
        servingVariantKey:
          it.servingVariantKey || it.servingVariant?.key || null,
        variantKey:
          it.variantKey ||
          it.servingVariantKey ||
          it.servingVariant?.key ||
          null,
        servingKey:
          it.servingKey ||
          it.servingVariantKey ||
          it.variantKey ||
          it.servingVariant?.key ||
          it.selectedServingKey ||
          null,
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
      setVoucherCode("");
      setSelectedPromotionIds([]);
      setDiscountBreakdown(null);
      setDiscountError("");
      setDiscountTouched(false);
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
  }, []);

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
      ? /^[^\s@]+@[^
സ