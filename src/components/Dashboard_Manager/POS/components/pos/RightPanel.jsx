import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { useNotification } from "../../../../../hooks/useNotification";
import { formatPrice } from "@/utils/formatters";
import { PRINT_STATIONS } from "@/utils/printStations";
import { groupPaymentRequests } from "@/utils/paymentRequestGrouping";
import { groupItemsByBatch } from "@/utils/orderBatchGrouping";
import {
  formatDiscountReasonLabel,
  getPromotionSourceLabel,
  getPromotionTypeLabel,
} from "@/utils/discountDisplay";
import {
  getDiscountPreviewErrorMessage,
  useDiscountPreview,
} from "@/hooks/useDiscountPreview";
import { useActiveDiscountPromotions } from "@/hooks/useActiveDiscountPromotions";
import {
  buildDiscountPricingInput,
  buildOrderDiscountPreviewInput,
  getDiscountBreakdownTotal,
  getShippingFeeForDiscountPreview,
} from "@/utils/discountPreviewPayload";
import PaymentModal from "../modals/PaymentModal";
import InvoiceReceiptModal from "../modals/InvoiceReceiptModal";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";
import MenuItemModal from "../modals/MenuItemModal";
import OrderConfirmModal from "../modals/OrderConfirmModal";
import { PrintModal } from "../modals/PrintModal";
import { PrintQueueModal } from "../modals/PrintQueueModal";
import {
  getPaymentRequestGroupLabel,
  isOffPremiseOrderType,
  isRealDineInOrderType,
  isRealTableCode,
} from "./posDisplayLabels";

const IconDraft = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconImage = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: "middle" }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const IconSettings = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const IconDashboard = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

const IconOrderList = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6h11"></path>
    <path d="M9 12h11"></path>
    <path d="M9 18h11"></path>
    <path d="M5 6v.01"></path>
    <path d="M5 12v.01"></path>
    <path d="M5 18v.01"></path>
  </svg>
);

const PRIORITY_LABELS = {
  HIGH: "Ưu tiên cao",
  MEDIUM: "Ưu tiên vừa",
  LOW: "Ưu tiên thấp",
};
const ORDER_STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã nhận",
  preparing: "Đang chế biến",
  ready: "Sẵn sàng phục vụ",
  served: "Đã phục vụ",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  failed: "Thất bại",
};

const getOrderStatusLabel = (status) => {
  const key = String(status || "").toLowerCase();
  return ORDER_STATUS_LABELS[key] || status || "Không rõ";
};

const shortOrderCode = (code) => {
  if (!code) return "";
  const raw = String(code);
  const parts = raw.split("-");
  const last = parts[parts.length - 1];
  return last ? `#${last}` : raw;
};

const formatOrderItemQuantity = (item) => {
  const quantity = Number(item?.quantity || 0);
  const unit = String(
    item?.unit || item?.servingVariant?.sellUnit || "",
  ).toLowerCase();

  const clean = Number.isInteger(quantity)
    ? String(quantity)
    : String(quantity).replace(/\.0+$/, "");

  if (unit === "kg") return `${clean} kg`;
  if (unit === "g") return `${clean} g`;

  return `x${clean}`;
};

const TRANSFER_QUEUE = gql`
  query TransferPaymentQueue($restaurantId: ID!, $statuses: [TransferVerificationStatus!], $limit: Int) {
    transferPaymentQueue(restaurantId: $restaurantId, statuses: $statuses, limit: $limit) {
      id
      reference
      amount
      currency
      status
      callbackStatus
      createdAt
      expiresAt
      metadata
      transfer { status rejectReason rejectedCount maxRejectedCount proofImages proofNote submittedAt pausedAt resumedAt proofCycleStartedAt }
    }
  }
`;

const VERIFY_TRANSFER_PAYMENT = gql`
  mutation VerifyTransferPayment($input: VerifyTransferPaymentInput!) {
    verifyTransferPayment(input: $input) { id status callbackStatus transfer { status verifiedAt } }
  }
`;

const REJECT_TRANSFER_PAYMENT = gql`
  mutation RejectTransferPayment($input: RejectTransferPaymentInput!) {
    rejectTransferPayment(input: $input) { id status callbackStatus transfer { status rejectedCount maxRejectedCount rejectReason lastRejectedReason } }
  }
`;

const M_ENQUEUE_PRINT_JOB = gql`
  mutation EnqueuePrintJob($input: EnqueuePrintJobInput!) {
    enqueuePrintJob(input: $input) {
      id
      printerId
      printerName
      stationId
      printType
      templateKey
      status
      error
      retryCount
      payload
      createdAt
    }
  }
`;

export default function RightPanel() {
  const navigate = useNavigate();
  const {
    restaurantId,
    currentTable,
    currentOrder,
    currentOrderType,
    currentOrderCode,

    shippingInfo,
    deliveryCustomer,

    updateItemQty,
    removeItem,
    finalTotals,
    clearOrder,
    saveOrder,
    setTableStatus,

    preparePayment,
    paymentRequests,
    loadPaymentRequestToPOS,
    clearPaymentRequest,
    printers,
    printStations,
    setPrintQueue,
    printQueue,
    selectedPrinter,
    setSelectedPrinter,
    menuItems,
    clearTableSessionState,
    refetchTables,
    ensureOffPremiseSession,
    clearOffPremiseDraft,
    setCurrentOrderCode,
    setShippingInfo,
    setDeliveryCustomer,
    setCurrentOrder,
    setCurrentTable,
    setCurrentOrderId,
  } = usePos();

  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };

  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isReceiptModalOpen, setReceiptModalOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isClearModalOpen, setClearModalOpen] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const activePaymentRequestRef = useRef(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPrintModalOpen, setPrintModalOpen] = useState(false);
  const [isPrintQueueOpen, setPrintQueueOpen] = useState(false);
  const [printMode, setPrintMode] = useState("temp");
  const [enqueuePrintJob] = useMutation(M_ENQUEUE_PRINT_JOB);
  const { data: transferQueueData, refetch: refetchTransferQueue } = useQuery(TRANSFER_QUEUE, {
    variables: { restaurantId, statuses: ["SUBMITTED", "VERIFYING"], limit: 8 },
    skip: !restaurantId,
    pollInterval: 15000,
    fetchPolicy: "cache-and-network",
  });
  const [verifyTransferPayment] = useMutation(VERIFY_TRANSFER_PAYMENT);
  const [rejectTransferPayment] = useMutation(REJECT_TRANSFER_PAYMENT);
  const [transferVerifyDraft, setTransferVerifyDraft] = useState(null);
  const [transferRejectDraft, setTransferRejectDraft] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [selectedPromotionIds, setSelectedPromotionIds] = useState([]);
  const [discountBreakdown, setDiscountBreakdown] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountTouched, setDiscountTouched] = useState(false);

  const { previewOrderDiscount, loading: isPreviewingDiscount } =
    useDiscountPreview();

  const isOffPremise = isOffPremiseOrderType(currentOrderType);

  const { promotions: activePromotions, loading: promotionsLoading } =
    useActiveDiscountPromotions(restaurantId, {
      skip: !isOffPremise,
    });

  const selectedPromotionId = selectedPromotionIds[0] || "";

  const discountShippingFee = useMemo(
    () =>
      getShippingFeeForDiscountPreview({
        deliveryMethod:
          currentOrderType === "delivery" ? "delivery" : "takeaway",
        shippingFee: shippingInfo?.shippingFee || 0,
      }),
    [currentOrderType, shippingInfo?.shippingFee],
  );
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const hasItems = Array.isArray(currentOrder) && currentOrder.length > 0;
  const printerList = useMemo(() => Object.values(printers || {}), [printers]);

  useEffect(() => {
    if (!selectedPrinter && printerList.length) {
      setSelectedPrinter(printerList[0]);
    }
  }, [printerList, selectedPrinter, setSelectedPrinter]);

  const { existingItems, newItems } = useMemo(() => {
    const ex = [];
    const nw = [];
    (currentOrder || []).forEach((it) => {
      if (it?.isNew)
        nw.push(it); // ✅ chỉ isNew mới là món nháp
      else if (it?.isExisting)
        ex.push(it); // ✅ còn lại, nếu isExisting thì là đã lưu
      else nw.push(it);
    });
    return { existingItems: ex, newItems: nw };
  }, [currentOrder]);

  const groupedExistingBatches = useMemo(
    () => groupItemsByBatch(existingItems),
    [existingItems],
  );

  const buildPosDiscountPreviewInput = useCallback(
    () =>
      buildOrderDiscountPreviewInput({
        restaurantId,
        orderType: currentOrderType,
        items: newItems,
        taxRate: 0,
        serviceRate: 0,
        shippingFee: discountShippingFee,
        couponCode,
        promotionIds: selectedPromotionIds,
      }),
    [
      restaurantId,
      currentOrderType,
      newItems,
      discountShippingFee,
      couponCode,
      selectedPromotionIds,
    ],
  );
  const handleApplyDiscountPreview = useCallback(async () => {
    setDiscountTouched(true);
    setDiscountError("");

    if (!isOffPremise) {
      setDiscountBreakdown(null);
      setDiscountError("Coupon cho bàn ăn sẽ áp dụng ở bước thanh toán.");
      return;
    }

    if (!restaurantId) {
      setDiscountBreakdown(null);
      setDiscountError("Không xác định được nhà hàng.");
      return;
    }

    if (!newItems.length) {
      setDiscountBreakdown(null);
      setDiscountError("Không có món mới để kiểm tra ưu đãi.");
      return;
    }

    try {
      const breakdown = await previewOrderDiscount(
        buildPosDiscountPreviewInput(),
      );
      setDiscountBreakdown(breakdown);
    } catch (error) {
      setDiscountBreakdown(null);
      setDiscountError(getDiscountPreviewErrorMessage(error));
    }
  }, [
    isOffPremise,
    restaurantId,
    newItems.length,
    previewOrderDiscount,
    buildPosDiscountPreviewInput,
  ]);
  useEffect(() => {
    if (!discountTouched) return;

    setDiscountBreakdown(null);
    setDiscountError("");
  }, [
    currentOrderType,
    currentOrderCode,
    newItems,
    shippingInfo,
    selectedPromotionIds,
    discountTouched,
  ]);

  const offPremiseKind = currentOrderType === "delivery" ? "SHIP" : "TAKE";
  const clearActiveDrafts = useCallback(() => {
    if (currentOrderType === "delivery" || currentOrderType === "takeaway") {
      clearOffPremiseDraft?.(currentOrderType);
    }
  }, [currentOrderType, clearOffPremiseDraft]);
  const getItemPrice = (item) => {
    const unit = String(
      item?.unit || item?.servingVariant?.sellUnit || "",
    ).toLowerCase();

    const price = formatPrice(Number(item.price || 0));

    if (unit === "kg") return `${price}/kg`;
    if (unit === "g") return `${price}/g`;

    return price;
  };
  const getItemTotal = (item) => {
    const t =
      item.total != null
        ? Number(item.total)
        : Number(item.price || 0) * Number(item.quantity || 1);
    return formatPrice(t);
  };

  const formatTime = (dateInput) => {
    if (!dateInput) return "";
    let dateObj;
    if (typeof dateInput === "string" && /^\d+$/.test(dateInput)) {
      dateObj = new Date(parseInt(dateInput, 10));
    } else {
      dateObj = new Date(dateInput);
    }
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const headerTitle = useMemo(() => {
    if (isRealDineInOrderType(currentOrderType)) {
      if (isRealTableCode(currentOrderType, currentTable?.code)) {
        return `Bàn ${String(currentTable.code).trim()}`;
      }
      return "Chọn bàn";
    }

    if (currentOrderCode) return currentOrderCode;

    return currentOrderType === "delivery"
      ? "Đơn giao hàng"
      : currentOrderType === "takeaway"
        ? "Đơn mang đi"
        : "Đơn hàng";
  }, [currentOrderCode, currentOrderType, currentTable?.code]);

  const headerMeta = useMemo(() => {
    if (isOffPremise) {
      const name = (
        shippingInfo?.fullName ||
        deliveryCustomer?.name ||
        ""
      ).trim();
      const phone = (
        shippingInfo?.phone ||
        deliveryCustomer?.phone ||
        ""
      ).trim();
      const email = (
        shippingInfo?.email ||
        deliveryCustomer?.email ||
        ""
      ).trim();
      const addr = (shippingInfo?.address || "").trim();

      return {
        line1:
          name || phone || email
            ? `${name || "Khách"}${phone ? ` · ${phone}` : ""}${email ? ` · ${email}` : ""}`
            : "",
        line2:
          addr ||
          (currentOrderType === "takeaway"
            ? "Không có địa chỉ"
            : "Chưa có địa chỉ"),
      };
    }

    if (currentTable) {
      return {
        line1: `${currentTable.capacity || 0} chỗ`,
        line2: currentTable.status || "available",
      };
    }

    return {
      line1: "Chưa chọn bàn",
      line2: "",
    };
  }, [isOffPremise, shippingInfo, deliveryCustomer, currentTable]);

  const payableTotal = getDiscountBreakdownTotal(
    discountBreakdown,
    finalTotals?.total || finalTotals?.grandTotal || 0,
  );

  const totalsForDisplay = discountBreakdown
    ? {
        subtotal: discountBreakdown.subtotal,
        couponDiscount:
          discountBreakdown.couponDiscount ||
          discountBreakdown.voucherDiscount ||
          0,
        promotionDiscount: discountBreakdown.promotionDiscount || 0,
        shippingDiscount: discountBreakdown.shippingDiscount || 0,
        discount:
          discountBreakdown.totalDiscount || discountBreakdown.discount || 0,
        service: discountBreakdown.service || 0,
        tax: discountBreakdown.tax || 0,
        total: payableTotal,
        grandTotal: payableTotal,
      }
    : finalTotals || {};
  const totals = totalsForDisplay;
  const displaySubtotal = discountBreakdown
    ? totals?.subtotal
    : finalTotals?.subtotal;
  const displayGrandTotal = discountBreakdown
    ? totals?.total || totals?.grandTotal
    : finalTotals?.total || finalTotals?.grandTotal;
  const hasCouponCode = couponCode.trim().length > 0;
  const hasPromotionSelection = selectedPromotionIds.length > 0;
  const hasDiscountSelection = hasCouponCode || hasPromotionSelection;

  const shouldBlockSaveForDiscount =
    isOffPremise &&
    hasDiscountSelection &&
    (!discountBreakdown || !!discountError);
  const breakdownConfig = [
    { key: "subtotal", label: "Tạm tính", cls: "" },
    { key: "couponDiscount", label: "Giảm coupon", cls: "neg" },
    { key: "promotionDiscount", label: "Giảm promotion", cls: "neg" },
    { key: "shippingDiscount", label: "Giảm vận chuyển", cls: "neg" },
    { key: "discount", label: "Tổng giảm", cls: "neg" },
    { key: "service", label: "Phí phục vụ", cls: "" },
    { key: "tax", label: "Thuế", cls: "" },
  ];

  const breakdownRows = breakdownConfig
    .filter(({ key }) => totals[key] !== undefined && totals[key] !== null)
    .map(({ key, label, cls: c }) => ({
      label,
      value: totals[key],
      clsName: c,
    }));
  const promotionLineItems = useMemo(
    () =>
      Array.isArray(discountBreakdown?.promotionLines)
        ? discountBreakdown.promotionLines
            .filter((line) => Number(line?.discount || 0) > 0)
            .map((line, index) => ({
              key:
                line?.lineId ||
                `${line?.promotionId || "promotion"}_${
                  line?.dishId || line?.menuId || index
                }`,
              itemName: String(line?.name || "").trim() || "Món áp dụng",
              promotionName:
                String(line?.promotionName || "").trim() || "Khuyến mãi",
              discount: Math.abs(Number(line?.discount || 0)),
            }))
        : [],
    [discountBreakdown?.promotionLines],
  );
  const promotionBreakdownRows = useMemo(() => {
    const rows = Array.isArray(discountBreakdown?.appliedPromotionBreakdown)
      ? discountBreakdown.appliedPromotionBreakdown
      : [];
    return rows
      .map((row, index) => ({
        key: row?.id || `${row?.promotionId || "promo"}_${index}`,
        type: getPromotionTypeLabel(row?.type || row?.promotionType),
        label: row?.promotionName || row?.promotionCode || "Khuyến mãi",
        source: getPromotionSourceLabel(row?.source),
        itemName: row?.itemName || "",
        discountAmount: Math.abs(Number(row?.discountAmount ?? row?.discount ?? 0)),
      }))
      .filter((row) => row.discountAmount > 0);
  }, [discountBreakdown]);

  const closePaymentModal = useCallback(() => setPaymentModalOpen(false), []);
  const hasUnservedExistingItems = useMemo(() => {
    return (currentOrder || []).some((item) => {
      if (item?.isNew) return true;

      const status = String(item?.status || "").toLowerCase();

      return ["pending", "confirmed", "preparing", "ready"].includes(status);
    });
  }, [currentOrder]);
  const openPaymentModal = useCallback(async () => {
    if (!hasItems) return;
    if (hasUnservedExistingItems) {
      showNotification(
        "Không thể thanh toán khi còn món chưa phục vụ xong.",
        "error",
      );
      return;
    }
    if (!currentTable?.restaurantId) {
      showNotification("Thiếu restaurantId.", "error");
      return;
    }

    const res = await preparePayment?.({
      restaurantId: currentTable.restaurantId,
    });

    if (!res?.success) {
      showNotification(
        res?.message || "Chuẩn bị thanh toán thất bại.",
        "error",
      );
      return;
    }

    setPaymentModalOpen(true);
  }, [
    hasItems,
    hasUnservedExistingItems,
    currentTable?.restaurantId,
    preparePayment,
    showNotification,
  ]);

  const handlePaymentComplete = useCallback(
    (payload) => {
      const serverPayload = payload?.server || {};
      const hasPaymentProof =
        Boolean(serverPayload?.invoice) ||
        Boolean(serverPayload?.transaction) ||
        payload?.status === "COMPLETED";

      if (!hasPaymentProof) {
        showNotification(
          "Thanh toán chưa hoàn tất, giữ nguyên bàn và món.",
          "error",
        );
        return;
      }
      const activeRequest = activePaymentRequestRef.current;

      if (
        Array.isArray(activeRequest?.orderIds) &&
        activeRequest.orderIds.length
      ) {
        activeRequest.orderIds.forEach((orderId) => {
          clearPaymentRequest?.(orderId);
        });
      } else {
        const paidOrderId =
          payload?.orderId ||
          payload?.server?.order?.id ||
          payload?.server?.orderId ||
          activeRequest?.orderId;

        if (paidOrderId) {
          clearPaymentRequest?.(paidOrderId);
        }
      }

      activePaymentRequestRef.current = null;
      showNotification("Thanh toán thành công.", "success");

      const invoice = payload?.server?.invoice || null;
      setReceiptData({
        ...payload,
        invoice,
        transaction: payload?.server?.transaction || null,
        cashflow: payload?.server?.cashflow || null,
        table: currentTable,
        fallbackItems: currentOrder || [],
      });
      setReceiptModalOpen(true);
      const invoiceTotals = invoice?.totals || {};
      const invoiceNumber = invoice?.number || invoice?.id;

      const appliedCouponCode =
        payload?.appliedCouponCode ||
        invoiceTotals?.voucherCode ||
        invoice?.meta?.voucherCode ||
        "";

      const discountAmount = Math.max(
        0,
        Number(
          invoiceTotals?.discount ??
            invoice?.meta?.totalDiscount ??
            invoice?.meta?.voucherDiscount ??
            0,
        ),
      );

      const discountReason = formatDiscountReasonLabel(
        invoiceTotals?.discountReason || invoice?.meta?.discountReason || "",
      );
      if (invoiceNumber) {
        showNotification(`Hóa đơn: ${invoiceNumber}`, "info");
      }

      if (discountAmount > 0 || appliedCouponCode || discountReason) {
        const parts = [];

        if (appliedCouponCode) {
          parts.push(`Coupon ${appliedCouponCode}`);
        }

        if (discountAmount > 0) {
          parts.push(`giảm ${formatPrice(discountAmount)}`);
        }

        if (discountReason) {
          parts.push(discountReason);
        }

        showNotification(`Ưu đãi đã áp dụng: ${parts.join(" · ")}`, "success");
      }

      const paidTable = currentTable;

      clearActiveDrafts();

      if (clearTableSessionState) {
        clearTableSessionState(paidTable);
      } else {
        clearOrder();
        setCurrentOrder?.([]);
        setCurrentOrderCode?.(null);
        setCurrentOrderId?.(null);
        setCurrentTable?.(null);
      }

      if (paidTable?.id && setTableStatus) {
        setTableStatus({ id: paidTable.id, status: "available" });
      }

      refetchTables?.();

      setPaymentModalOpen(false);
    },
    [
      showNotification,
      currentTable,
      currentOrder,
      clearActiveDrafts,
      clearTableSessionState,
      setTableStatus,
      refetchTables,
      clearPaymentRequest,
      clearOrder,
      setCurrentOrder,
      setCurrentOrderCode,
      setCurrentOrderId,
      setCurrentTable,
    ],
  );

  const handleOpenPaymentRequest = useCallback(
    async (request) => {
      activePaymentRequestRef.current = request;

      const res = await loadPaymentRequestToPOS?.(request);

      if (!res?.success) {
        activePaymentRequestRef.current = null;
        showNotification(
          res?.message || "Không thể mở yêu cầu thanh toán.",
          "error",
        );
        return;
      }

      setTimeout(() => {
        setPaymentModalOpen(true);
      }, 0);
    },
    [loadPaymentRequestToPOS, showNotification],
  );

  const handleQtyChange = (e, item, change) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) return;

    const next = Math.max(1, Number(item.quantity || 1) + change);
    updateItemQty(item._lineId || item.dishId || item.id, next);
  };

  const handleQtyInput = (e, item) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) return;

    const v = Math.max(1, Number(e.target.value) || 1);
    updateItemQty(item._lineId || item.dishId || item.id, v);
  };

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) {
      showNotification(
        "Không thể xóa món đã lưu. Chỉ xóa món nháp (draft).",
        "warning",
      );
      return;
    }
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    if (itemToDelete.isExisting && !itemToDelete.isNew) {
      showNotification("Không thể xóa món đã lưu.", "warning");
      setDeleteModalOpen(false);
      setItemToDelete(null);
      return;
    }
    removeItem(itemToDelete._lineId || itemToDelete.dishId || itemToDelete.id);
    setDeleteModalOpen(false);
    setItemToDelete(null);
    showNotification("Đã xóa món", "info");
  };

  const handleClearConfirm = (action) => {
    if (action === "clear_table") {
      clearActiveDrafts();
      clearOrder();
      if (currentTable?.id && setTableStatus) {
        setTableStatus({ id: currentTable.id, status: "available" });
      }
      if (setCurrentTable) setCurrentTable(null);
      showNotification(
        currentTable?.code
          ? `Đã xóa thông tin bàn ${currentTable.code}`
          : "Đã xóa đơn",
      );
    } else {
      clearActiveDrafts();
      clearOrder();
      showNotification("Đã xóa tất cả món (giữ thông tin bàn/đơn)");
    }
    setClearModalOpen(false);
  };

  const resolveStationId = useCallback(
    (item) => {
      const itemId =
        item?.menuItem?.id || item?.dishId || item?.id || item?.menuItemId;
      const matched = (menuItems || []).find(
        (m) => String(m.id) === String(itemId),
      );
      return matched?.printStationId || "kitchen";
    },
    [menuItems],
  );

  const buildPreview = useCallback((items, title) => {
    const lines = [];
    if (title) lines.push(title);
    items.forEach((item) => {
      const qty = Number(item.quantity || 0);
      const name = item.name || item.menuItem?.name || "Món";
      const note = item.note ? ` (${item.note})` : "";
      lines.push(`${qty} x ${name}${note}`);
    });
    return lines.join("\n");
  }, []);

  const tempPreview = useMemo(() => {
    if (!hasItems) return "Không có món để in.";

    const lines = [buildPreview(currentOrder, "Tạm tính")];

    const subtotal = Number(totals?.subtotal || 0);
    const discount = Math.max(0, Number(totals?.discount || 0));
    const service = Math.max(0, Number(totals?.service || 0));
    const tax = Math.max(0, Number(totals?.tax || 0));
    const total = Number(totals?.total || totals?.grandTotal || 0);

    lines.push("");
    lines.push("------------------------------");

    if (subtotal > 0) {
      lines.push(`Tạm tính: ${formatPrice(subtotal)}`);
    }

    if (discount > 0) {
      lines.push(`Giảm giá: -${formatPrice(discount)}`);
    }

    if (service > 0) {
      lines.push(`Phí phục vụ: ${formatPrice(service)}`);
    }

    if (tax > 0) {
      lines.push(`Thuế: ${formatPrice(tax)}`);
    }

    lines.push(`Tổng cần trả: ${formatPrice(total)}`);

    if (discountBreakdown?.voucherCode) {
      lines.push(`Coupon: ${discountBreakdown.voucherCode}`);
    }

    const discountReasonLabel = formatDiscountReasonLabel(
      discountBreakdown?.discountReason,
    );

    if (discountReasonLabel) {
      lines.push(`Ưu đãi: ${discountReasonLabel}`);
    }

    return lines.filter(Boolean).join("\n");
  }, [buildPreview, currentOrder, discountBreakdown, hasItems, totals]);

  const stationPreviews = useMemo(() => {
    const groups = {};
    (currentOrder || []).forEach((item) => {
      const stationId = resolveStationId(item);
      if (!groups[stationId]) groups[stationId] = [];
      groups[stationId].push(item);
    });
    return PRINT_STATIONS.map((station) => {
      const items = groups[station.id] || [];
      const mappedPrinters = (printStations?.[station.id] || [])
        .map((pid) => printers?.[pid])
        .filter(Boolean);
      const fallbackPrinters = mappedPrinters;
      return {
        id: station.id,
        label: station.label,
        preview: items.length ? buildPreview(items, station.label) : "",
        printers: fallbackPrinters,
        items,
      };
    });
  }, [buildPreview, currentOrder, printers, printStations, resolveStationId]);

  const toLocalQueueJob = useCallback(
    ({ source, statusOverride }) => ({
      id: source.id,
      label: source.stationId
        ? PRINT_STATIONS.find((s) => s.id === source.stationId)?.label ||
          source.printType
        : source.printType,
      printerId: source.printerId || null,
      printerName: source.printerName || null,
      count: Number(source?.payload?.count || 0),
      items: source?.payload?.items || [],
      table: source?.payload?.table || currentTable?.code || "Đơn",
      status: statusOverride || source.status || "pending",
      type: source.printType,
    }),
    [currentTable?.code],
  );

  const persistPrintJobs = useCallback(
    async ({ mode, status }) => {
      if (!restaurantId) {
        showNotification("Thiếu restaurantId để tạo print job.", "error");
        return [];
      }

      const requests = [];
      if (mode === "temp") {
        if (!selectedPrinter) {
          showNotification("Vui lòng chọn máy in tạm tính.", "warning");
          return [];
        }
        requests.push({
          printer: selectedPrinter,
          stationId: "cashier",
          printType: status === "printing" ? "temp_print_now" : "temp_queue",
          templateKey: "receipt",
          payload: {
            table: currentTable?.code || "Đơn",
            count: (currentOrder || []).length,
            items: currentOrder || [],
          },
        });
      } else {
        stationPreviews.forEach((station) => {
          if (!station.items.length) return;
          if (!station.printers.length) {
            showNotification(
              `Chưa gán máy in cho ${station.label}.`,
              "warning",
            );
            return;
          }
          station.printers.forEach((printer) => {
            requests.push({
              printer,
              stationId: station.id,
              printType:
                status === "printing" ? "station_print_now" : "station_queue",
              templateKey: station.id,
              payload: {
                table: currentTable?.code || "Đơn",
                count: station.items.length,
                items: station.items,
              },
            });
          });
        });
      }

      if (!requests.length) {
        showNotification("Không có món để in.", "warning");
        return [];
      }

      const results = await Promise.all(
        requests.map(async (req) => {
          const res = await enqueuePrintJob({
            variables: {
              input: {
                restaurantId,
                printerId: req.printer?.id || null,
                stationId: req.stationId,
                printType: req.printType,
                templateKey: req.templateKey,
                payload: req.payload,
              },
            },
          });
          return toLocalQueueJob({
            source: res?.data?.enqueuePrintJob || {},
            statusOverride: status,
          });
        }),
      );

      setPrintQueue((prev) => [...prev, ...results]);
      return results;
    },
    [
      currentOrder,
      currentTable?.code,
      enqueuePrintJob,
      restaurantId,
      selectedPrinter,
      setPrintQueue,
      showNotification,
      stationPreviews,
      toLocalQueueJob,
    ],
  );

  const handleAddToQueue = useCallback(
    async (mode) => {
      if (!hasItems) return;
      try {
        const jobs = await persistPrintJobs({ mode, status: "pending" });
        if (jobs.length)
          showNotification("Đã thêm vào hàng đợi in (đã lưu DB).", "success");
      } catch (err) {
        showNotification(
          err?.message || "Không thể enqueue print job vào DB.",
          "error",
        );
      }
    },
    [hasItems, persistPrintJobs, showNotification],
  );

  const handlePrintNow = useCallback(
    async (mode) => {
      if (!hasItems) return;
      try {
        const jobs = await persistPrintJobs({ mode, status: "printing" });
        if (jobs.length) {
          showNotification(
            mode === "temp"
              ? "Đang in tạm tính (DB job simulated)..."
              : "Đang in theo quầy (DB job simulated)...",
            "info",
          );
        }
      } catch (err) {
        showNotification(
          err?.message || "Không thể tạo print job để in ngay.",
          "error",
        );
      }
    },
    [hasItems, persistPrintJobs, showNotification],
  );

  const handleItemClick = (item) => {
    const modalItemData = {
      ...item,
      id: item.dishId || item.id,
      thumbImage: item.image,
    };
    setSelectedDetailItem(modalItemData);
    setDetailModalOpen(true);
  };

  const validateBeforeConfirm = useCallback(() => {
    if (!hasItems) {
      showNotification("Đơn đang trống.", "warning");
      return { ok: false };
    }

    if (newItems.length === 0) {
      showNotification("Không có món mới (draft) để lưu.", "warning");
      return { ok: false };
    }

    if (currentOrderType === "dine_in") {
      if (!currentTable?.code) {
        showNotification("Vui lòng chọn bàn trước khi lưu.", "error");
        return { ok: false };
      }
      return { ok: true };
    }

    const name = (
      shippingInfo?.fullName ||
      deliveryCustomer?.name ||
      deliveryCustomer?.fullName ||
      ""
    ).trim();
    const phone = (shippingInfo?.phone || deliveryCustomer?.phone || "").trim();
    const addr = (shippingInfo?.address || "").trim();

    if (currentOrderType === "delivery") {
      if (!name && !phone) {
        showNotification(
          "Vui lòng chọn/nhập thông tin khách hàng trước khi lưu đơn giao hàng.",
          "error",
        );
        return { ok: false };
      }

      if (!addr) {
        showNotification("Đơn giao hàng bắt buộc phải có địa chỉ.", "error");
        return { ok: false };
      }
    }

    return { ok: true };
  }, [
    hasItems,
    newItems.length,
    currentOrderType,
    currentTable?.code,
    shippingInfo,
    deliveryCustomer,
    currentOrderCode,
    showNotification,
  ]);

  const handleOpenConfirm = useCallback(() => {
    const v = validateBeforeConfirm();
    if (!v.ok) return;
    setConfirmOpen(true);
  }, [validateBeforeConfirm]);
  const resetOffPremiseAfterSave = useCallback(() => {
    clearActiveDrafts();
    clearOrder?.();
    setCurrentOrder?.([]);
    setCurrentTable?.(null);
    setCurrentOrderCode?.(null);
    setCurrentOrderId?.(null);
    setDeliveryCustomer?.(null);
    setShippingInfo?.({
      fullName: "",
      phone: "",
      email: "",
      address: "",
      note: "",
      deliveryMethod:
        currentOrderType === "takeaway" ? "pickup_at_store" : "ship_now",
      deliveryTime: "",
      scheduleDate: "",
      scheduleTime: "",
    });
  }, [
    clearActiveDrafts,
    clearOrder,
    setCurrentOrder,
    setCurrentTable,
    setCurrentOrderCode,
    setCurrentOrderId,
    setDeliveryCustomer,
    setShippingInfo,
    currentOrderType,
  ]);
  const handleConfirmSave = useCallback(async () => {
    if (saving) return;

    const v = validateBeforeConfirm();
    if (!v.ok) return;
    if (shouldBlockSaveForDiscount) {
      showNotification(
        "Vui lòng áp dụng coupon hợp lệ trước khi lưu đơn.",
        "error",
      );
      return;
    }
    setSaving(true);
    try {
      if (
        (currentOrderType === "delivery" || currentOrderType === "takeaway") &&
        !currentOrderCode &&
        hasItems
      ) {
        await ensureOffPremiseSession?.(currentOrderType, { force: true });
      }
      const res = await saveOrder?.({
        persist: true,
        pricing:
          isOffPremise && discountBreakdown
            ? buildDiscountPricingInput({
                taxRate: 0,
                serviceRate: 0,
                shippingFee: discountShippingFee,
                couponCode,
              })
            : {},
        promotionIds:
          isOffPremise && discountBreakdown ? selectedPromotionIds : [],
      });

      if (res?.success) {
        setPulse(true);
        setTimeout(() => setPulse(false), 650);

        clearOffPremiseDraft?.(currentOrderType);

        if (currentOrderType === "dine_in" && currentTable?.code) {
          showNotification(
            `Đã lưu vào bàn ${currentTable.code}`,
            "success",
            2500,
          );
        } else if (currentOrderType === "delivery") {
          showNotification(
            `Đã lưu đơn giao hàng (${currentOrderCode})`,
            "success",
            2500,
          );
        } else if (currentOrderType === "takeaway") {
          showNotification(
            `Đã lưu đơn mang đi (${currentOrderCode})`,
            "success",
            2500,
          );
        } else {
          showNotification("Đã lưu đơn.", "success", 2500);
        }
        if (
          currentOrderType === "delivery" ||
          currentOrderType === "takeaway"
        ) {
          resetOffPremiseAfterSave();
        }
        setConfirmOpen(false);
      } else {
        if (Array.isArray(res?.errors) && res.errors.length > 0) {
          res.errors.forEach((msg) => showNotification(String(msg), "error"));
          console.error("POS save errors:", res.errors);
        }
        showNotification(res?.message || "Lưu đơn thất bại.", "error");
      }
    } catch (e) {
      console.error("POS save exception:", e);
      showNotification(e?.message || "Lưu đơn thất bại.", "error");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    validateBeforeConfirm,
    saveOrder,

    currentOrderType,
    currentTable?.code,
    showNotification,
    currentOrderCode,
    resetOffPremiseAfterSave,
  ]);

  const saveDisabled = saving || !hasItems || newItems.length === 0;
  const groupedPaymentRequests = useMemo(
    () =>
      groupPaymentRequests(
        Array.isArray(paymentRequests) ? paymentRequests : [],
      ),
    [paymentRequests],
  );

  const transferQueue = transferQueueData?.transferPaymentQueue || [];
  const handleVerifyTransfer = async () => {
    if (!transferVerifyDraft?.id) return;
    try {
      await verifyTransferPayment({ variables: { input: { paymentSessionId: transferVerifyDraft.id, receivedAmount: Number(transferVerifyDraft.receivedAmount || 0), providerTransactionId: transferVerifyDraft.providerTransactionId || undefined, note: transferVerifyDraft.note || "Tôi xác nhận đã nhận đủ tiền chuyển khoản cho đơn này." } } });
      showNotification("Đã xác nhận chuyển khoản và release đơn.", "success");
      setTransferVerifyDraft(null);
      refetchTransferQueue?.();
    } catch (err) { showNotification(err?.message || "Không thể xác nhận chuyển khoản.", "error"); }
  };
  const handleRejectTransfer = async () => {
    if (!transferRejectDraft?.id) return;
    const reason = String(transferRejectDraft.reason || "").trim();
    if (reason.length < 3) { showNotification("Vui lòng nhập lý do từ chối ít nhất 3 ký tự.", "warning"); return; }
    try {
      await rejectTransferPayment({ variables: { input: { paymentSessionId: transferRejectDraft.id, reason } } });
      showNotification("Đã từ chối minh chứng và thông báo khách.", "success");
      setTransferRejectDraft(null);
      refetchTransferQueue?.();
    } catch (err) { showNotification(err?.message || "Không thể từ chối minh chứng.", "error"); }
  };

  const renderTransferQueuePanel = () => (
    <section className={cls.transferReviewPanel}>
      <div className={cls.transferReviewHeader}>
        <div><h3>POS chuyển khoản chờ xác minh</h3><p>Kiểm tra minh chứng, gọi khách hoặc xác nhận đã nhận tiền.</p></div>
        <span>{transferQueue.length} phiên</span>
      </div>
      {!transferQueue.length ? <p className={cls.transferReviewEmpty}>Không có chuyển khoản cần POS xử lý.</p> : transferQueue.map((payment) => {
        const meta = payment.metadata || {}; const transfer = payment.transfer || {};
        const phone = meta.customerPhone || meta.shippingPhone || "";
        const rejected = Number(transfer.rejectedCount || 0); const max = Number(transfer.maxRejectedCount || 3);
        return <article key={payment.id} className={cls.transferReviewCard}>
          <div className={cls.transferReviewTop}><strong>{payment.reference}</strong><span>{transfer.status}</span></div>
          <div className={cls.transferReviewMeta}><span>{formatPrice(payment.amount)}</span><span>{meta.customerName || "Khách hàng"}</span><span>{phone || "Chưa có SĐT"}</span></div>
          <div className={cls.transferReviewMeta}><span>{(meta.orderCodes || []).join(", ") || "Chưa có mã đơn"}</span><span>Còn {Math.max(max - rejected, 0)} lần gửi lại</span></div>
          {transfer.proofNote ? <p className={cls.transferProofNote}>{transfer.proofNote}</p> : null}
          {Array.isArray(transfer.proofImages) && transfer.proofImages.length ? <div className={cls.transferProofImages}>{transfer.proofImages.map((src, idx) => <a key={`${src}-${idx}`} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Minh chứng chuyển khoản ${idx + 1}`} /></a>)}</div> : null}
          <div className={cls.transferReviewActions}>
            {phone ? <a className={cls.transferCallBtn} href={`tel:${phone}`}>Gọi ngay</a> : <button className={cls.transferCallBtn} type="button" disabled>Chưa có số điện thoại khách hàng</button>}
            <button type="button" className={cls.transferVerifyBtn} onClick={() => setTransferVerifyDraft({ id: payment.id, receivedAmount: payment.amount })}>Xác nhận chuyển khoản thành công</button>
            <button type="button" className={cls.transferRejectBtn} onClick={() => setTransferRejectDraft({ id: payment.id, remaining: Math.max(max - rejected - 1, 0) })}>Từ chối minh chứng</button>
          </div>
        </article>;
      })}
    </section>
  );

  return (
    <div
      className={`${cls.wrapper} ${pulse ? cls.pulse : ""}`}
      data-pos-order-panel
      data-kind={isOffPremise ? offPremiseKind : "DINE"}
    >
      {renderTransferQueuePanel()}
      {isOffPremise && (
        <div className={cls.discountBox}>
          <div className={cls.discountTitle}>Ưu đãi / coupon</div>

          <div className={cls.discountRow}>
            <input
              className={cls.discountInput}
              value={couponCode}
              placeholder="Nhập mã coupon"
              onChange={(event) => setCouponCode(event.target.value)}
            />
            <button
              type="button"
              className={cls.smallBtn}
              onClick={handleApplyDiscountPreview}
              disabled={isPreviewingDiscount || !couponCode.trim()}
            >
              {isPreviewingDiscount ? "Đang kiểm..." : "Áp dụng"}
            </button>
          </div>
          {activePromotions.length > 0 && (
            <div className={cls.promotionRow}>
              <label className={cls.promotionLabel}>
                Chương trình khuyến mãi
              </label>
              <select
                className={cls.promotionSelect}
                value={selectedPromotionId}
                onChange={(event) =>
                  setSelectedPromotionIds(
                    event.target.value ? [event.target.value] : [],
                  )
                }
                disabled={isPreviewingDiscount || promotionsLoading}
              >
                <option value="">Không áp dụng promotion</option>
                {activePromotions.map((promotion) => (
                  <option key={promotion.id} value={promotion.id}>
                    {promotion.name}
                    {promotion.code ? ` · ${promotion.code}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {discountError && (
            <div className={cls.discountError}>{discountError}</div>
          )}

          {couponCode && !discountBreakdown && !discountError && (
            <div className={cls.discountWarning}>
              Vui lòng áp dụng coupon trước khi lưu đơn.
            </div>
          )}

          {discountBreakdown && (
            <>
              <div className={cls.discountSuccess}>
                Đã áp dụng ưu đãi. Tổng giảm{" "}
                {Number(discountBreakdown.totalDiscount || 0).toLocaleString(
                  "vi-VN",
                )}
                đ
              </div>

              {promotionLineItems.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Ưu đãi theo món
                  </div>

                  {promotionLineItems.map((line) => (
                    <div
                      key={line.key}
                      style={{
                        fontSize: 13,
                        color: "#475569",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      <span>
                        {line.itemName} · {line.promotionName}
                      </span>
                      <strong
                        style={{
                          color: "#16a34a",
                          whiteSpace: "nowrap",
                        }}
                      >
                        -{formatPrice(line.discount)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
              {promotionBreakdownRows.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                    Chi tiết khuyến mãi
                  </div>
                  {promotionBreakdownRows.map((row) => (
                    <div key={row.key} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span>
                        {row.type} · {row.label} · {row.source}
                        {row.itemName ? ` · ${row.itemName}` : ""}
                      </span>
                      <strong style={{ color: "#16a34a" }}>
                        -{formatPrice(row.discountAmount)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {transferVerifyDraft && <div className={cls.transferModalBackdrop}><div className={cls.transferModal}><h3>Xác nhận đã nhận chuyển khoản</h3><p>Tôi xác nhận đã nhận đủ tiền chuyển khoản cho đơn này.</p><label>Số tiền thực nhận<input type="number" value={transferVerifyDraft.receivedAmount} onChange={(e)=>setTransferVerifyDraft({...transferVerifyDraft, receivedAmount:e.target.value})} /></label><label>Mã giao dịch ngân hàng<input value={transferVerifyDraft.providerTransactionId || ""} onChange={(e)=>setTransferVerifyDraft({...transferVerifyDraft, providerTransactionId:e.target.value})} /></label><label>Ghi chú xác nhận<textarea value={transferVerifyDraft.note || ""} onChange={(e)=>setTransferVerifyDraft({...transferVerifyDraft, note:e.target.value})} /></label><div><button type="button" onClick={()=>setTransferVerifyDraft(null)}>Hủy</button><button type="button" onClick={handleVerifyTransfer}>Xác nhận & release đơn</button></div></div></div>}
      {transferRejectDraft && <div className={cls.transferModalBackdrop}><div className={cls.transferModal}><h3>Từ chối minh chứng</h3><p>Lý do này sẽ hiển thị cho khách để họ gửi lại đúng thông tin. Sau 3 lần bị từ chối, phiên thanh toán sẽ dừng để tránh giữ đơn quá lâu.</p><label>Lý do từ chối *<textarea value={transferRejectDraft.reason || ""} onChange={(e)=>setTransferRejectDraft({...transferRejectDraft, reason:e.target.value})} /></label><small>Còn {transferRejectDraft.remaining} lần gửi lại sau thao tác này.</small><div><button type="button" onClick={()=>setTransferRejectDraft(null)}>Hủy</button><button type="button" onClick={handleRejectTransfer}>Từ chối minh chứng</button></div></div></div>}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        totalAmount={
          finalTotals?.total ||
          activePaymentRequestRef.current?.totals?.grandTotal ||
          0
        }
        order={currentOrder}
        table={currentTable}
        onConfirm={() => {}}
        onComplete={handlePaymentComplete}
      />

      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        receiptData={receiptData}
        restaurantId={restaurantId || currentTable?.restaurantId}
        table={receiptData?.table || currentTable}
        fallbackItems={receiptData?.fallbackItems || currentOrder}
        onClose={() => setReceiptModalOpen(false)}
        onFinish={() => {
          setReceiptModalOpen(false);
          setReceiptData(null);
        }}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteItem}
        requireReason={false}
      />

      <ConfirmDeleteModal
        isOpen={isClearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearConfirm}
        showScopeChoice={true}
      />

      <MenuItemModal
        isOpen={detailModalOpen}
        item={selectedDetailItem}
        onClose={() => setDetailModalOpen(false)}
        isReviewMode={true}
      />

      <OrderConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        isSaving={saving}
        orderType={currentOrderType}
        orderCode={currentOrderCode}
        tableCode={
          isRealTableCode(currentOrderType, currentTable?.code)
            ? String(currentTable.code).trim()
            : null
        }
        totals={finalTotals}
        newItems={newItems}
        shippingInfo={shippingInfo}
        deliveryCustomer={deliveryCustomer}
      />

      <div className={cls.header}>
        <div className={cls.headerLeft}>
          <div className={cls.tableName}>{headerTitle}</div>

          <div className={cls.tableMeta}>
            {headerMeta.line1}
            {headerMeta.line1 && headerMeta.line2 ? " · " : ""}
            <span className={cls.statusBadge}>{headerMeta.line2}</span>
          </div>

          {newItems.length > 0 && (
            <div className={cls.draftLegend}>
              <span className={cls.legendIcon}>
                <IconDraft />
              </span>
              <span className={cls.legendText}>Món mới (chưa lưu)</span>
            </div>
          )}
          {groupedPaymentRequests.length > 0 && (
            <div className={cls.draftLegend}>
              <span className={cls.legendText}>
                Khách gọi thanh toán ({groupedPaymentRequests.length})
              </span>

              <div>
                {groupedPaymentRequests.slice(0, 3).map((req) => {
                  const tableLikeLabel = getPaymentRequestGroupLabel(req);

                  return (
                  <div key={req.groupKey}>
                    {tableLikeLabel}
                    {" · "}
                    {formatPrice(req?.totals?.grandTotal || 0)}

                    {req.isTableGroup && req.orderCodes.length > 1 && (
                      <span style={{ marginLeft: 6, color: "#64748b" }}>
                        ({req.orderCodes.length} lượt gọi)
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenPaymentRequest(req)}
                      style={{ marginLeft: 8 }}
                    >
                      Mở thanh toán
                    </button>
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={cls.headerRight}>
          <div className={cls.menuWrapper} ref={menuRef}>
            <button
              className={`${cls.manageBtn} ${isMenuOpen ? cls.active : ""}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Tùy chọn quản lý"
            >
              <IconSettings /> Quản lý
            </button>
            {isMenuOpen && (
              <div className={cls.dropdownMenu}>
                <div
                  className={cls.dropdownItem}
                  onClick={() => handleMenuNavigate("/manager")}
                >
                  <IconDashboard /> Dashboard
                </div>
                <div
                  className={cls.dropdownItem}
                  onClick={() => handleMenuNavigate("/manager#orders")}
                >
                  <IconOrderList /> Order
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cls.body}>
        {newItems.length > 0 && (
          <div className={cls.sectionNew}>
            <div className={cls.groupHeader}>
              Món mới chưa gửi bếp ({newItems.length})
            </div>
            <div className={cls.itemsList}>
              {newItems.map((item) => (
                <div
                  key={item._lineId || item.dishId || item.id}
                  className={`${cls.cardNew} ${cls.cardNewAnim}`}
                  onClick={() => handleItemClick(item)}
                >
                  {item.isNew && (
                    <span className={cls.draftBadge} title="Món mới – chưa lưu">
                      <IconDraft />
                    </span>
                  )}

                  <div className={cls.rowTop}>
                    <div className={cls.cardName}>
                      {item.name}
                      {item.proofImages && item.proofImages.length > 0 && (
                        <span className={cls.iconProof} title="Có ảnh xác nhận">
                          <IconImage />
                        </span>
                      )}
                    </div>

                    <button
                      className={cls.btnDelete}
                      onClick={(e) => handleDeleteClick(e, item)}
                      title="Xóa"
                    >
                      <IconTrash />
                    </button>
                  </div>

                  {(item.method ||
                    item.cookingOption ||
                    item.note ||
                    item.priority) && (
                    <div className={cls.rowNote}>
                      {item.method || item.cookingOption ? (
                        <span className={cls.tagMethod}>
                          {item.method || item.cookingOption}
                        </span>
                      ) : null}
                      {item.priority && (
                        <span className={cls.tagMethod}>
                          {PRIORITY_LABELS[
                            String(item.priority).toUpperCase()
                          ] || item.priority}
                        </span>
                      )}
                      {item.note && (
                        <span className={cls.textNote}>{item.note}</span>
                      )}
                    </div>
                  )}

                  <div className={cls.rowBottom}>
                    <div className={cls.priceSingle}>{getItemPrice(item)}</div>

                    <div
                      className={cls.qtyWrapper}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={cls.qtyBtn}
                        onClick={(e) => handleQtyChange(e, item, -1)}
                      >
                        −
                      </button>
                      <input
                        className={cls.qtyInput}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQtyInput(e, item)}
                      />
                      <button
                        className={cls.qtyBtn}
                        onClick={(e) => handleQtyChange(e, item, +1)}
                      >
                        +
                      </button>
                    </div>

                    <div className={cls.cardTotal}>{getItemTotal(item)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {existingItems.length > 0 && (
          <div className={cls.sectionExisting}>
            <div className={cls.dividerLabel}>
              Đã gửi bếp ({existingItems.length})
            </div>
            {groupedExistingBatches.map((batch, batchIdx) => (
              <div key={batch.key || `batch_${batchIdx}`}>
                <div className={cls.batchHeader}>
                  <div className={cls.batchTitle}>
                    Đợt {batch.batchIndex || batchIdx + 1}
                  </div>

                  <div className={cls.batchMeta}>
                    {batch.orderCode && (
                      <span className={cls.batchCode}>
                        {shortOrderCode(batch.orderCode)}
                      </span>
                    )}

                    {batch.status && (
                      <span
                        className={`${cls.batchStatus} ${cls[`status_${String(batch.status).toLowerCase()}`] || ""}`}
                      >
                        {getOrderStatusLabel(batch.status)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={cls.itemsList}>
                  {batch.items.map((item) => (
                    <div
                      key={item._lineId || item.dishId || item.id}
                      className={cls.cardExisting}
                      onClick={() => handleItemClick(item)}
                    >
                      <div className={cls.rowTop}>
                        <div className={cls.cardName}>
                          {item.name}
                          {item.proofImages && item.proofImages.length > 0 && (
                            <span
                              className={cls.iconProof}
                              title="Có ảnh xác nhận"
                            >
                              <IconImage />
                            </span>
                          )}
                        </div>
                        {(item.sourceOrderCreatedAt || item.createdAt) && (
                          <span className={cls.timeTag}>
                            {formatTime(
                              item.sourceOrderCreatedAt || item.createdAt,
                            )}
                          </span>
                        )}
                      </div>
                      {(item.note ||
                        item.method ||
                        item.cookingOption ||
                        item.priority) && (
                        <div className={cls.rowNote}>
                          {(item.method || item.cookingOption) && (
                            <span className={cls.tagMethod}>
                              {item.method || item.cookingOption}
                            </span>
                          )}
                          {item.priority && (
                            <span className={cls.tagMethod}>
                              {PRIORITY_LABELS[
                                String(item.priority).toUpperCase()
                              ] || item.priority}
                            </span>
                          )}
                          {item.note && (
                            <span className={cls.textNoteSaved}>
                              {item.note}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={cls.rowBottom}>
                        <div className={cls.priceSingle}>
                          {getItemPrice(item)}
                        </div>
                        <div className={cls.qtyStatic}>
                          {formatOrderItemQuantity(item)}
                        </div>
                        <div className={cls.cardTotal}>
                          {getItemTotal(item)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasItems && (
          <div className={cls.emptyState}>
            <p>Trống</p>
          </div>
        )}
      </div>

      <div className={cls.footer}>
        <div className={cls.summary}>
          <div className={cls.row}>
            <span>Tạm tính:</span>
            <strong>{formatPrice(displaySubtotal || 0)}</strong>
          </div>

          <button
            type="button"
            className={cls.breakdownToggle}
            onClick={() => setShowBreakdown((v) => !v)}
          >
            {showBreakdown ? "Thu gọn ▲" : "Chi tiết ▼"}
          </button>

          {showBreakdown && (
            <div id="totals-breakdown" className={cls.breakdown}>
              {breakdownRows.map((r) => (
                <div
                  key={r.label}
                  className={`${cls.breakdownRow} ${cls[r.clsName] || ""}`}
                >
                  <span>{r.label}</span>
                  <span>{formatPrice(Number(r.value) || 0)}</span>
                </div>
              ))}
              <div className={cls.hr} />
            </div>
          )}

          <div className={`${cls.row} ${cls.grand}`}>
            <span>Tổng cộng:</span>
            <strong>{formatPrice(displayGrandTotal || 0)}</strong>
          </div>
        </div>

        <div className={cls.actionsGrid}>
          <button
            className={`${cls.btn} ${cls.secondary}`}
            onClick={() => setClearModalOpen(true)}
            disabled={!hasItems || saving}
          >
            Xóa
          </button>

          <button
            className={`${cls.btn} ${cls.primary}`}
            onClick={handleOpenConfirm}
            disabled={saveDisabled}
            aria-busy={saving}
            title={
              !hasItems
                ? "Đơn trống"
                : newItems.length === 0
                  ? "Không có món nháp để lưu"
                  : saving
                    ? "Đang lưu..."
                    : ""
            }
          >
            {saving ? (
              <span className={cls.btnLoading}>
                <span className={cls.spinner} />
                Đang lưu...
              </span>
            ) : (
              "Lưu"
            )}
          </button>

          <button
            className={`${cls.btn} ${cls.success}`}
            disabled={!hasItems || saving}
            onClick={openPaymentModal}
          >
            Thanh toán
          </button>

          <button
            className={`${cls.btn} ${cls.warning}`}
            onClick={() => setPrintModalOpen(true)}
            disabled={!hasItems || saving}
          >
            In
          </button>
        </div>
      </div>

      <PrintModal
        isOpen={isPrintModalOpen}
        mode={printMode}
        printers={printerList}
        selectedPrinter={selectedPrinter}
        tempPreview={tempPreview}
        stationPreviews={stationPreviews}
        onChangeMode={setPrintMode}
        onPickPrinter={setSelectedPrinter}
        onAddQueue={() => handleAddToQueue(printMode)}
        onPrintNow={() => handlePrintNow(printMode)}
        onOpenQueue={() => setPrintQueueOpen(true)}
        onClose={() => setPrintModalOpen(false)}
      />

      <PrintQueueModal
        isOpen={isPrintQueueOpen}
        queue={printQueue}
        onClearAll={() => setPrintQueue([])}
        onPrintAll={() => handlePrintNow("stations")}
        onClose={() => setPrintQueueOpen(false)}
      />
    </div>
  );
}
