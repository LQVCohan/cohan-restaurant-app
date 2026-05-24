// src/components/Dashboard_Manager/POS/components/panels/modals/PaymentModal.jsx
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import s from "./PaymentModal.module.scss";
import { formatPrice } from "@/utils/formatters";
import useOrderManagement from "@/hooks/useOrderManagement";
import { usePos } from "@/context/PosContext";
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";
import { convertCurrencyAmount } from "@/utils/currency";
import useModalKeyboardClose from "./useModalKeyboardClose";
import { groupItemsByBatch } from "@/utils/orderBatchGrouping";
import {
  getDiscountPreviewErrorMessage,
  useDiscountPreview,
} from "@/hooks/useDiscountPreview";
import {
  buildDiscountPricingInput,
  buildOrderDiscountPreviewInput,
  getDiscountBreakdownTotal,
} from "@/utils/discountPreviewPayload";
import { formatDiscountReasonLabel } from "@/utils/discountDisplay";
import {
  getPromotionSourceLabel,
  getPromotionTypeLabel,
} from "@/utils/discountDisplay";

import { useActiveDiscountPromotions } from "@/hooks/useActiveDiscountPromotions";
const QRCodePlaceholder = ({ value }) => (
  <div className={s.qrImage}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="140"
      height="140"
    >
      <rect width="100" height="100" fill="#f0f9ff" />
      <text
        x="50"
        y="50"
        dy=".3em"
        textAnchor="middle"
        fontSize="10"
        fill="#0c4a6e"
      >
        QR Placeholder
      </text>
      <text
        x="50"
        y="65"
        dy=".3em"
        textAnchor="middle"
        fontSize="8"
        fill="#0284c7"
      >
        {value}
      </text>
    </svg>
  </div>
);
const statusCopyMap = {
  pending: "Đang chờ hệ thống xác nhận thanh toán tự động...",
  success: "Đã nhận thanh toán. Hóa đơn đang được hoàn tất.",
  failed: "Thanh toán không thành công hoặc đã hết hạn.",
  cancelled: "Thanh toán không thành công hoặc đã hết hạn.",
  canceled: "Thanh toán không thành công hoặc đã hết hạn.",
  expired: "Thanh toán không thành công hoặc đã hết hạn.",
};
const statusBadgeMap = {
  pending: { label: "Đang chờ xác nhận", className: "pending" },
  success: { label: "Đã thanh toán", className: "success" },
  failed: { label: "Không thành công", className: "failed" },
  cancelled: { label: "Không thành công", className: "failed" },
  canceled: { label: "Không thành công", className: "failed" },
  expired: { label: "Không thành công", className: "failed" },
};

function PaymentModal({
  isOpen,
  order,
  table,
  onClose,
  onConfirm,
  onComplete,
  totalAmount,
}) {
  const [method, setMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [selectedPromotionIds, setSelectedPromotionIds] = useState([]);
  const [discountBreakdown, setDiscountBreakdown] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountNeedsReapply, setDiscountNeedsReapply] = useState(false);
  const [onlinePayment, setOnlinePayment] = useState(null);
  const [onlinePaymentError, setOnlinePaymentError] = useState("");
  const [copyFallback, setCopyFallback] = useState("");

  const pos = usePos?.() || null;
  const effectiveOrderId = pos?.currentOrderId || order?.[0]?.orderId || null;
  const restaurantId =
    table?.restaurantId ||
    table?.restaurant_id ||
    pos?.currentTable?.restaurantId ||
    null;
  const isDineIn =
    !pos?.currentOrderType || pos?.currentOrderType === "dine_in";

  const { activeCurrency, setActiveCurrency, usdToVndRate } =
    useRestaurantCurrency(restaurantId);
  const { validatePayment, confirmPayment, payLoading, createOnlineOrderPayment, cancelOnlinePaymentSession, getPaymentSession, resolvePayableOrderIds } =
    useOrderManagement(pos);
  const { previewOrderDiscount, loading: isPreviewingDiscount } =
    useDiscountPreview();
  const { promotions: activePromotions, loading: promotionsLoading } =
    useActiveDiscountPromotions(restaurantId, {
      skip: !isDineIn,
    });

  const selectedPromotionId = selectedPromotionIds[0] || "";
  const busy = Boolean(payLoading);
  const groupedBatches = groupItemsByBatch(order || []);
  const orderSignature = useMemo(
    () =>
      JSON.stringify(
        (order || []).map((item) => [
          item?._lineId || item?.dishId || item?.id || item?.name || "item",
          Number(item?.quantity || 0),
          Number(item?.price ?? item?.unitPrice ?? item?.basePrice ?? 0),
          Number(item?.modifiersPrice || 0),
        ]),
      ),
    [order],
  );
  const hasCouponInput = couponCode.trim().length > 0;
  const baseTotalAmountVnd = Number(totalAmount || 0);
  const payableTotalVnd = getDiscountBreakdownTotal(
    discountBreakdown,
    baseTotalAmountVnd,
  );
  const convertedPayableTotal = convertCurrencyAmount(
    payableTotalVnd,
    "VND",
    activeCurrency,
    usdToVndRate,
  );
  const changeAmount = Math.max(
    0,
    (Number(paidAmount) || 0) - convertedPayableTotal,
  );
  const previewInput = useMemo(() => {
    if (!restaurantId || !isDineIn) return null;

    return buildOrderDiscountPreviewInput({
      restaurantId,
      orderType: "dine_in",
      items: order || [],
      taxRate: 0,
      serviceRate: 0,
      shippingFee: 0,
      couponCode,
      promotionIds: selectedPromotionIds,
    });
  }, [restaurantId, isDineIn, order, couponCode, selectedPromotionIds]);
  const breakdownRows = useMemo(() => {
    const source = discountBreakdown || {
      subtotal: baseTotalAmountVnd,
      totalDiscount: 0,
      service: 0,
      tax: 0,
      grandTotal: baseTotalAmountVnd,
    };

    return [
      {
        label: "Tạm tính",
        value: Number(source?.subtotal || baseTotalAmountVnd),
      },
      {
        label: "Giảm coupon",
        value: Number(source?.couponDiscount || source?.voucherDiscount || 0),
        negative: true,
      },
      {
        label: "Giảm promotion",
        value: Number(source?.promotionDiscount || 0),
        negative: true,
      },
      {
        label: "Giảm vận chuyển",
        value: Number(source?.shippingDiscount || 0),
        negative: true,
      },
      {
        label: "Tổng giảm",
        value: Number(
          source?.totalDiscount ??
            source?.discount ??
            source?.voucherDiscount ??
            0,
        ),
        negative: true,
      },
      { label: "Phí phục vụ", value: Number(source?.service || 0) },
      { label: "Thuế", value: Number(source?.tax || 0) },
      {
        label: "Tổng cần trả",
        value: Number(payableTotalVnd || 0),
        total: true,
      },
    ];
  }, [discountBreakdown, baseTotalAmountVnd, payableTotalVnd]);
  const promotionLineItems = useMemo(
    () =>
      Array.isArray(discountBreakdown?.promotionLines)
        ? discountBreakdown.promotionLines
            .filter((line) => Number(line?.discount || 0) > 0)
            .map((line, index) => ({
              key:
                line?.lineId ||
                `${line?.promotionId || "promotion"}_${line?.dishId || index}`,
              itemName: String(line?.name || "").trim() || "Món áp dụng",
              promotionName:
                String(line?.promotionName || "").trim() || "Khuyến mãi",
              discount: Math.abs(Number(line?.discount || 0)),
            }))
        : [],
    [discountBreakdown?.promotionLines],
  );
  const promotionBreakdownRows = useMemo(() => {
    const fromBreakdown = Array.isArray(discountBreakdown?.appliedPromotionBreakdown)
      ? discountBreakdown.appliedPromotionBreakdown
      : Array.isArray(discountBreakdown?.promotionLines)
        ? discountBreakdown.promotionLines
        : [];
    return fromBreakdown
      .map((row, index) => ({
        key: row?.id || row?.lineId || `${row?.promotionId || "promo"}_${index}`,
        type: getPromotionTypeLabel(row?.type || row?.promotionType),
        name: row?.promotionName || row?.name || row?.promotionCode || "Khuyến mãi",
        code: row?.promotionCode || row?.code || "",
        source: getPromotionSourceLabel(row?.source),
        itemName: row?.itemName || row?.name || "",
        discountAmount: Math.abs(Number(row?.discountAmount ?? row?.discount ?? 0)),
      }))
      .filter((row) => row.discountAmount > 0);
  }, [discountBreakdown]);
  const hasValidDiscount = Boolean(
    isDineIn &&
    discountBreakdown &&
    !discountNeedsReapply &&
    !discountError &&
    (hasCouponInput || selectedPromotionIds.length > 0),
  );
  const discountBlocksPayment = Boolean(
    isDineIn &&
    hasCouponInput &&
    (!discountBreakdown || discountNeedsReapply || discountError),
  );

  useEffect(() => {
    if (!isOpen) return;

    setIsConfirming(false);
    if (method === "card" || method === "transfer") {
      setPaidAmount(convertedPayableTotal || 0);
    }
  }, [method, isOpen, convertedPayableTotal]);

  useEffect(() => {
    if (!isOpen) return;

    if (method === "cash") {
      setPaidAmount(0);
    }
  }, [method, isOpen]);

  useEffect(() => {
    if (!isDineIn) {
      setCouponCode("");
      setSelectedPromotionIds([]);
      setDiscountBreakdown(null);
      setDiscountError("");
      setDiscountNeedsReapply(false);
    }
  }, [isDineIn]);

  useEffect(() => {
    if (!isOpen || !isDineIn) return;

    setDiscountBreakdown(null);
    setDiscountError("");
    setDiscountNeedsReapply(
      Boolean(hasCouponInput || selectedPromotionIds.length > 0),
    );
  }, [
    isOpen,
    isDineIn,
    orderSignature,
    table?.id,
    table?.code,
    couponCode,
    selectedPromotionIds,
    hasCouponInput,
  ]);

  const handleSuggestion = (value) =>
    setPaidAmount(value === "exact" ? convertedPayableTotal || 0 : value);
  const handleShowConfirm = () =>
    !busy && !discountBlocksPayment && setIsConfirming(true);

  const mapNote = useCallback(
    () =>
      method === "cash"
        ? `Khách đưa ${formatPrice(paidAmount, { currency: activeCurrency })} - Thối lại ${formatPrice(
            changeAmount,
            { currency: activeCurrency },
          )}`
        : `Thanh toán ${method.toUpperCase()}`,
    [method, paidAmount, activeCurrency, changeAmount],
  );

  const suggestions = useMemo(() => {
    const total = Number(convertedPayableTotal || 0);
    if (total <= 0) return [50000, 100000, 200000];
    const suggestionValues = new Set();
    suggestionValues.add(Math.ceil(total / 1000) * 1000);
    if (total < 100000) {
      suggestionValues.add(100000);
      suggestionValues.add(200000);
      suggestionValues.add(500000);
    } else if (total < 500000) {
      suggestionValues.add(Math.ceil(total / 100000) * 100000);
      suggestionValues.add(500000);
      suggestionValues.add(1000000);
    } else {
      suggestionValues.add(Math.ceil(total / 100000) * 100000);
      suggestionValues.add(1000000);
      suggestionValues.add(2000000);
    }
    return Array.from(suggestionValues)
      .filter((value) => value >= total)
      .slice(0, 3);
  }, [convertedPayableTotal]);

  const handleApplyDiscountPreview = useCallback(async () => {
    if (!previewInput) {
      setDiscountBreakdown(null);
      setDiscountError("Không đủ dữ liệu để kiểm tra coupon.");
      setDiscountNeedsReapply(true);
      return;
    }

    setDiscountError("");
    setDiscountBreakdown(null);

    try {
      const breakdown = await previewOrderDiscount(previewInput);
      setDiscountBreakdown(breakdown || null);
      setDiscountNeedsReapply(false);
    } catch (error) {
      setDiscountBreakdown(null);
      setDiscountError(getDiscountPreviewErrorMessage(error));
      setDiscountNeedsReapply(true);
    }
  }, [previewInput, previewOrderDiscount]);

  const executePayment = async () => {
    if (busy) return;
    if (!restaurantId) {
      alert("Thiếu restaurantId. Vui lòng chọn bàn và lưu đơn trước.");
      return;
    }

    const check = validatePayment({
      method,
      paidAmount: Number(paidAmount || 0),
      total: Number(convertedPayableTotal || 0),
    });
    if (!check.ok) {
      alert(check.message);
      return;
    }

    if (discountBlocksPayment) {
      alert("Vui lòng áp dụng coupon hợp lệ trước khi xác nhận thanh toán.");
      return;
    }

    const tenderAmountVnd = convertCurrencyAmount(
      Number(paidAmount || 0),
      activeCurrency,
      "VND",
      usdToVndRate,
    );
    const backendPaidAmountVnd =
      method === "cash" && hasValidDiscount
        ? Number(payableTotalVnd || 0)
        : method === "cash"
          ? Number(tenderAmountVnd || 0)
          : Number(payableTotalVnd || 0);

    let res;
    if (["transfer", "momo", "vnpay"].includes(method)) {
      const resolvedOrderIds = await resolvePayableOrderIds({
        restaurantId,
        tableId: table?.id || table?._id || pos?.currentTable?.id || pos?.currentTable?._id,
        fallbackOrderId: effectiveOrderId,
      });
      if (!resolvedOrderIds.length) {
        alert("Không xác định được danh sách đơn cần thanh toán. Vui lòng tải lại danh sách đơn trên bàn.");
        return;
      }
      if (onlinePayment?.id && String(onlinePayment?.status || "").toLowerCase() === "pending") return;
      const created = await createOnlineOrderPayment({
        restaurantId,
        orderIds: resolvedOrderIds,
        provider: method === "transfer" ? "bank_transfer" : method,
        paymentMethod: method,
        pricing: hasValidDiscount
          ? buildDiscountPricingInput({ taxRate: 0, serviceRate: 0, shippingFee: 0, couponCode })
          : undefined,
        promotionIds: hasValidDiscount ? selectedPromotionIds : undefined,
      });
      setOnlinePayment(created);
      setOnlinePaymentError("");
      return;
    }

    try {
      if (hasValidDiscount) {
        const paymentPricing = buildDiscountPricingInput({
          taxRate: 0,
          serviceRate: 0,
          shippingFee: 0,
          couponCode,
        });

        res = await confirmPayment({
          restaurantId,
          method,
          paidAmount: Number(payableTotalVnd || 0),
          note: mapNote(),
          pricing: paymentPricing,
          promotionIds: selectedPromotionIds,
        });
      } else {
        res = await confirmPayment({
          restaurantId,
          method,
          paidAmount: backendPaidAmountVnd,
          note: mapNote(),
        });
      }
    } catch (error) {
      alert(error?.message || "Thanh toán thất bại.");
      return;
    }

    if (!res?.success) {
      alert(res?.message || "Thanh toán thất bại.");
      return;
    }

    const hasPaymentProof =
      Boolean(res?.data?.invoice) || Boolean(res?.data?.transaction);

    if (!hasPaymentProof) {
      alert(
        res?.message ||
          "Không thể hoàn tất thanh toán. Vui lòng kiểm tra trạng thái món hoặc yêu cầu đang chờ.",
      );
      return;
    }

    const authoritativeTotalVnd = Number(
      res?.data?.invoice?.totals?.grandTotal ??
        res?.data?.invoice?.grandTotal ??
        payableTotalVnd,
    );
    const authoritativeDisplayTotal = convertCurrencyAmount(
      authoritativeTotalVnd,
      "VND",
      activeCurrency,
      usdToVndRate,
    );

    onConfirm?.(method, paidAmount);
    onComplete?.({
      orderId: effectiveOrderId,
      method,
      paidAmount: Number(paidAmount || 0),
      total: Number(authoritativeDisplayTotal || 0),
      change: changeAmount,
      currency: activeCurrency,
      status: "COMPLETED",
      appliedCouponCode: hasValidDiscount ? couponCode.trim() : "",
      promotionIds: hasValidDiscount ? selectedPromotionIds : [],
      payableTotalVnd: authoritativeTotalVnd,
      tenderedAmountVnd: Number(tenderAmountVnd || 0),
      server: res?.data || null,
    });
    setIsConfirming(false);
    onClose?.();
  };

  const isCash = method === "cash";
  const isTransfer = method === "transfer";
  const onlineStatus = String(onlinePayment?.status || "").toLowerCase();
  const callbackStatus = String(onlinePayment?.callbackStatus || "").toLowerCase();
  const showRejected = callbackStatus === "rejected";
  const canRetryOnline = ["failed", "cancelled", "canceled", "expired"].includes(onlineStatus) || showRejected;
  const statusMessage = showRejected
    ? "Số tiền chuyển khoản không khớp. Vui lòng kiểm tra đối soát."
    : statusCopyMap[onlineStatus] || "";
  const expiresAtLabel = onlinePayment?.expiresAt ? new Date(onlinePayment.expiresAt).toLocaleString("vi-VN") : "";
  const transferMeta = onlinePayment?.metadata?.bankTransfer || {};
  const transferAmount = Number(onlinePayment?.amount || payableTotalVnd || 0);
  const statusBadge = showRejected
    ? { label: "Lệch số tiền", className: "rejected" }
    : statusBadgeMap[onlineStatus] || statusBadgeMap.pending;
  const hasClipboard = typeof navigator !== "undefined" && !!navigator?.clipboard?.writeText;
  const safeCopy = useCallback(async (value, fallbackLabel = "") => {
    if (!hasClipboard) {
      if (fallbackLabel) setCopyFallback(`Không thể sao chép tự động: ${fallbackLabel}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      setCopyFallback("");
    } catch (_) {
      if (fallbackLabel) setCopyFallback(`Không thể sao chép tự động: ${fallbackLabel}`);
    }
  }, [hasClipboard]);
  const vietQrUrl = useMemo(() => {
    const bankCode = String(transferMeta?.bankCode || "VCB").toUpperCase();
    const accountNumber = String(transferMeta?.bankAccountNumber || "").trim();
    const accountName = encodeURIComponent(String(transferMeta?.accountName || "").trim());
    const content = encodeURIComponent(String(transferMeta?.transferContent || "").trim());
    if (!accountNumber || !transferAmount) return "";
    return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${Math.round(transferAmount)}&addInfo=${content}&accountName=${accountName}`;
  }, [transferMeta, transferAmount]);
  useEffect(() => {
    if (!onlinePayment?.id) return;
    const timer = setInterval(async () => {
      const p = await getPaymentSession(onlinePayment.id);
      if (!p) return;
      setOnlinePayment(p);
      if (p.status === "success") {
        onComplete?.({ status: "COMPLETED", method, paymentSessionId: p.id });
        onClose?.();
        return;
      } else if (["failed", "cancelled", "expired"].includes(String(p.status || "").toLowerCase())) {
        setOnlinePaymentError("Thanh toán online không thành công hoặc đã bị hủy/hết hạn.");
        return;
      } else if (String(p.callbackStatus || "").toLowerCase() === "rejected") {
        setOnlinePaymentError("Số tiền chuyển khoản không khớp, chờ xử lý.");
        return;
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [onlinePayment?.id, getPaymentSession, onClose, onComplete, method]);
  const disableConfirm =
    busy ||
    (onlinePayment?.id && String(onlinePayment?.status || "").toLowerCase() === "pending") ||
    isPreviewingDiscount ||
    discountBlocksPayment ||
    (isCash && Number(paidAmount || 0) < Number(convertedPayableTotal || 0));
  useModalKeyboardClose({ isOpen, onClose, disabled: busy || isConfirming });
  if (!isOpen) return null;

  return (
    <div
      className={s.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={s.modal}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button className={s.closeButton} onClick={onClose} disabled={busy}>
          &times;
        </button>

        <h3 className={s.title}>🧾 Thanh Toán Hóa Đơn</h3>
        <p className={s.orderInfo}>
          Bàn: <b>{table?.code || "..."}</b> | Hóa đơn:{" "}
          <b>{order?.[0]?.orderCode || "..."}</b>
        </p>

        <div className={s.group}>
          <label className={s.label}>Tiền tệ hóa đơn</label>
          <div className={s.grid}>
            {["VND", "USD"].map((currency) => (
              <button
                key={currency}
                className={`${s.btn} ${activeCurrency === currency ? s.active : ""}`}
                onClick={() => {
                  const nextPaidAmount = convertCurrencyAmount(
                    Number(paidAmount || 0),
                    activeCurrency,
                    currency,
                    usdToVndRate,
                  );
                  setActiveCurrency(currency);
                  setPaidAmount(nextPaidAmount);
                }}
                disabled={isConfirming || busy}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        <div className={s.mainContent}>
          <div className={s.leftPanel}>
            <h4 className={s.panelTitle}>Chi tiết Hóa đơn</h4>
            <div className={s.itemsList}>
              {Array.isArray(order) && order.length > 0 ? (
                groupedBatches.map((batch, batchIndex) => (
                  <div key={batch.key || `payment_batch_${batchIndex}`}>
                    <h5 className={s.panelTitle}>
                      {batch.isDraft
                        ? "Món mới chưa gửi bếp"
                        : `Đợt gọi món ${batch.batchIndex || batchIndex + 1}${batch.orderCode ? ` · ${batch.orderCode}` : ""}`}
                    </h5>
                    {batch.items.map((item, index) => (
                      <div
                        key={item._lineId || item.dishId || index}
                        className={s.itemRow}
                      >
                        <div className={s.itemInfo}>
                          <span className={s.itemName}>
                            {item.quantity} x {item.name}
                          </span>
                          <span className={s.itemPrice}>
                            {formatPrice(
                              convertCurrencyAmount(
                                (item.price || 0) + (item.modifiersPrice || 0),
                                "VND",
                                activeCurrency,
                                usdToVndRate,
                              ),
                              { currency: activeCurrency },
                            )}
                          </span>
                        </div>
                        <div className={s.itemTotal}>
                          {formatPrice(
                            convertCurrencyAmount(
                              ((item.price || 0) + (item.modifiersPrice || 0)) *
                                (item.quantity || 0),
                              "VND",
                              activeCurrency,
                              usdToVndRate,
                            ),
                            { currency: activeCurrency },
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className={s.itemRow}>
                  <span className={s.itemName}>Chưa có món nào...</span>
                </div>
              )}
            </div>
          </div>

          <div className={s.rightPanel}>
            <div className={s.summary}>
              <div className={`${s.row} ${s.totalRow}`}>
                <span className={s.label}>Khách cần trả</span>
                <span className={s.totalAmount}>
                  {formatPrice(convertedPayableTotal || 0, {
                    currency: activeCurrency,
                  })}
                </span>
              </div>
            </div>

            {isDineIn && (
              <div className={s.group}>
                <label className={s.label}>Coupon thanh toán</label>
                <div className={s.couponRow}>
                  <input
                    type="text"
                    className={s.couponInput}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Nhập mã coupon"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className={s.applyButton}
                    onClick={handleApplyDiscountPreview}
                    disabled={busy || isPreviewingDiscount || !hasCouponInput}
                  >
                    {isPreviewingDiscount ? "Đang kiểm..." : "Áp dụng"}
                  </button>
                </div>
                {activePromotions.length > 0 && (
                  <div className={s.promotionRow}>
                    <label className={s.subLabel}>
                      Chương trình khuyến mãi
                    </label>
                    <select
                      className={s.promotionSelect}
                      value={selectedPromotionId}
                      onChange={(event) =>
                        setSelectedPromotionIds(
                          event.target.value ? [event.target.value] : [],
                        )
                      }
                      disabled={busy || promotionsLoading}
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
                  <div className={s.discountError}>{discountError}</div>
                )}

                {!discountError && discountNeedsReapply && hasCouponInput && (
                  <div className={s.discountWarning}>
                    Coupon đã thay đổi hoặc hóa đơn đã đổi. Vui lòng áp dụng
                    lại.
                  </div>
                )}

                {discountBreakdown && !discountNeedsReapply && (
                  <div className={s.breakdownCard}>
                    {breakdownRows.map((row) => (
                      <div
                        key={row.label}
                        className={`${s.breakdownRow} ${row.negative ? s.negative : ""} ${row.total ? s.breakdownTotal : ""}`}
                      >
                        <span>{row.label}</span>
                        <span>
                          {row.negative ? "-" : ""}
                          {formatPrice(
                            convertCurrencyAmount(
                              Number(row.value || 0),
                              "VND",
                              activeCurrency,
                              usdToVndRate,
                            ),
                            { currency: activeCurrency },
                          )}
                        </span>
                      </div>
                    ))}
                    {promotionLineItems.length > 0 && (
                      <div className={s.linePromotionBreakdown}>
                        <div className={s.linePromotionTitle}>
                          Ưu đãi theo món
                        </div>

                        {promotionLineItems.map((line) => (
                          <div key={line.key} className={s.linePromotionRow}>
                            <span>
                              {line.itemName} · {line.promotionName}
                            </span>
                            <strong>
                              -
                              {formatPrice(
                                convertCurrencyAmount(
                                  line.discount,
                                  "VND",
                                  activeCurrency,
                                  usdToVndRate,
                                ),
                                { currency: activeCurrency },
                              )}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                    {promotionBreakdownRows.length > 0 && (
                      <div className={s.linePromotionBreakdown}>
                        <div className={s.linePromotionTitle}>Chi tiết khuyến mãi</div>
                        {promotionBreakdownRows.map((row) => (
                          <div key={row.key} className={s.linePromotionRow}>
                            <span>
                              {row.type} · {row.name}
                              {row.code ? ` (${row.code})` : ""} · {row.source}
                              {row.itemName ? ` · ${row.itemName}` : ""}
                            </span>
                            <strong>
                              -
                              {formatPrice(
                                convertCurrencyAmount(
                                  row.discountAmount,
                                  "VND",
                                  activeCurrency,
                                  usdToVndRate,
                                ),
                                { currency: activeCurrency },
                              )}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                    {formatDiscountReasonLabel(
                      discountBreakdown?.discountReason,
                    ) && (
                      <div className={s.discountNote}>
                        {formatDiscountReasonLabel(
                          discountBreakdown?.discountReason,
                        )}
                      </div>
                    )}
                  </div>
                )}

                {discountBlocksPayment && (
                  <div className={s.discountError}>
                    Vui lòng áp dụng coupon hợp lệ trước khi xác nhận thanh
                    toán.
                  </div>
                )}
              </div>
            )}

            <div className={s.group}>
              <label className={s.label}>Chọn phương thức</label>
              <div className={s.grid}>
                {["cash", "card", "transfer", "momo", "vnpay"].map((paymentMethod) => (
                  <button
                    key={paymentMethod}
                    className={`${s.btn} ${method === paymentMethod ? s.active : ""}`}
                    onClick={() => setMethod(paymentMethod)}
                    disabled={isConfirming || busy}
                  >
                    {paymentMethod === "cash"
                      ? "Tiền mặt"
                      : paymentMethod === "card"
                        ? "Thẻ"
                        : paymentMethod === "momo" ? "MoMo" : paymentMethod === "vnpay" ? "VNPAY" : "Chuyển khoản"}
                  </button>
                ))}
              </div>
            </div>

            {isTransfer && (
              <div className={s.transferInfo}>
                {!onlinePayment?.id ? (
                  <div>
                    <div><b>Tạo mã thanh toán chuyển khoản</b></div>
                    <div>Hệ thống sẽ tạo nội dung chuyển khoản bắt buộc và tự động xác nhận khi ngân hàng gửi webhook.</div>
                  </div>
                ) : (
                  <>
                <div className={s.paymentDetails}>
                  <div className={`${s.statusBadge} ${s[`status_${statusBadge.className}`]}`}>{statusBadge.label}</div>
                  <div className={s.transferWarning}>Vui lòng chuyển đúng số tiền và đúng nội dung. Hệ thống chỉ xác nhận khi ngân hàng gửi webhook khớp giao dịch.</div>
                  <div className={s.detailItem}>
                    <span>Ngân hàng:</span> <b>{transferMeta?.bankName || "Ngân hàng"}</b>
                  </div>
                  <div className={s.detailItem}>
                    <span>Số tài khoản:</span> <b>{transferMeta?.bankAccountNumber || "—"}</b>
                    {!!transferMeta?.bankAccountNumber && <button className={s.suggestionBtn} onClick={() => safeCopy(transferMeta.bankAccountNumber, "Số tài khoản")}>Copy</button>}
                  </div>
                  <div className={s.detailItem}>
                    <span>Chủ tài khoản:</span> <b>{transferMeta?.accountName || "—"}</b>
                  </div>
                  <div className={s.detailItem}>
                    <span>Số tiền:</span>{" "}
                    <b>{formatPrice(transferAmount, { currency: "VND" })}</b>
                    <button className={s.suggestionBtn} onClick={() => safeCopy(Math.round(transferAmount), "Số tiền")}>Copy</button>
                  </div>
                  <div className={s.detailItem}>
                    <span>Nội dung chuyển khoản bắt buộc:</span> <b>{transferMeta?.transferContent || onlinePayment?.reference || "..."}</b>
                    <button className={s.suggestionBtn} onClick={() => safeCopy(transferMeta?.transferContent || onlinePayment?.reference || "", "Nội dung chuyển khoản")}>Copy</button>
                  </div>
                  <div className={s.detailItem}>
                    <span>Mã tham chiếu:</span> <b>{onlinePayment?.reference || "—"}</b>
                  </div>
                </div>
                <div className={s.qrCode}>
                  {vietQrUrl ? <img src={vietQrUrl} alt="QR chuyển khoản" style={{ width: 160, height: 160, objectFit: "contain" }} /> : <QRCodePlaceholder value={onlinePayment?.reference || "QR chuyển khoản"} />}
                </div>
                {copyFallback && <div className={s.discountWarning}>{copyFallback}</div>}
                {statusMessage && <div>{statusMessage}</div>}
                {expiresAtLabel && <div>Mã thanh toán hết hạn lúc <b>{expiresAtLabel}</b></div>}
                {onlinePaymentError && <div className={s.discountError}>{onlinePaymentError}</div>}
                {onlineStatus === "pending" && (
                  <button className={s.secondary} onClick={async () => {
                    try {
                      const cancelled = await cancelOnlinePaymentSession({ paymentId: onlinePayment.id, reason: "cancelled_by_user" });
                      if (cancelled) setOnlinePayment(cancelled);
                    } catch (e) {
                      setOnlinePaymentError(e?.message || "Không thể hủy mã thanh toán.");
                    }
                  }}>Hủy mã thanh toán</button>
                )}
                {canRetryOnline && <button className={s.secondary} onClick={() => { setOnlinePayment(null); setOnlinePaymentError(""); setIsConfirming(true); }}>Tạo lại mã thanh toán</button>}
                  </>
                )}
              </div>
            )}
            {(method === "momo" || method === "vnpay") && onlinePayment?.id && (
              <div className={s.transferInfo}>
                <div className={s.paymentDetails}>
                  <div><b>{String(onlinePayment?.provider || method || "").toUpperCase()}</b></div>
                  <div className={`${s.statusBadge} ${s[`status_${statusBadge.className}`]}`}>{statusBadge.label}</div>
                  <div>Mã tham chiếu: <b>{onlinePayment?.reference || "—"}</b></div>
                  <div>Số tiền thanh toán: <b>{formatPrice(onlinePayment?.amount || 0, { currency: "VND" })}</b></div>
                  {onlinePayment?.payUrl && <a href={onlinePayment.payUrl} target="_blank" rel="noreferrer">Mở trang thanh toán</a>}
                  {onlinePayment?.deeplink && <a href={onlinePayment.deeplink} target="_blank" rel="noreferrer">Mở ứng dụng thanh toán</a>}
                  {!onlinePayment?.payUrl && !onlinePayment?.deeplink && !onlinePayment?.qrCodeUrl && (
                    <div className={s.discountWarning}>Chưa nhận được liên kết thanh toán từ cổng thanh toán.</div>
                  )}
                </div>
                <div className={s.qrCode}>
                  {onlinePayment?.qrCodeUrl && (
                    <>
                      <p>Quét mã để thanh toán</p>
                      <img src={onlinePayment.qrCodeUrl} alt="QR thanh toán" style={{ width: 160, height: 160, objectFit: "contain" }} />
                    </>
                  )}
                </div>
                {statusMessage && <div>{statusMessage}</div>}
                {expiresAtLabel && <div>Mã thanh toán hết hạn lúc <b>{expiresAtLabel}</b></div>}
                {onlinePaymentError && <div className={s.discountError}>{onlinePaymentError}</div>}
                {onlineStatus === "pending" && (
                  <button className={s.secondary} onClick={async () => {
                    try {
                      const cancelled = await cancelOnlinePaymentSession({ paymentId: onlinePayment.id, reason: "cancelled_by_user" });
                      if (cancelled) setOnlinePayment(cancelled);
                    } catch (e) {
                      setOnlinePaymentError(e?.message || "Không thể hủy mã thanh toán.");
                    }
                  }}>Hủy mã thanh toán</button>
                )}
                {canRetryOnline && <button className={s.secondary} onClick={() => { setOnlinePayment(null); setOnlinePaymentError(""); setIsConfirming(true); }}>Tạo lại mã thanh toán</button>}
              </div>
            )}

            {isCash && (
              <div className={s.group}>
                <label className={s.label}>Số tiền khách đưa</label>
                <input
                  type="number"
                  className={s.input}
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                  autoFocus
                  disabled={isConfirming || busy}
                />
                <div className={s.suggestions}>
                  {suggestions.map((value) => (
                    <button
                      key={value}
                      className={s.suggestionBtn}
                      onClick={() => handleSuggestion(value)}
                      disabled={isConfirming || busy}
                    >
                      {formatPrice(value, { currency: activeCurrency })}
                    </button>
                  ))}
                </div>
                <div className={`${s.row} ${s.changeRow}`}>
                  <span className={s.label}>Tiền thối lại</span>
                  <span className={s.changeAmount}>
                    {formatPrice(changeAmount, { currency: activeCurrency })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={s.actions}>
          {!isConfirming ? (
            <>
              <button className={s.secondary} onClick={onClose} disabled={busy}>
                Quay lại
              </button>
              <button
                className={s.success}
                onClick={handleShowConfirm}
                disabled={disableConfirm}
              >
                Hoàn tất thanh toán
              </button>
            </>
          ) : (
            <>
              <button
                className={s.secondary}
                onClick={() => setIsConfirming(false)}
                disabled={busy}
              >
                Quay lại
              </button>
              <button
                className={`${s.success} ${busy ? s.loading : ""}`}
                onClick={executePayment}
                disabled={disableConfirm}
              >
                {busy ? <span className={s.spinner}></span> : "XÁC NHẬN"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PaymentModal);
