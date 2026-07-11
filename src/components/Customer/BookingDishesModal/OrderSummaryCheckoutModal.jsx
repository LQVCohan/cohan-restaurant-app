import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { io } from "socket.io-client";
import Modal from "../../common/Modal";
import { AuthContext } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/formatters";
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "../../../utils/phoneNumber";
import { getToken } from "../../../lib/authStorage";
import { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";
import { getOrderLineDisplay } from "../../../utils/orderLineDisplay";
import {
  buildDiscountPricingInput,
  getShippingFeeForDiscountPreview,
  mapCartItemToOrderItemInput,
  mapDeliveryMethodToOrderType,
} from "../../../utils/discountPreviewPayload";
import {
  aggregateCustomerPromotionBreakdowns,
  buildCustomerPromotionPreviewInput,
} from "../../../utils/customerPromotionPreviewAggregation";
import { CUSTOMER_PROMOTION_PREVIEW } from "../../../hooks/useDiscountPreview";
import {
  buildCouponConditionText,
  buildRestaurantCartGroups,
  normalizeId,
} from "./utils/checkoutCouponPreview";
import "./OrderSummaryModal.scss";
import "./OrderSummaryTransferUpload.scss";
import "./OrderSummaryCheckoutUpgrade.scss";

const ORDER_VAT_RATE = 0.1;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PROOF_FILES = 3;
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

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
        currentStatus
        totals {
          grandTotal
        }
      }
    }
  }
`;

const CREATE_ORDER_PAYMENT = gql`
  mutation CreateCheckoutOrderPayment($input: CreateOrderPaymentInput!) {
    createOrderPayment(input: $input) {
      id
      provider
      paymentMethod
      amount
      currency
      status
      reference
      payUrl
      qrCodeUrl
      deeplink
      expiresAt
    }
  }
`;

const PAYMENT_PUBLIC_CONFIG = gql`
  query CheckoutPaymentPublicConfig($restaurantId: ID!) {
    restaurantPaymentPublicConfig(restaurantId: $restaurantId) {
      defaultProvider
      providers {
        provider
        label
        active
        priority
      }
    }
  }
`;

const CREATE_CUSTOMER_TRANSFER_PAYMENT = gql`
  mutation CreateCustomerTransferPayment(
    $input: CreateCustomerTransferPaymentInput!
  ) {
    createCustomerTransferPayment(input: $input) {
      id
      createdAt
      amount
      currency
      reference
      status
      callbackStatus
      metadata
      expiresAt
      transfer {
        status
        rejectReason
        rejectedCount
        maxRejectedCount
        lastRejectedReason
        proofImages
        proofNote
        submittedAt
        verifiedAt
        rejectedAt
        pausedAt
        resumedAt
        proofCycleStartedAt
      }
    }
  }
`;

const SUBMIT_TRANSFER_PROOF = gql`
  mutation SubmitTransferProof($input: SubmitTransferProofInput!) {
    submitTransferProof(input: $input) {
      id
      createdAt
      status
      callbackStatus
      expiresAt
      metadata
      transfer {
        status
        rejectReason
        rejectedCount
        maxRejectedCount
        lastRejectedReason
        proofImages
        proofNote
        submittedAt
        verifiedAt
        rejectedAt
        pausedAt
        resumedAt
        proofCycleStartedAt
      }
    }
  }
`;

const SYNC_PAYMENT_STATUS = gql`
  mutation SyncPaymentStatus($paymentId: ID!) {
    syncPaymentStatus(paymentId: $paymentId) {
      id
      createdAt
      status
      callbackStatus
      expiresAt
      metadata
      transfer {
        status
        rejectReason
        rejectedCount
        maxRejectedCount
        lastRejectedReason
        proofImages
        proofNote
        submittedAt
        verifiedAt
        rejectedAt
        pausedAt
        resumedAt
        proofCycleStartedAt
      }
    }
  }
`;

const CHECKOUT_COUPONS = gql`
  query CheckoutCoupons($restaurantId: ID!) {
    coupons(restaurantId: $restaurantId, activeOnly: true, limit: 100) {
      id
      name
      code
      category
      description
      discountType
      discountValue
      minOrderValue
      maxDiscount
      maxUsage
      used
      startAt
      endAt
      isActive
      constraints
      restaurantId
    }
  }
`;

const MY_CHECKOUT_COUPONS = gql`
  query MyCheckoutCoupons($restaurantId: ID, $status: String) {
    myCoupons(restaurantId: $restaurantId, status: $status) {
      id
      coupon {
        id
        name
        code
        category
        description
        discountType
        discountValue
        minOrderValue
        maxDiscount
        maxUsage
        used
        startAt
        endAt
        isActive
        constraints
        restaurantId
      }
    }
  }
`;

const CHECKOUT_COUPON_ELIGIBILITIES = gql`
  query CheckoutCouponEligibilities($input: CheckoutCouponEligibilityInput!) {
    checkoutCouponEligibilities(input: $input) {
      couponCode
      eligible
      reasonCode
      reason
      subtotal
      eligibleSubtotal
      estimatedDiscount
    }
  }
`;

const MY_CHECKOUT_ADDRESSES = gql`
  query MyCheckoutAddresses {
    myAddresses {
      id
      label
      receiverName
      phone
      fullAddress
      note
      isDefault
    }
  }
`;

const defaultShipping = (user = {}) => ({
  fullName: user?.fullName || "",
  phone: normalizePhoneNumber(user?.phone || ""),
  email: user?.email || "",
  address: "",
  note: "",
  deliveryMethod: "delivery",
  deliveryTime: "asap",
});

export const isCheckoutContactValid = (shipping = {}) => {
  const phone = normalizePhoneNumber(shipping.phone || "");
  const email = String(shipping.email || "")
    .trim()
    .toLowerCase();
  return Boolean(
    (phone && isValidPhoneNumber(phone)) ||
      (email && EMAIL_PATTERN.test(email)),
  );
};

export const validateCheckoutShipping = (shipping = {}) => {
  if (!isCheckoutContactValid(shipping)) {
    return "Vui lòng nhập email hoặc số điện thoại hợp lệ để nhà hàng liên hệ.";
  }
  if (
    shipping.deliveryMethod === "delivery" &&
    String(shipping.address || "").trim().length < 6
  ) {
    return "Vui lòng nhập địa chỉ giao hàng đầy đủ.";
  }
  return "";
};

const mergeCoupons = (...lists) => {
  const map = new Map();
  lists
    .flat()
    .filter(Boolean)
    .forEach((coupon) => {
      const key = normalizeId(coupon?.id || coupon?._id || coupon?.code);
      if (key) map.set(key, { ...(map.get(key) || {}), ...coupon });
    });
  return Array.from(map.values());
};

const groupOrdersByRestaurant = (orders = []) => {
  const map = new Map();
  orders.forEach((order) => {
    if (!order?.restaurantId) return;
    if (!map.has(order.restaurantId)) map.set(order.restaurantId, []);
    map.get(order.restaurantId).push(order);
  });
  return Array.from(map, ([restaurantId, groupedOrders]) => ({
    restaurantId,
    orders: groupedOrders,
  }));
};

const calculateTotals = (items = [], couponDiscount = 0, shippingFee = 0) => {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (Number(item.price || 0) + Number(item.modifiersPrice || 0)) *
        Number(item.quantity || 1),
    0,
  );
  const discounted = Math.max(0, subtotal - Number(couponDiscount || 0));
  const tax = Math.round(discounted * ORDER_VAT_RATE);
  return {
    subtotal,
    promotionDiscount: 0,
    couponDiscount: Number(couponDiscount || 0),
    tax,
    shippingFee,
    total: discounted + tax + shippingFee,
    appliedPromotions: [],
  };
};

const transferStatus = (session = {}) => {
  const payment = String(session.status || "").toLowerCase();
  const status = String(
    session?.transfer?.status || "INSTRUCTIONS_SHOWN",
  ).toUpperCase();
  if (payment === "success" || status === "VERIFIED") return "VERIFIED";
  if (payment === "expired") return "EXPIRED";
  return status;
};

const transferStatusText = {
  INSTRUCTIONS_SHOWN: "Chờ thanh toán",
  SUBMITTED: "Đã gửi minh chứng",
  VERIFYING: "Đang xác minh",
  VERIFIED: "Đã xác minh",
  REJECTED: "Cần gửi lại minh chứng",
  FAILED: "Thanh toán chưa hợp lệ",
  EXPIRED: "Phiên đã hết hạn",
};

function PaymentMethodCard({
  value,
  selected,
  title,
  description,
  disabled,
  badge,
  onSelect,
}) {
  return (
    <button
      type="button"
      className={`payment-method-card checkout-payment-card ${selected ? "selected" : ""}`}
      disabled={disabled}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
    >
      <span className="checkout-payment-card__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {badge ? (
        <span className="checkout-payment-card__badge">{badge}</span>
      ) : null}
    </button>
  );
}

export default function OrderSummaryCheckoutModal({
  isOpen,
  onClose,
  items = [],
  onSuccess,
}) {
  const { user } = useContext(AuthContext) || {};
  const apolloClient = useApolloClient();
  const { upload } = useAvatarUploadLocal();
  const userId = user?.id || user?._id;
  const checkoutKeyRef = useRef(
    `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [shipping, setShipping] = useState(() => defaultShipping(user));
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [couponOptions, setCouponOptions] = useState({});
  const [selectedCoupons, setSelectedCoupons] = useState({});
  const [couponLoading, setCouponLoading] = useState(false);
  const [promotionPreview, setPromotionPreview] = useState(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState("");
  const [view, setView] = useState("summary");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [transferSessions, setTransferSessions] = useState([]);
  const [proofFiles, setProofFiles] = useState({});
  const [proofNotes, setProofNotes] = useState({});
  const [submittingProofId, setSubmittingProofId] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const [createCheckoutOrders] = useMutation(CREATE_CHECKOUT_ORDERS);
  const [createOrderPayment] = useMutation(CREATE_ORDER_PAYMENT);
  const [createCustomerTransferPayment] = useMutation(
    CREATE_CUSTOMER_TRANSFER_PAYMENT,
  );
  const [submitTransferProof] = useMutation(SUBMIT_TRANSFER_PROOF);
  const [syncPaymentStatus] = useMutation(SYNC_PAYMENT_STATUS);
  const { data: addressData } = useQuery(MY_CHECKOUT_ADDRESSES, {
    skip: !isOpen,
    fetchPolicy: "cache-and-network",
  });
  const savedAddresses = addressData?.myAddresses || [];
  const cartGroups = useMemo(() => buildRestaurantCartGroups(items), [items]);
  const singleRestaurantId =
    cartGroups.length === 1 ? cartGroups[0].restaurantId : null;
  const { data: paymentConfigData } = useQuery(PAYMENT_PUBLIC_CONFIG, {
    variables: { restaurantId: singleRestaurantId },
    skip: !isOpen || !singleRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const vnpayEnabled = Boolean(
    singleRestaurantId &&
      paymentConfigData?.restaurantPaymentPublicConfig?.providers?.some(
        (provider) => provider.provider === "vnpay" && provider.active,
      ),
  );
  const orderType = mapDeliveryMethodToOrderType(shipping.deliveryMethod);
  const shippingFee = getShippingFeeForDiscountPreview({
    deliveryMethod: shipping.deliveryMethod,
    shippingFee: shipping.shippingFee,
  });
  const estimatedCouponDiscount = Object.values(couponOptions).reduce(
    (sum, options) => {
      const selected = options.find(
        (option) =>
          option.coupon.code === selectedCoupons[option.restaurantId],
      );
      return sum + Number(selected?.eligibility?.estimatedDiscount || 0);
    },
    0,
  );
  const fallbackTotals = useMemo(
    () => calculateTotals(items, estimatedCouponDiscount, shippingFee),
    [items, estimatedCouponDiscount, shippingFee],
  );
  const totals = promotionPreview || fallbackTotals;
  const promotionDiscount = Number(totals.promotionDiscount || 0);
  const couponDiscount = Number(
    totals.couponDiscount ?? estimatedCouponDiscount,
  );

  useEffect(() => {
    if (!isOpen) return;
    setShipping(defaultShipping(user));
    setSelectedAddressId("");
    setPaymentMethod(null);
    setCouponOptions({});
    setSelectedCoupons({});
    setPromotionPreview(null);
    setPromotionError("");
    setView("summary");
    setError("");
    setReceipt(null);
    setTransferSessions([]);
    setProofFiles({});
    setProofNotes({});
    checkoutKeyRef.current = `checkout-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }, [isOpen, user]);

  const applyAddress = useCallback((address) => {
    if (!address) return;
    setSelectedAddressId(address.id);
    setShipping((current) => ({
      ...current,
      fullName: address.receiverName || current.fullName,
      phone: normalizePhoneNumber(address.phone || current.phone),
      address: address.fullAddress || "",
      note: address.note || current.note,
    }));
  }, []);

  useEffect(() => {
    if (!isOpen || selectedAddressId || !savedAddresses.length) return;
    applyAddress(
      savedAddresses.find((address) => address.isDefault) || savedAddresses[0],
    );
  }, [applyAddress, isOpen, savedAddresses, selectedAddressId]);

  useEffect(() => {
    if (!isOpen || !cartGroups.length) return undefined;
    let active = true;
    setCouponLoading(true);
    Promise.all(
      cartGroups.map(async (group) => {
        const [publicResult, savedResult] = await Promise.all([
          apolloClient.query({
            query: CHECKOUT_COUPONS,
            variables: { restaurantId: group.restaurantId },
            fetchPolicy: "network-only",
          }),
          apolloClient
            .query({
              query: MY_CHECKOUT_COUPONS,
              variables: {
                restaurantId: group.restaurantId,
                status: "saved",
              },
              fetchPolicy: "network-only",
            })
            .catch(() => ({ data: { myCoupons: [] } })),
        ]);
        const coupons = mergeCoupons(
          (savedResult?.data?.myCoupons || []).map((row) => row?.coupon),
          publicResult?.data?.coupons || [],
        );
        if (!coupons.length) return [group.restaurantId, []];
        const eligibilityResult = await apolloClient.query({
          query: CHECKOUT_COUPON_ELIGIBILITIES,
          variables: {
            input: {
              restaurantId: group.restaurantId,
              couponCodes: coupons.map((coupon) => coupon.code).filter(Boolean),
              items: group.items.map((item) =>
                mapCartItemToOrderItemInput(item, {
                  includeCartHoldRef: true,
                }),
              ),
              orderType,
              paymentMethod,
            },
          },
          fetchPolicy: "network-only",
        });
        const eligibilityMap = new Map(
          (eligibilityResult?.data?.checkoutCouponEligibilities || []).map(
            (row) => [String(row.couponCode || "").toUpperCase(), row],
          ),
        );
        const options = coupons.map((coupon) => ({
          restaurantId: group.restaurantId,
          coupon,
          eligibility:
            eligibilityMap.get(String(coupon.code || "").toUpperCase()) ||
            null,
        }));
        return [group.restaurantId, options];
      }),
    )
      .then((entries) => {
        if (!active) return;
        const next = Object.fromEntries(entries);
        setCouponOptions(next);
        setSelectedCoupons((current) => {
          const selected = { ...current };
          entries.forEach(([restaurantId, options]) => {
            const eligible = options
              .filter((option) => option.eligibility?.eligible)
              .sort(
                (a, b) =>
                  Number(b.eligibility.estimatedDiscount || 0) -
                  Number(a.eligibility.estimatedDiscount || 0),
              );
            const currentStillValid = eligible.some(
              (option) => option.coupon.code === selected[restaurantId],
            );
            selected[restaurantId] = currentStillValid
              ? selected[restaurantId]
              : eligible[0]?.coupon?.code || null;
          });
          return selected;
        });
      })
      .catch(() => {
        if (active) setCouponOptions({});
      })
      .finally(() => {
        if (active) setCouponLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apolloClient, cartGroups, isOpen, orderType, paymentMethod]);

  useEffect(() => {
    if (!isOpen || !cartGroups.length) {
      setPromotionPreview(null);
      setPromotionError("");
      return undefined;
    }

    let active = true;
    setPromotionLoading(true);
    setPromotionError("");

    Promise.all(
      cartGroups.map((group) =>
        apolloClient
          .query({
            query: CUSTOMER_PROMOTION_PREVIEW,
            variables: {
              input: buildCustomerPromotionPreviewInput({
                group,
                orderType,
                paymentMethod,
                couponCode: selectedCoupons[group.restaurantId] || null,
              }),
            },
            fetchPolicy: "network-only",
          })
          .then((result) => result?.data?.customerPromotionPreview || null),
      ),
    )
      .then((breakdowns) => {
        if (!active) return;
        setPromotionPreview(
          aggregateCustomerPromotionBreakdowns(breakdowns, shippingFee),
        );
      })
      .catch((caught) => {
        if (!active) return;
        setPromotionPreview(null);
        setPromotionError(
          caught?.message ||
            "Không thể xem trước ưu đãi. Máy chủ sẽ xác nhận lại khi tạo đơn.",
        );
      })
      .finally(() => {
        if (active) setPromotionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    apolloClient,
    cartGroups,
    isOpen,
    orderType,
    paymentMethod,
    selectedCoupons,
    shippingFee,
  ]);

  const mergeTransferSession = useCallback((updated) => {
    const updatedId = String(
      updated?.paymentSessionId || updated?.id || updated?._id || "",
    );
    if (!updatedId) return;
    setTransferSessions((current) =>
      current.map((session) =>
        String(session?.id || session?._id) === updatedId
          ? {
              ...session,
              ...updated,
              transfer: {
                ...(session.transfer || {}),
                ...(updated.transfer || {}),
              },
            }
          : session,
      ),
    );
  }, []);

  useEffect(() => {
    if (
      !isOpen ||
      view !== "transfer" ||
      !transferSessions.length ||
      !userId
    ) {
      return undefined;
    }
    const token = getToken();
    if (!token) return undefined;
    const ids = new Set(
      transferSessions.map((session) => String(session.id || session._id)),
    );
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
    });
    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("joinUserChannel", String(userId));
    });
    socket.on("paymentEvents", (event) => {
      if (ids.has(String(event?.paymentSessionId || ""))) {
        mergeTransferSession(event);
      }
    });
    socket.on("disconnect", () => setSocketConnected(false));
    return () => {
      socket.emit("leaveUserChannel", String(userId));
      socket.disconnect();
      setSocketConnected(false);
    };
  }, [isOpen, mergeTransferSession, transferSessions, userId, view]);

  useEffect(() => {
    if (!isOpen || view !== "transfer" || !transferSessions.length) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      transferSessions
        .filter(
          (session) =>
            !["VERIFIED", "FAILED", "EXPIRED"].includes(
              transferStatus(session),
            ),
        )
        .forEach((session) => {
          const id = String(session.id || session._id || "");
          if (!id) return;
          syncPaymentStatus({ variables: { paymentId: id } })
            .then((result) =>
              mergeTransferSession(result?.data?.syncPaymentStatus),
            )
            .catch(() => {});
        });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [
    isOpen,
    mergeTransferSession,
    syncPaymentStatus,
    transferSessions,
    view,
  ]);

  const createCheckout = async (method) => {
    const couponSelections = Object.entries(selectedCoupons)
      .filter(([, couponCode]) => Boolean(couponCode))
      .map(([restaurantId, couponCode]) => ({ restaurantId, couponCode }));
    const normalizedShipping = {
      ...shipping,
      fullName: String(shipping.fullName || "").trim() || undefined,
      phone: normalizePhoneNumber(shipping.phone),
      email:
        String(shipping.email || "")
          .trim()
          .toLowerCase() || undefined,
    };
    const result = await createCheckoutOrders({
      variables: {
        input: {
          orderType,
          items: items.map((item) =>
            mapCartItemToOrderItemInput(item, { includeCartHoldRef: true }),
          ),
          shipping: normalizedShipping,
          paymentMethod: method,
          pricing: buildDiscountPricingInput({
            taxRate: ORDER_VAT_RATE,
            serviceRate: 0,
            shippingFee,
          }),
          couponSelections,
          idempotencyKey: checkoutKeyRef.current,
          note: normalizedShipping.note || undefined,
        },
      },
    });
    return result?.data?.createCheckoutOrders;
  };

  const handleConfirm = async () => {
    setError("");
    const validationError = validateCheckoutShipping(shipping);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!paymentMethod) {
      setError("Vui lòng chọn phương thức thanh toán.");
      return;
    }
    if (paymentMethod === "vnpay" && (!vnpayEnabled || !singleRestaurantId)) {
      setError("VNPAY hiện chưa khả dụng cho đơn hàng này.");
      return;
    }

    setLoading(true);
    let orderCreated = false;
    try {
      const checkoutMethod =
        paymentMethod === "vnpay" ? "card" : paymentMethod;
      const checkoutResult = await createCheckout(checkoutMethod);
      const checkout = checkoutResult?.checkout;
      const orders = checkoutResult?.orders || [];
      if (!orders.length) throw new Error("Không tạo được đơn hàng.");
      orderCreated = true;
      const grandTotal =
        checkout?.grandTotal ??
        orders.reduce(
          (sum, order) => sum + Number(order?.totals?.grandTotal || 0),
          0,
        );
      setReceipt({
        checkoutCode: checkout?.checkoutCode,
        orderIds: checkout?.orderIds || orders.map((order) => order.id),
        orderCodes: orders.map((order) => order.orderCode).filter(Boolean),
        orders,
        totalPaid: grandTotal,
        paymentMethod,
      });
      onSuccess?.();

      if (paymentMethod === "vnpay") {
        const result = await createOrderPayment({
          variables: {
            input: {
              restaurantId: singleRestaurantId,
              orderIds: orders.map((order) => order.id),
              provider: "vnpay",
              paymentMethod: "vnpay",
            },
          },
        });
        const payUrl = result?.data?.createOrderPayment?.payUrl;
        if (!payUrl) {
          throw new Error("VNPAY chưa trả về đường dẫn thanh toán.");
        }
        window.location.assign(payUrl);
        return;
      }

      if (paymentMethod === "transfer") {
        const sessions = [];
        for (const group of groupOrdersByRestaurant(orders)) {
          const result = await createCustomerTransferPayment({
            variables: {
              input: {
                restaurantId: group.restaurantId,
                orderIds: group.orders.map((order) => order.id),
              },
            },
          });
          if (result?.data?.createCustomerTransferPayment) {
            sessions.push(result.data.createCustomerTransferPayment);
          }
        }
        setTransferSessions(sessions);
        setView("transfer");
      } else {
        setView("success");
      }
    } catch (caught) {
      const message = caught?.message || "Không thể tạo đơn. Vui lòng thử lại.";
      setError(
        orderCreated
          ? `Đơn đã được tạo nhưng chưa thể mở thanh toán: ${message}`
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProofFiles = (sessionId, event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_PROOF_FILES);
    const invalid = files.find(
      (file) =>
        !file.type?.startsWith("image/") || file.size > MAX_PROOF_BYTES,
    );
    if (invalid) {
      setError("Minh chứng phải là ảnh và mỗi ảnh không vượt quá 10MB.");
      event.target.value = "";
      return;
    }
    setProofFiles((current) => ({ ...current, [sessionId]: files }));
    event.target.value = "";
  };

  const submitProof = async (sessionId) => {
    const files = proofFiles[sessionId] || [];
    if (!files.length) {
      setError("Vui lòng chọn ít nhất một ảnh minh chứng.");
      return;
    }
    setSubmittingProofId(sessionId);
    setError("");
    try {
      const proofImages = [];
      for (const file of files) proofImages.push(await upload(file));
      const result = await submitTransferProof({
        variables: {
          input: {
            paymentSessionId: sessionId,
            proofImages,
            proofNote: proofNotes[sessionId] || "",
          },
        },
      });
      mergeTransferSession(result?.data?.submitTransferProof);
      setProofFiles((current) => ({ ...current, [sessionId]: [] }));
    } catch (caught) {
      setError(caught?.message || "Không thể gửi minh chứng chuyển khoản.");
    } finally {
      setSubmittingProofId("");
    }
  };

  const renderSummary = () => (
    <div className="checkout-confirmation">
      <section className="section checkout-contact-card">
        <div className="checkout-section-heading">
          <div>
            <span className="checkout-section-kicker">Liên hệ nhận đơn</span>
            <h3>Thông tin khách hàng</h3>
          </div>
          <span className="checkout-contact-rule">
            Chỉ cần email hoặc số điện thoại
          </span>
        </div>
        {savedAddresses.length ? (
          <label className="saved-address-picker">
            Địa chỉ đã lưu
            <select
              value={selectedAddressId}
              onChange={(event) =>
                applyAddress(
                  savedAddresses.find(
                    (address) => address.id === event.target.value,
                  ),
                )
              }
            >
              <option value="">Chọn nhanh địa chỉ</option>
              {savedAddresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.isDefault ? "Mặc định · " : ""}
                  {address.receiverName || address.label} · {address.fullAddress}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="checkout-contact-grid">
          <label>
            Họ tên <small>Tùy chọn</small>
            <input
              value={shipping.fullName}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              placeholder="Tên người nhận"
              autoComplete="name"
            />
          </label>
          <label>
            Số điện thoại
            <input
              value={shipping.phone}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="0901234567"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label>
            Email
            <input
              value={shipping.email}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
            />
          </label>
          <label className="checkout-contact-grid__wide">
            Địa chỉ giao hàng
            <input
              value={shipping.address}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder="Số nhà, đường, phường/xã, quận/huyện"
              autoComplete="street-address"
            />
          </label>
          <label className="checkout-contact-grid__wide">
            Ghi chú <small>Tùy chọn</small>
            <textarea
              value={shipping.note}
              onChange={(event) =>
                setShipping((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Ít cay, gọi khi tới nơi..."
              rows={2}
            />
          </label>
        </div>
      </section>

      <section className="section checkout-items-card">
        <div className="checkout-section-heading">
          <div>
            <span className="checkout-section-kicker">Đơn hàng</span>
            <h3>Món đã chọn</h3>
          </div>
          <strong>
            {items.reduce(
              (sum, item) => sum + Number(item.quantity || 1),
              0,
            )}{" "}
            món
          </strong>
        </div>
        <div className="checkout-items-list">
          {items.map((item) => {
            const line = getOrderLineDisplay(item);
            const total =
              line.totalPrice ||
              (Number(item.price || 0) + Number(item.modifiersPrice || 0)) *
                Number(item.quantity || 1);
            return (
              <article
                className="checkout-item-row"
                key={item.id || item.cartItemId || item.name}
              >
                <div>
                  <strong>{line.displayName}</strong>
                  <span>Số lượng {line.quantity}</span>
                  {line.childItems?.length ? (
                    <small>
                      {line.childItems
                        .map((child) => `${child.qty}× ${child.name}`)
                        .join(" · ")}
                    </small>
                  ) : null}
                </div>
                <strong>{formatCurrency(total)}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section checkout-coupon-card">
        <div className="checkout-section-heading">
          <div>
            <span className="checkout-section-kicker">Ưu đãi</span>
            <h3>Khuyến mãi và coupon</h3>
          </div>
          {couponLoading || promotionLoading ? (
            <span>Đang kiểm tra...</span>
          ) : null}
        </div>
        {cartGroups.every(
          (group) => !(couponOptions[group.restaurantId] || []).length,
        ) ? (
          <p className="coupon-empty-state">
            Không có coupon bổ sung; khuyến mãi món vẫn được áp tự động nếu đủ
            điều kiện.
          </p>
        ) : (
          cartGroups.map((group) => (
            <div className="checkout-coupon-list" key={group.restaurantId}>
              {(couponOptions[group.restaurantId] || []).map((option) => {
                const applied =
                  selectedCoupons[group.restaurantId] === option.coupon.code;
                const eligible = Boolean(option.eligibility?.eligible);
                return (
                  <button
                    type="button"
                    key={option.coupon.code}
                    disabled={!eligible}
                    className={`checkout-coupon-option ${applied ? "is-applied" : ""}`}
                    onClick={() =>
                      setSelectedCoupons((current) => ({
                        ...current,
                        [group.restaurantId]: applied
                          ? null
                          : option.coupon.code,
                      }))
                    }
                  >
                    <span>
                      <strong>
                        {option.coupon.name || option.coupon.code}
                      </strong>
                      <small>
                        {eligible
                          ? buildCouponConditionText(
                              option.coupon,
                              formatCurrency,
                            )
                          : option.eligibility?.reason || "Không đủ điều kiện"}
                      </small>
                    </span>
                    <strong>
                      {eligible
                        ? `-${formatCurrency(
                            option.eligibility.estimatedDiscount || 0,
                          )}`
                        : ""}
                    </strong>
                  </button>
                );
              })}
            </div>
          ))
        )}
        {promotionError ? (
          <p className="coupon-preview-note">
            Chưa tải được giá ưu đãi. Máy chủ sẽ xác nhận lại khi tạo đơn.
          </p>
        ) : (
          <p className="coupon-preview-note">
            {promotionDiscount > 0
              ? `Đã áp tự động ${totals.appliedPromotions?.length || 1} khuyến mãi món.`
              : "Tổng tiền được kiểm tra trực tiếp từ máy chủ."}
          </p>
        )}
      </section>

      <section className="section checkout-payment-section">
        <div className="checkout-section-heading">
          <div>
            <span className="checkout-section-kicker">Thanh toán</span>
            <h3>Chọn phương thức</h3>
          </div>
        </div>
        <div className="payment-methods-grid checkout-payment-grid">
          <PaymentMethodCard
            value="cash"
            selected={paymentMethod === "cash"}
            title="Tiền mặt"
            description="Thanh toán khi nhận hàng"
            onSelect={setPaymentMethod}
          />
          <PaymentMethodCard
            value="transfer"
            selected={paymentMethod === "transfer"}
            title="Chuyển khoản / QR"
            description="Chuyển khoản và gửi minh chứng"
            onSelect={setPaymentMethod}
          />
          {vnpayEnabled ? (
            <PaymentMethodCard
              value="vnpay"
              selected={paymentMethod === "vnpay"}
              title="VNPAY"
              description="Thanh toán trực tuyến qua cổng VNPAY"
              badge="Nhanh"
              onSelect={setPaymentMethod}
            />
          ) : null}
          <PaymentMethodCard
            value="wallet"
            selected={paymentMethod === "wallet"}
            title="Ví nội bộ"
            description={`Số dư ${formatCurrency(
              Number(user?.wallet?.balance || 0),
            )}`}
            onSelect={setPaymentMethod}
          />
        </div>
      </section>

      <section className="section checkout-total-card">
        <div>
          <span>Tạm tính</span>
          <strong>{formatCurrency(totals.subtotal)}</strong>
        </div>
        {promotionDiscount > 0 ? (
          <div>
            <span>Khuyến mãi món</span>
            <strong>-{formatCurrency(promotionDiscount)}</strong>
          </div>
        ) : null}
        {couponDiscount > 0 ? (
          <div>
            <span>Coupon</span>
            <strong>-{formatCurrency(couponDiscount)}</strong>
          </div>
        ) : null}
        <div>
          <span>Phí giao hàng</span>
          <strong>{formatCurrency(totals.shippingFee)}</strong>
        </div>
        <div>
          <span>VAT 10%</span>
          <strong>{formatCurrency(totals.tax)}</strong>
        </div>
        <div className="checkout-total-card__grand">
          <span>Tổng thanh toán</span>
          <strong>
            {promotionLoading ? "Đang tính..." : formatCurrency(totals.total)}
          </strong>
        </div>
      </section>
    </div>
  );

  const renderTransfer = () => (
    <section className="transfer-payment-workspace">
      <header className="transfer-payment-hero">
        <div>
          <p className="transfer-payment-eyebrow">Thanh toán chuyển khoản</p>
          <h3>Quét QR và theo dõi xác minh</h3>
          <p>
            Đơn đã được tạo. Hệ thống sẽ cập nhật trạng thái thanh toán tự động.
          </p>
        </div>
        <div className="transfer-payment-live">
          <span className="transfer-live-dot" />
          <span>
            {socketConnected
              ? "Đang cập nhật realtime"
              : "Tự kiểm tra mỗi 10 giây"}
          </span>
        </div>
      </header>
      <div className="transfer-session-list">
        {transferSessions.map((session) => {
          const id = String(session.id || session._id || "");
          const bank = session?.metadata?.bankTransfer || {};
          const status = transferStatus(session);
          const canSubmit = ["INSTRUCTIONS_SHOWN", "REJECTED"].includes(
            status,
          );
          return (
            <article
              className={`transfer-session-card transfer-session-card--${status.toLowerCase()}`}
              key={id}
            >
              <header className="transfer-session-header">
                <div>
                  <p className="transfer-session-kicker">
                    {session.reference}
                  </p>
                  <h4>{formatCurrency(session.amount)}</h4>
                </div>
                <span
                  className={`transfer-status-badge transfer-status-badge--${status.toLowerCase()}`}
                >
                  {transferStatusText[status] || status}
                </span>
              </header>
              <div className="transfer-session-grid">
                <aside className="transfer-qr-card">
                  <div className="transfer-qr-frame">
                    {bank.qrImageUrl ? (
                      <img
                        className="transfer-qr-image"
                        src={bank.qrImageUrl}
                        alt="QR chuyển khoản"
                      />
                    ) : (
                      <div className="transfer-qr-placeholder">
                        QR đang cập nhật
                      </div>
                    )}
                  </div>
                </aside>
                <div className="transfer-bank-panel">
                  <div className="transfer-info-row">
                    <span>Ngân hàng</span>
                    <strong>{bank.bankName || "Đang cập nhật"}</strong>
                  </div>
                  <div className="transfer-info-row">
                    <span>Số tài khoản</span>
                    <strong>
                      {bank.bankAccountNumber || "Đang cập nhật"}
                    </strong>
                  </div>
                  <div className="transfer-info-row">
                    <span>Chủ tài khoản</span>
                    <strong>{bank.accountName || "Đang cập nhật"}</strong>
                  </div>
                  <div className="transfer-info-row is-important">
                    <span>Nội dung</span>
                    <strong>
                      {bank.transferContent || session.reference}
                    </strong>
                  </div>
                </div>
              </div>
              {session?.transfer?.rejectReason ? (
                <p className="transfer-reject-reason">
                  Lý do: {session.transfer.rejectReason}
                </p>
              ) : null}
              {canSubmit ? (
                <div className="transfer-proof-panel">
                  <label className="transfer-proof-upload-card">
                    <span>Ảnh minh chứng chuyển khoản</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => handleProofFiles(id, event)}
                    />
                    <small>Tối đa 3 ảnh, mỗi ảnh không quá 10MB.</small>
                  </label>
                  <label>
                    Ghi chú cho nhà hàng
                    <textarea
                      value={proofNotes[id] || ""}
                      onChange={(event) =>
                        setProofNotes((current) => ({
                          ...current,
                          [id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="transfer-proof-actions">
                    <button
                      type="button"
                      className="transfer-proof-primary"
                      disabled={
                        submittingProofId === id ||
                        !(proofFiles[id] || []).length
                      }
                      onClick={() => submitProof(id)}
                    >
                      {submittingProofId === id
                        ? "Đang gửi..."
                        : "Gửi minh chứng"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );

  const renderSuccess = () => (
    <section className="section checkout-success-card">
      <span className="checkout-success-card__icon">✓</span>
      <h3>Đặt đơn thành công</h3>
      <p>
        Mã đơn: <strong>{receipt?.checkoutCode}</strong>
      </p>
      <p>
        Tổng tiền: <strong>{formatCurrency(receipt?.totalPaid || 0)}</strong>
      </p>
    </section>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận đơn hàng"
      size="lg"
      className="order-summary-modal checkout-upgraded-modal"
    >
      <div className="order-summary-wrapper">
        {error ? (
          <div className="order-summary-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="order-summary-content">
          {view === "summary" ? renderSummary() : null}
          {view === "transfer" ? renderTransfer() : null}
          {view === "success" ? renderSuccess() : null}
        </div>
        <Modal.Footer>
          <button className="btn btn--secondary" onClick={onClose}>
            Đóng
          </button>
          {view === "summary" ? (
            <button
              className="btn btn--success"
              disabled={loading || promotionLoading}
              onClick={handleConfirm}
            >
              {loading
                ? "Đang xử lý..."
                : promotionLoading
                  ? "Đang xác nhận ưu đãi..."
                  : paymentMethod === "vnpay"
                    ? "Tiếp tục với VNPAY"
                    : "Xác nhận đặt hàng"}
            </button>
          ) : (
            <button className="btn btn--primary" onClick={onClose}>
              Hoàn tất
            </button>
          )}
        </Modal.Footer>
      </div>
    </Modal>
  );
}
