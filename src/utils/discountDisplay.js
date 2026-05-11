export function formatDiscountReasonLabel(reason) {
  const raw = String(reason || "").trim();
  if (!raw) return "";

  if (/^coupon:/i.test(raw)) {
    return "Voucher hợp lệ";
  }

  if (/^promotion:/i.test(raw)) {
    return "Chương trình khuyến mãi";
  }

  if (/^voucher:/i.test(raw)) {
    return "Voucher hợp lệ";
  }

  return raw;
}
