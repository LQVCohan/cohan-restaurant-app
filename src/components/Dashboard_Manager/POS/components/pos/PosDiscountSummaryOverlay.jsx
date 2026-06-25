import React, { useEffect, useMemo, useState } from "react";
import { usePos } from "../../../../../context/PosContext";
import { useDiscountPreview } from "@/hooks/useDiscountPreview";
import {
  buildOrderDiscountPreviewInput,
  getDiscountBreakdownTotal,
  getShippingFeeForDiscountPreview,
} from "@/utils/discountPreviewPayload";
import { formatPrice } from "@/utils/formatters";

const getCleanOrderItems = (items = []) =>
  (Array.isArray(items) ? items : []).filter((item) => {
    const status = String(item?.status || "").toLowerCase();
    return status !== "cancelled" && status !== "returned" && Number(item?.quantity || 0) > 0;
  });

const toMoney = (value) => Math.max(0, Math.round(Number(value || 0)));

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 12,
  lineHeight: 1.25,
};

const labelStyle = {
  color: "#475569",
  fontWeight: 750,
  minWidth: 0,
};

const valueStyle = {
  color: "#0f172a",
  fontWeight: 850,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

export default function PosDiscountSummaryOverlay() {
  const { restaurantId, currentOrder, currentOrderType, shippingInfo } = usePos();
  const { previewOrderDiscount } = useDiscountPreview();
  const [discountBreakdown, setDiscountBreakdown] = useState(null);

  const previewItems = useMemo(() => getCleanOrderItems(currentOrder), [currentOrder]);

  useEffect(() => {
    if (!restaurantId || !previewItems.length) {
      setDiscountBreakdown(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const breakdown = await previewOrderDiscount(
          buildOrderDiscountPreviewInput({
            restaurantId,
            orderType: currentOrderType,
            items: previewItems,
            taxRate: 0,
            serviceRate: 0,
            shippingFee: getShippingFeeForDiscountPreview({
              deliveryMethod: currentOrderType === "delivery" ? "delivery" : "takeaway",
              shippingFee: shippingInfo?.shippingFee || 0,
            }),
            couponCode: "",
            promotionIds: [],
          }),
        );

        if (!cancelled) setDiscountBreakdown(breakdown || null);
      } catch {
        if (!cancelled) setDiscountBreakdown(null);
      }
    }, 360);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [restaurantId, currentOrderType, previewItems, shippingInfo?.shippingFee, previewOrderDiscount]);

  const subtotal = toMoney(discountBreakdown?.subtotal);
  const promotionDiscount = toMoney(discountBreakdown?.promotionDiscount);
  const couponDiscount = toMoney(discountBreakdown?.couponDiscount);
  const totalDiscount = toMoney(
    discountBreakdown?.totalDiscount ??
      discountBreakdown?.discount ??
      promotionDiscount + couponDiscount,
  );
  const service = toMoney(discountBreakdown?.service);
  const tax = toMoney(discountBreakdown?.tax);
  const shippingFee = toMoney(discountBreakdown?.shippingFee);
  const payableTotal = toMoney(getDiscountBreakdownTotal(discountBreakdown, subtotal));
  const appliedPromotionCount = Array.isArray(discountBreakdown?.appliedPromotions)
    ? discountBreakdown.appliedPromotions.length
    : 0;

  if (!previewItems.length || totalDiscount <= 0) return null;

  const detailRows = [
    { label: "Tạm tính", value: subtotal, sign: "normal" },
    ...(promotionDiscount > 0
      ? [{ label: "Giảm khuyến mãi", value: promotionDiscount, sign: "discount" }]
      : []),
    ...(couponDiscount > 0
      ? [{ label: "Giảm coupon", value: couponDiscount, sign: "discount" }]
      : []),
    ...(promotionDiscount <= 0 && couponDiscount <= 0 && totalDiscount > 0
      ? [{ label: "Tổng giảm", value: totalDiscount, sign: "discount" }]
      : []),
    ...(service > 0 ? [{ label: "Phí phục vụ", value: service, sign: "normal" }] : []),
    ...(tax > 0 ? [{ label: "Thuế", value: tax, sign: "normal" }] : []),
    ...(shippingFee > 0 ? [{ label: "Phí giao hàng", value: shippingFee, sign: "normal" }] : []),
  ];

  return (
    <>
      <style>{`
        [data-pos-order-panel] > [class*="footer"] > [class*="summary"] {
          visibility: hidden !important;
        }
      `}</style>
      <div
        data-pos-discount-footer
        aria-label="Chi tiết tạm tính sau ưu đãi"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 72,
          zIndex: 80,
          pointerEvents: "none",
          border: "1px solid rgba(253, 186, 116, 0.95)",
          borderRadius: 16,
          background: "linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)",
          boxShadow: "0 16px 34px rgba(15, 23, 42, 0.12)",
          padding: "0.7rem 0.8rem 0.75rem",
          color: "#0f172a",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            paddingBottom: 6,
            borderBottom: "1px dashed rgba(148, 163, 184, 0.58)",
            marginBottom: 7,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffedd5",
                color: "#ea580c",
                fontWeight: 950,
                flexShrink: 0,
              }}
            >
              ₫
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 950, color: "#0f172a" }}>
                Chi tiết thanh toán POS
              </div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>
                {appliedPromotionCount > 0
                  ? `${appliedPromotionCount} ưu đãi đã áp dụng tự động`
                  : "Ưu đãi đã áp dụng tự động"}
              </div>
            </div>
          </div>
          <div
            style={{
              borderRadius: 999,
              padding: "0.24rem 0.55rem",
              background: "#dcfce7",
              color: "#15803d",
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            Đã giảm {formatPrice(totalDiscount)}
          </div>
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          {detailRows.map((row) => (
            <div key={row.label} style={rowStyle}>
              <span style={labelStyle}>{row.label}</span>
              <span
                style={{
                  ...valueStyle,
                  color: row.sign === "discount" ? "#16a34a" : valueStyle.color,
                }}
              >
                {row.sign === "discount" ? "-" : ""}
                {formatPrice(row.value)}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px dashed rgba(148, 163, 184, 0.62)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>Tổng cộng</div>
            <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700 }}>
              Giá đã gồm ưu đãi hợp lệ
            </div>
          </div>
          <strong
            style={{
              color: "#ea580c",
              fontSize: 20,
              lineHeight: 1,
              fontWeight: 950,
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPrice(payableTotal)}
          </strong>
        </div>
      </div>
    </>
  );
}
