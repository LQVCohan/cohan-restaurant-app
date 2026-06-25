import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePos } from "../../../../../context/PosContext";
import { useNotification } from "../../../../../hooks/useNotification";
import { useDiscountPreview } from "@/hooks/useDiscountPreview";
import {
  buildOrderDiscountPreviewInput,
  getShippingFeeForDiscountPreview,
} from "@/utils/discountPreviewPayload";
import styles from "./EligibleGiftSuggestionPanel.module.scss";

const getComparableIds = (item) =>
  [item?.id, item?._id, item?.dishId, item?.menuId, item?.menuItemId]
    .filter(Boolean)
    .map(String);

const findMenuItemByGift = (menuItems = [], giftItemId) => {
  const target = giftItemId ? String(giftItemId) : "";
  if (!target) return null;
  return (menuItems || []).find((item) => getComparableIds(item).includes(target)) || null;
};

const getCleanOrderItems = (items = []) =>
  (Array.isArray(items) ? items : []).filter((item) => {
    const status = String(item?.status || "").toLowerCase();
    return status !== "cancelled" && status !== "returned" && Number(item?.quantity || 0) > 0;
  });

export default function EligibleGiftSuggestionPanel() {
  const {
    restaurantId,
    currentOrder,
    currentOrderType,
    shippingInfo,
    menuItems,
    addToOrder,
  } = usePos();
  const { showNotification } = useNotification?.() || {
    showNotification: (message, type) => console.log(type || "info", message),
  };
  const { previewOrderDiscount } = useDiscountPreview();
  const [eligibleGiftItems, setEligibleGiftItems] = useState([]);

  const previewItems = useMemo(() => getCleanOrderItems(currentOrder), [currentOrder]);

  useEffect(() => {
    if (!restaurantId || !previewItems.length) {
      setEligibleGiftItems([]);
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

        if (cancelled) return;
        const gifts = Array.isArray(breakdown?.eligibleGiftItems)
          ? breakdown.eligibleGiftItems.filter((gift) => Number(gift?.missingGiftQuantity || 0) > 0)
          : [];
        setEligibleGiftItems(gifts);
      } catch {
        if (!cancelled) setEligibleGiftItems([]);
      }
    }, 360);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    restaurantId,
    currentOrderType,
    previewItems,
    shippingInfo?.shippingFee,
    previewOrderDiscount,
  ]);

  const handleAddGift = useCallback(
    (gift) => {
      const menuItem = findMenuItemByGift(menuItems, gift?.giftItemId);
      if (!menuItem) {
        showNotification(
          `Không tìm thấy món tặng ${gift?.giftItemName || ""} trong menu hiện tại.`,
          "error",
        );
        return;
      }

      const quantity = Math.max(1, Number(gift?.missingGiftQuantity || 1));
      addToOrder?.({
        menuItem,
        quantity,
        price: Number(gift?.giftItemPrice ?? menuItem?.price ?? menuItem?.basePrice ?? 0),
        servingKey: gift?.giftDefaultServingKey || menuItem?.defaultServingKey || "",
        note: `Món tặng từ ${gift?.promotionName || "khuyến mãi mua tặng"}`,
      });

      setEligibleGiftItems((prev) =>
        (prev || []).filter(
          (item) =>
            String(item?.promotionId) !== String(gift?.promotionId) ||
            String(item?.giftItemId) !== String(gift?.giftItemId),
        ),
      );
      showNotification(
        `Đã thêm ${quantity} ${gift?.giftItemName || "món tặng"}. Kiểm tra ưu đãi lại để áp dụng giảm giá.`,
        "success",
      );
    },
    [addToOrder, menuItems, showNotification],
  );

  if (!eligibleGiftItems.length) return null;

  return (
    <section className={styles.giftPanel} aria-label="Gợi ý món tặng khuyến mãi">
      <div className={styles.giftHeader}>
        <span className={styles.giftIcon}>🎁</span>
        <div>
          <h3 className={styles.giftTitle}>Đơn đủ điều kiện nhận món tặng</h3>
          <p className={styles.giftSubtitle}>
            Thêm món tặng vào đơn để hệ thống tự giảm giá dòng quà tặng.
          </p>
        </div>
      </div>

      <div className={styles.giftList}>
        {eligibleGiftItems.map((gift) => (
          <div
            key={`${gift.promotionId}_${gift.giftItemId}`}
            className={styles.giftItem}
          >
            <div className={styles.giftText}>
              <strong className={styles.giftName}>
                {gift.giftItemName || "Món tặng"}
              </strong>
              <span className={styles.giftMessage}>
                {gift.message ||
                  `${gift.promotionName || "Khuyến mãi"} · còn thiếu ${gift.missingGiftQuantity || 1}`}
              </span>
            </div>
            <button
              type="button"
              className={styles.giftButton}
              onClick={() => handleAddGift(gift)}
            >
              Thêm món tặng
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
