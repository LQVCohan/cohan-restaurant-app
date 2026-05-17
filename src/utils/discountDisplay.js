export function formatDiscountReasonLabel(reason) {
  const raw = String(reason || "").trim();
  if (!raw) return "";

  if (/^coupon:/i.test(raw)) {
    return "Coupon hợp lệ";
  }

  if (/^promotion:/i.test(raw)) {
    return "Chương trình khuyến mãi";
  }

  if (/^voucher:/i.test(raw)) {
    return "Coupon hợp lệ";
  }

  return raw;
}

export function getPromotionSourceLabel(source) {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized === "line") return "Dòng món";
  if (normalized === "order") return "Đơn hàng";
  if (normalized === "shipping") return "Phí vận chuyển";
  return normalized || "Khác";
}

export function getPromotionTypeLabel(type) {
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === "BOGO") return "Mua tặng";
  if (normalized === "COMBO") return "Combo";
  if (normalized === "FREESHIP") return "Freeship";
  if (normalized === "PERCENTAGE" || normalized === "FIXED") return "Giảm giá";
  return normalized || "Khuyến mãi";
}
