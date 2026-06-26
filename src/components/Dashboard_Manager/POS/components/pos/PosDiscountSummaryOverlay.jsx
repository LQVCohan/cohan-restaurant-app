import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

const getItemSubtotal = (item = {}) => {
  const quantity = Number(item?.quantity || 0);
  const unitPrice = Number(
    item?.lineSubtotal != null
      ? Number(item.lineSubtotal) / Math.max(quantity, 1)
      : item?.unitPrice ?? item?.basePrice ?? item?.price ?? item?.servingVariant?.price ?? 0,
  );

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice)) return 0;
  return unitPrice * quantity;
};

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
  const [footerElement, setFooterElement] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const previewItems = useMemo(() => getCleanOrderItems(currentOrder), [currentOrder]);
  const localSubtotal = useMemo(
    () => toMoney(previewItems.reduce((sum, item) => sum + getItemSubtotal(item), 0)),
    [previewItems],
  );

  useEffect(() => {
    const resolveFooter = () => {
      const node = document.querySelector('[data-pos-order-panel] > [class*="footer"]');
      setFooterElement(node || null);
    };

    resolveFooter();
    const frame = window.requestAnimationFrame(resolveFooter);
    return () => window.cancelAnimationFrame(frame);
  }, []);

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

  if (!footerElement) return null;

  const subtotal = previewItems.length
    ? toMoney(discountBreakdown?.subtotal || localSubtotal)
    : 0;
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
  const payableTotal = previewItems.length
    ? toMoney(getDiscountBreakdownTotal(discountBreakdown, subtotal - totalDiscount + service + tax + shippingFee))
    : 0;
  const appliedPromotionCount = Array.isArray(discountBreakdown?.appliedPromotions)
    ? discountBreakdown.appliedPromotions.length
    : 0;
  const hasDiscount = totalDiscount > 0;

  const detailRows = [
    { label: "Tạm tính", value: subtotal, sign: "normal" },
    { label: "Tổng giảm", value: totalDiscount, sign: "discount" },
    { label: "Phí phục vụ", value: service, sign: "normal" },
    { label: "Thuế", value: tax, sign: "normal" },
    ...(shippingFee > 0 || currentOrderType === "delivery"
      ? [{ label: "Phí giao hàng", value: shippingFee, sign: "normal" }]
      : []),
  ];

  return createPortal(
    <>
      <style>{`
        [data-pos-order-panel] > [class*="footer"] {
          display: flex !important;
          flex-direction: column !important;
        }
        [data-pos-order-panel] > [class*="footer"] > [class*="summary"] {
          display: none !important;
        }
        [data-pos-order-panel] > [class*="footer"] > [class*="actionsGrid"] {
          order: 2;
        }
        [data-pos-discount-footer] {
          order: 1;
          margin-bottom: 0.85rem;
        }
      `}</style>
      <div
        data-pos-discount-footer
        aria-label="Chi tiết thanh toán POS"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: hasDiscount
            ? "1px solid rgba(253, 186, 116, 0.95)"
            : "1px solid rgba(226, 232, 240, 0.95)",
          borderRadius: 16,
          background: hasDiscount
            ? "linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)"
            : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.07)",
          padding: isCollapsed ? "0.62rem 0.72rem" : "0.7rem 0.8rem 0.75rem",
          color: "#0f172a",
          overflow: "hidden",
          transition: "padding 0.16s ease, box-shadow 0.16s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            paddingBottom: isCollapsed ? 0 : 6,
            borderBottom: isCollapsed ? "0" : "1px dashed rgba(148, 163, 184, 0.58)",
            marginBottom: isCollapsed ? 0 : 7,
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
                background: hasDiscount ? "#ffedd5" : "#e2e8f0",
                color: hasDiscount ? "#ea580c" : "#475569",
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
              {!isCollapsed && (
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>
                  {hasDiscount
                    ? `${appliedPromotionCount || 1} ưu đãi đã áp dụng tự động`
                    : previewItems.length
                      ? "Chưa có ưu đãi áp dụng cho đơn này"
                      : "Chưa có món trong đơn"}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {!isCollapsed && (
              <div
                style={{
                  borderRadius: 999,
                  padding: "0.24rem 0.55rem",
                  background: hasDiscount ? "#dcfce7" : "#f1f5f9",
                  color: hasDiscount ? "#15803d" : "#64748b",
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {hasDiscount ? `Đã giảm ${formatPrice(totalDiscount)}` : "Không giảm"}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? "Mở chi tiết footer" : "Thu gọn footer"}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                background: "#fff",
                color: "#475569",
                padding: "0.24rem 0.55rem",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 10px rgba(15, 23, 42, 0.04)",
              }}
            >
              {isCollapsed ? "Mở rộng" : "Thu gọn"}
            </button>
          </div>
        </div>

        {isCollapsed ? (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ color: hasDiscount ? "#15803d" : "#64748b", fontSize: 11, fontWeight: 850 }}>
              {hasDiscount ? `Đã giảm ${formatPrice(totalDiscount)}` : "Tổng hiện tại"}
            </div>
            <strong
              style={{
                color: "#ea580c",
                fontSize: 18,
                lineHeight: 1,
                fontWeight: 950,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatPrice(payableTotal)}
            </strong>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 5 }}>
              {detailRows.map((row) => (
                <div key={row.label} style={rowStyle}>
                  <span style={labelStyle}>{row.label}</span>
                  <span
                    style={{
                      ...valueStyle,
                      color: row.sign === "discount" && row.value > 0 ? "#16a34a" : valueStyle.color,
                    }}
                  >
                    {row.sign === "discount" && row.value > 0 ? "-" : ""}
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
                  {hasDiscount ? "Giá đã gồm ưu đãi hợp lệ" : "Giá tạm tính hiện tại"}
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
          </>
        )}
      </div>
    </>,
    footerElement,
  );
}
