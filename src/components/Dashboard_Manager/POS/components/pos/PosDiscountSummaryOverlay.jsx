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

  const subtotal = Number(discountBreakdown?.subtotal || 0);
  const totalDiscount = Math.max(
    0,
    Number(
      discountBreakdown?.totalDiscount ??
        discountBreakdown?.discount ??
        discountBreakdown?.promotionDiscount ??
        0,
    ),
  );
  const payableTotal = getDiscountBreakdownTotal(discountBreakdown, subtotal);

  if (!previewItems.length || totalDiscount <= 0) return null;

  return (
    <>
      <style>{`
        [data-pos-order-panel]:has(+ [data-pos-discount-footer]) [class*="summary"] {
          visibility: hidden !important;
        }
      `}</style>
      <div
        data-pos-discount-footer
        aria-label="Tạm tính sau ưu đãi"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 76,
          zIndex: 80,
          pointerEvents: "none",
          border: "1px solid rgba(134, 239, 172, 0.95)",
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(240, 253, 244, 0.99), rgba(255, 247, 237, 0.98))",
          boxShadow: "0 16px 34px rgba(15, 23, 42, 0.12)",
          padding: "0.8rem 0.9rem",
          color: "#14532d",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(249, 115, 22, 0.12), transparent 38%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#dcfce7",
                  color: "#15803d",
                  fontWeight: 950,
                  boxShadow: "inset 0 0 0 1px rgba(34, 197, 94, 0.15)",
                  flexShrink: 0,
                }}
              >
                %
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 950, color: "#14532d" }}>Tổng sau ưu đãi</div>
                <div style={{ fontSize: 11, color: "#166534", lineHeight: 1.3 }}>
                  Đã tự áp dụng khuyến mãi hợp lệ cho đơn này.
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>Cần thu</div>
              <div style={{ fontSize: 18, color: "#ea580c", fontWeight: 950, lineHeight: 1.1 }}>
                {formatPrice(payableTotal)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
            }}
          >
            <div
              style={{
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.76)",
                border: "1px solid rgba(226, 232, 240, 0.9)",
                padding: "0.45rem 0.55rem",
              }}
            >
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>Tạm tính</div>
              <strong style={{ color: "#0f172a", fontSize: 13 }}>{formatPrice(subtotal)}</strong>
            </div>
            <div
              style={{
                borderRadius: 12,
                background: "rgba(220, 252, 231, 0.72)",
                border: "1px solid rgba(134, 239, 172, 0.72)",
                padding: "0.45rem 0.55rem",
                textAlign: "right",
              }}
            >
              <div style={{ color: "#166534", fontSize: 11, fontWeight: 800 }}>Đã giảm</div>
              <strong style={{ color: "#16a34a", fontSize: 13 }}>-{formatPrice(totalDiscount)}</strong>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
