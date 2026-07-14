import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { useActiveDiscountPromotions } from "@/hooks/useActiveDiscountPromotions";
import { calculateReservationDepositSettlement } from "@/utils/reservationDepositSettlement";

function ReservationDepositPaymentModal({
  isOpen,
  order,
  table,
  onClose,
  onConfirm,
  onComplete,
  totalAmount,
  reservationSettlement,
}) {
  const [method, setMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [selectedPromotionIds, setSelectedPromotionIds] = useState([]);
  const [discountBreakdown, setDiscountBreakdown] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountNeedsReapply, setDiscountNeedsReapply] = useState(false);

  const pos = usePos?.() || null;
  const effectiveOrderId = pos?.currentOrderId || order?.[0]?.orderId || null;
  const restaurantId =
    table?.restaurantId ||
    table?.restaurant_id ||
    pos?.currentTable?.restaurantId ||
    null;
  const { activeCurrency, setActiveCurrency, usdToVndRate } =
    useRestaurantCurrency(restaurantId);
  const { validatePayment, confirmPayment, payLoading } =
    useOrderManagement(pos);
  const { previewOrderDiscount, loading: isPreviewingDiscount } =
    useDiscountPreview();
  const { promotions: activePromotions, loading: promotionsLoading } =
    useActiveDiscountPromotions(restaurantId);

  const busy = Boolean(payLoading);
  const selectedPromotionId = selectedPromotionIds[0] || "";
  const groupedBatches = groupItemsByBatch(order || []);
  const baseTotalAmountVnd = Number(totalAmount || 0);
  const grossPayableVnd = getDiscountBreakdownTotal(
    discountBreakdown,
    baseTotalAmountVnd,
  );
  const settlement = useMemo(
    () =>
      calculateReservationDepositSettlement({
        grossTotal: grossPayableVnd,
        ...(reservationSettlement || {}),
      }),
    [grossPayableVnd, reservationSettlement],
  );
  const customerReceives = settlement.customerReceives > 0;
  const displaySettlementVnd = customerReceives
    ? settlement.customerReceives
    : settlement.customerPays;
  const convertedCustomerPays = convertCurrencyAmount(
    settlement.customerPays,
    "VND",
    activeCurrency,
    usdToVndRate,
  );
  const convertedDisplaySettlement = convertCurrencyAmount(
    displaySettlementVnd,
    "VND",
    activeCurrency,
    usdToVndRate,
  );
  const changeAmount = customerReceives
    ? 0
    : Math.max(0, Number(paidAmount || 0) - convertedCustomerPays);
  const hasCouponInput = couponCode.trim().length > 0;
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
  const previewInput = useMemo(() => {
    if (!restaurantId) return null;
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
  }, [restaurantId, order, couponCode, selectedPromotionIds]);
  const hasValidDiscount = Boolean(
    discountBreakdown &&
      !discountNeedsReapply &&
      !discountError &&
      (hasCouponInput || selectedPromotionIds.length > 0),
  );
  const discountBlocksPayment = Boolean(
    hasCouponInput &&
      (!discountBreakdown || discountNeedsReapply || discountError),
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsConfirming(false);
    setMethod("cash");
    setPaidAmount(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (customerReceives) {
      setMethod("cash");
      setPaidAmount(0);
      return;
    }
    if (method === "card") {
      setPaidAmount(convertedCustomerPays || 0);
    }
  }, [
    customerReceives,
    convertedCustomerPays,
    isOpen,
    method,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setDiscountBreakdown(null);
    setDiscountError("");
    setDiscountNeedsReapply(
      Boolean(hasCouponInput || selectedPromotionIds.length > 0),
    );
  }, [
    isOpen,
    orderSignature,
    table?.id,
    table?.code,
    couponCode,
    selectedPromotionIds,
    hasCouponInput,
  ]);

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

  const suggestions = useMemo(() => {
    const total = Number(convertedCustomerPays || 0);
    if (total <= 0) return [];
    const values = new Set([Math.ceil(total / 1000) * 1000]);
    if (total < 100000) {
      values.add(100000);
      values.add(200000);
    } else if (total < 500000) {
      values.add(Math.ceil(total / 100000) * 100000);
      values.add(500000);
    } else {
      values.add(Math.ceil(total / 100000) * 100000);
      values.add(1000000);
    }
    return Array.from(values)
      .filter((value) => value >= total)
      .slice(0, 3);
  }, [convertedCustomerPays]);

  const mapNote = useCallback(() => {
    const collect = formatPrice(settlement.amountToCollect, { currency: "VND" });
    const refund = formatPrice(settlement.totalRefund, { currency: "VND" });
    const net = formatPrice(displaySettlementVnd, { currency: "VND" });
    if (customerReceives) {
      return `Quyết toán cọc: thu phần tiền món còn lại ${collect}, hoàn cọc ${refund}, trả khách chênh lệch ${net}`;
    }
    return `Quyết toán cọc: thu phần tiền món còn lại ${collect}, hoàn cọc ${refund}, khách thanh toán chênh lệch ${net}`;
  }, [customerReceives, displaySettlementVnd, settlement]);

  const executePayment = async () => {
    if (busy) return;
    if (!restaurantId) {
      alert("Thiếu restaurantId. Vui lòng chọn bàn và lưu đơn trước.");
      return;
    }
    if (discountBlocksPayment) {
      alert("Vui lòng áp dụng coupon hợp lệ trước khi xác nhận thanh toán.");
      return;
    }

    const check = validatePayment({
      method,
      paidAmount: Number(paidAmount || 0),
      total: Number(convertedCustomerPays || 0),
    });
    if (!check.ok) {
      alert(check.message);
      return;
    }

    const paymentPricing = hasValidDiscount
      ? buildDiscountPricingInput({
          taxRate: 0,
          serviceRate: 0,
          shippingFee: 0,
          couponCode,
        })
      : undefined;

    let res;
    try {
      res = await confirmPayment({
        restaurantId,
        method,
        // Backend records the remaining food amount as an inflow and the
        // refundable deposit as a separate outflow. The cashier sees the net.
        paidAmount: Number(settlement.amountToCollect || 0),
        note: mapNote(),
        pricing: paymentPricing,
        promotionIds: hasValidDiscount ? selectedPromotionIds : [],
      });
    } catch (error) {
      alert(error?.message || "Thanh toán thất bại.");
      return;
    }

    if (!res?.success) {
      alert(res?.message || "Thanh toán thất bại.");
      return;
    }
    if (!res?.data?.invoice && !res?.data?.transaction) {
      alert(
        res?.message ||
          "Không thể hoàn tất quyết toán. Vui lòng kiểm tra trạng thái món.",
      );
      return;
    }

    onConfirm?.(method, paidAmount);
    onComplete?.({
      orderId: effectiveOrderId,
      method,
      paidAmount: Number(paidAmount || 0),
      total: Number(displaySettlementVnd || 0),
      change: changeAmount,
      currency: activeCurrency,
      status: "COMPLETED",
      appliedCouponCode: hasValidDiscount ? couponCode.trim() : "",
      promotionIds: hasValidDiscount ? selectedPromotionIds : [],
      payableTotalVnd: settlement.customerPays,
      amountCollectedVnd: settlement.amountToCollect,
      customerReceivesVnd: settlement.customerReceives,
      tableDepositRefundVnd: settlement.tableDepositRefund,
      menuDepositCreditVnd: settlement.menuDepositCredit,
      server: res?.data || null,
    });
    setIsConfirming(false);
    onClose?.();
  };

  const disableConfirm =
    busy ||
    isPreviewingDiscount ||
    discountBlocksPayment ||
    (!customerReceives &&
      method === "cash" &&
      Number(paidAmount || 0) < Number(convertedCustomerPays || 0));
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
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <button className={s.closeButton} onClick={onClose} disabled={busy}>
          &times;
        </button>

        <h3 className={s.title}>🧾 Quyết Toán Hóa Đơn & Tiền Cọc</h3>
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
                <div className={s.itemRow}>Chưa có món nào...</div>
              )}
            </div>
          </div>

          <div className={s.rightPanel}>
            <div className={s.summary}>
              <div className={`${s.row} ${s.totalRow}`}>
                <span className={s.label}>
                  {customerReceives ? "Khách được nhận" : "Khách cần thanh toán"}
                </span>
                <span className={customerReceives ? s.changeAmount : s.totalAmount}>
                  {formatPrice(convertedDisplaySettlement || 0, {
                    currency: activeCurrency,
                  })}
                </span>
              </div>
            </div>

            <div className={s.group}>
              <label className={s.label}>Coupon thanh toán</label>
              <div className={s.couponRow}>
                <input
                  type="text"
                  className={s.couponInput}
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
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
                  <label className={s.subLabel}>Chương trình khuyến mãi</label>
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
                  Coupon đã thay đổi hoặc hóa đơn đã đổi. Vui lòng áp dụng lại.
                </div>
              )}

              <div className={s.breakdownCard}>
                <div className={s.breakdownRow}>
                  <span>Tổng hóa đơn sau ưu đãi</span>
                  <strong>{formatPrice(grossPayableVnd, { currency: "VND" })}</strong>
                </div>
                <div className={`${s.breakdownRow} ${s.negative}`}>
                  <span>Cọc món đã trả trước</span>
                  <strong>-{formatPrice(settlement.menuDepositCredit, { currency: "VND" })}</strong>
                </div>
                <div className={s.breakdownRow}>
                  <span>Còn lại tiền món</span>
                  <strong>{formatPrice(settlement.amountToCollect, { currency: "VND" })}</strong>
                </div>
                {settlement.tableDepositRefund > 0 && (
                  <div className={`${s.breakdownRow} ${s.negative}`}>
                    <span>Hoàn cọc bàn</span>
                    <strong>-{formatPrice(settlement.tableDepositRefund, { currency: "VND" })}</strong>
                  </div>
                )}
                {settlement.menuDepositRefund > 0 && (
                  <div className={`${s.breakdownRow} ${s.negative}`}>
                    <span>Hoàn phần cọc món dư</span>
                    <strong>-{formatPrice(settlement.menuDepositRefund, { currency: "VND" })}</strong>
                  </div>
                )}
                <div className={`${s.breakdownRow} ${s.breakdownTotal}`}>
                  <span>
                    {customerReceives ? "Trả lại khách" : "Khách thanh toán"}
                  </span>
                  <strong>{formatPrice(displaySettlementVnd, { currency: "VND" })}</strong>
                </div>
              </div>
            </div>

            {!customerReceives && (
              <div className={s.group}>
                <label className={s.label}>Chọn phương thức</label>
                <div className={s.grid}>
                  {["cash", "card"].map((paymentMethod) => (
                    <button
                      key={paymentMethod}
                      className={`${s.btn} ${method === paymentMethod ? s.active : ""}`}
                      onClick={() => setMethod(paymentMethod)}
                      disabled={isConfirming || busy}
                    >
                      {paymentMethod === "cash" ? "Tiền mặt" : "Thẻ"}
                    </button>
                  ))}
                </div>
                <div className={s.discountWarning}>
                  Hóa đơn có quyết toán cọc nên chuyển khoản/MoMo/VNPAY không được dùng để tránh thu sai số tiền.
                </div>
              </div>
            )}

            {customerReceives ? (
              <div className={s.group}>
                <div className={s.discountWarning}>
                  Thu ngân trả khách đúng số tiền chênh lệch hiển thị ở trên. Hệ thống sẽ ghi nhận riêng tiền món còn lại và khoản hoàn cọc.
                </div>
              </div>
            ) : method === "cash" ? (
              <div className={s.group}>
                <label className={s.label}>Số tiền khách đưa</label>
                <input
                  type="number"
                  className={s.input}
                  value={paidAmount || ""}
                  onChange={(event) =>
                    setPaidAmount(Number(event.target.value) || 0)
                  }
                  placeholder="0"
                  autoFocus
                  disabled={isConfirming || busy}
                />
                <div className={s.suggestions}>
                  {suggestions.map((value) => (
                    <button
                      key={value}
                      className={s.suggestionBtn}
                      onClick={() => setPaidAmount(value)}
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
            ) : null}
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
                onClick={() => !disableConfirm && setIsConfirming(true)}
                disabled={disableConfirm}
              >
                {customerReceives ? "Hoàn tất & trả cọc" : "Hoàn tất thanh toán"}
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

export default memo(ReservationDepositPaymentModal);
