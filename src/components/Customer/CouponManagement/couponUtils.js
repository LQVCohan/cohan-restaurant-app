import { COUPON_CATEGORIES } from "@/utils/constants";

export const ORDER_TYPE_LABELS = {
  dine_in: "Dùng tại bàn",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
};

export const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  bank_transfer: "Chuyển khoản",
  e_wallet: "Ví điện tử",
};

export const formatCurrency = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn");

const normalizeArray = (value) => Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
const normalizeId = (value) => String(value || "").trim();

export const isCouponExpired = (coupon) => Boolean(coupon?.endAt && new Date(coupon.endAt).getTime() < Date.now());

export const isCouponOutOfUsage = (coupon) => {
  const maxUsage = Number(coupon?.maxUsage || 0);
  return maxUsage > 0 && Number(coupon?.used || 0) >= maxUsage;
};

export const getCouponStatus = (coupon, savedCoupon) => {
  const savedStatus = String(savedCoupon?.status || "").toLowerCase();
  if (savedStatus === "used" || savedCoupon?.usedAt) return "used";
  if (isCouponExpired(coupon)) return "expired";
  if (isCouponOutOfUsage(coupon)) return "out_of_usage";
  if (savedCoupon) return "saved";
  return "active";
};

export const getStatusLabel = (status) => ({
  saved: "Đã lưu",
  used: "Đã dùng",
  expired: "Hết hạn",
  out_of_usage: "Hết lượt",
  active: "Còn hiệu lực",
}[status] || "Còn hiệu lực");

export const buildConditionLines = (coupon) => {
  const constraints = coupon?.constraints || {};
  const lines = [];
  if (Number(coupon?.minOrderValue || 0) > 0) lines.push(`Đơn tối thiểu ${formatCurrency(coupon.minOrderValue)}.`);
  if (Number(coupon?.maxDiscount || 0) > 0) lines.push(`Giảm tối đa ${formatCurrency(coupon.maxDiscount)}.`);
  const maxUsage = Number(coupon?.maxUsage || 0);
  const used = Number(coupon?.used || 0);
  lines.push(maxUsage > 0 ? `Giới hạn lượt dùng: đã dùng ${used.toLocaleString("vi-VN")}/${maxUsage.toLocaleString("vi-VN")}.` : "Không giới hạn tổng lượt dùng.");
  lines.push(`Hiệu lực: ${formatDate(coupon?.startAt)} - ${formatDate(coupon?.endAt)}.`);
  const orderTypes = normalizeArray(constraints.orderTypes);
  if (orderTypes.length) lines.push(`Loại đơn áp dụng: ${orderTypes.map((type) => ORDER_TYPE_LABELS[type] || type).join(" / ")}.`);
  const paymentMethods = normalizeArray(constraints.paymentMethods);
  if (paymentMethods.length) lines.push(`Phương thức thanh toán: ${paymentMethods.map((method) => PAYMENT_METHOD_LABELS[method] || method).join(" / ")}.`);
  const perUserLimit = Number(constraints.perUserLimit || 0);
  if (perUserLimit > 0) lines.push(`Mỗi khách dùng tối đa ${perUserLimit} lần.`);
  if (constraints.firstOrderOnly) lines.push("Chỉ áp dụng cho đơn đầu tiên.");
  if (constraints.stackable) lines.push("Có thể dùng chồng với coupon khác.");
  if (constraints.combinableWithPromotions) lines.push("Có thể dùng chung với promotion hợp lệ.");
  if (constraints.exclusive) lines.push("Coupon độc quyền, có thể chặn ưu đãi khác.");
  if (Array.isArray(constraints.conditions)) lines.push(...constraints.conditions.filter(Boolean));
  return lines.length ? lines : ["Xem điều kiện áp dụng khi thanh toán."];
};

export const normalizeCoupon = (source, savedCoupon) => {
  const coupon = source?.coupon || source || {};
  const category = String(coupon.category || "order").toLowerCase();
  const maxUsage = Number(coupon.maxUsage || 0);
  const used = Number(coupon.used || 0);
  const status = getCouponStatus(coupon, savedCoupon || (source?.coupon ? source : null));
  const discountType = String(coupon.discountType || "").toUpperCase();
  return {
    ...coupon,
    id: normalizeId(coupon.id || source?.couponId),
    restaurantId: normalizeId(coupon.restaurantId || source?.restaurantId),
    name: coupon.name || coupon.code || "Coupon",
    code: coupon.code || "",
    category,
    categoryLabel: COUPON_CATEGORIES[category] || category,
    description: coupon.description || "Ưu đãi áp dụng theo điều kiện",
    status,
    statusLabel: getStatusLabel(status),
    isSaved: Boolean(savedCoupon || source?.coupon),
    savedRecord: savedCoupon || (source?.coupon ? source : null),
    discountLabel: discountType === "PERCENT" ? `Giảm ${coupon.discountValue || 0}%` : `Giảm ${formatCurrency(coupon.discountValue)}`,
    usagePercent: maxUsage > 0 ? Math.min(Math.round((used / maxUsage) * 100), 100) : null,
    usageLabel: maxUsage > 0 ? `Đã dùng ${used.toLocaleString("vi-VN")}/${maxUsage.toLocaleString("vi-VN")}` : "Không giới hạn lượt dùng",
    conditions: buildConditionLines(coupon),
  };
};

export const filterCoupons = (coupons, activeTab, searchTerm) => {
  const keyword = String(searchTerm || "").trim().toLowerCase();
  return coupons.filter((coupon) => {
    const matchesTab = activeTab === "all" ||
      (activeTab === "saved" && coupon.isSaved) ||
      (activeTab === "valid" && ["active", "saved"].includes(coupon.status)) ||
      (activeTab === "expiring" && coupon.endAt && !isCouponExpired(coupon) && new Date(coupon.endAt).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000) ||
      coupon.status === activeTab || coupon.category === activeTab;
    const haystack = [coupon.name, coupon.code, coupon.description, coupon.category, coupon.categoryLabel].join(" ").toLowerCase();
    return matchesTab && (!keyword || haystack.includes(keyword));
  });
};

export const sortCoupons = (coupons) => [...coupons].sort((a, b) => {
  const statusWeight = { saved: 0, active: 1, out_of_usage: 2, used: 3, expired: 4 };
  const weightDiff = (statusWeight[a.status] ?? 5) - (statusWeight[b.status] ?? 5);
  if (weightDiff) return weightDiff;
  return new Date(a.endAt || "2999-12-31") - new Date(b.endAt || "2999-12-31");
});
