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
    <div
      aria-label="Tạm tính sau ưu đãi"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 72,
        zIndex: 70,
        pointerEvents: "none",
        border: "1px solid #bbf7d0",
        borderRadius: 14,
        background:
          "linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(255, 255, 255, 0.99))",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.1)",
        padding: "0.75rem 0.85rem",
        color: "#14532d",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#dcfce7",
            color: "#15803d",
            fontWeight: 900,
          }}
        >
          %
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Tạm tính sau ưu đãi</div>
          <div style={{ fontSize: 11, color: "#166534" }}>
            Khuyến mãi đã được tính trực tiếp vào tổng tiền.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 5, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Tạm tính</span>
          <strong>{formatPrice(subtotal)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
          <span>Tổng giảm</span>
          <strong>-{formatPrice(totalDiscount)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#ea580c", fontWeight: 900 }}>
          <span>Tổng cộng</span>
          <strong>{formatPrice(payableTotal)}</strong>
        </div>
      </div>
    </div>
  );
}
