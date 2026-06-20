export const normalizeId = (value) => String(value || "").trim();

export const normalizeList = (value) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [
    ...new Set(
      source
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ];
};

export const normalizePaymentForCoupon = (method) => {
  const value = String(method || "").toLowerCase();
  if (value === "wallet") return ["wallet", "e_wallet"];
  if (value === "transfer") return ["transfer", "bank_transfer"];
  return value ? [value] : [];
};

export const normalizeDiscountType = (value) => String(value || "").toUpperCase();
export const normalizeCategoryConstraintIds = (value) => normalizeList(value);
export const normalizeCategoryConstraintNames = (value) => normalizeList(value).map((item) => item.toLowerCase());
export const normalizeCategoryName = (value) => String(value || "").trim().toLowerCase();

export const getItemLineTotal = (item = {}) => (
  Number(item.price || item.unitPrice || item.basePrice || 0) + Number(item.modifiersPrice || 0)
) * Number(item.quantity || 1);

export const getItemCategoryIds = (item = {}) => [
  item.categoryId,
  item.category?.id,
  item.category?._id,
  item.menuItem?.categoryId,
  item.menuItem?.category?.id,
  item.menuItem?.category?._id,
  item.categorySnapshot?.id,
  item.categorySnapshot?._id,
  item.snapshot?.categoryId,
  item.snapshot?.category?.id,
  item.snapshot?.category?._id,
].filter(Boolean).map((value) => String(value).trim()).filter(Boolean);

export const getItemCategoryNames = (item = {}) => {
  const names = [];
  if (typeof item.category === "string") names.push(item.category);
  else if (item.category?.name) names.push(item.category.name);

  names.push(
    item.categoryName,
    item.menuItem?.categoryName,
    item.menuItem?.category?.name,
    item.categorySnapshot?.name,
    item.snapshot?.categoryName,
    item.snapshot?.category?.name,
  );

  return [...new Set(names.map(normalizeCategoryName).filter(Boolean))];
};

export const couponHasCategoryConstraint = (coupon = {}) => {
  const constraints = coupon.constraints || {};
  return normalizeCategoryConstraintIds(constraints.categoryIds).length > 0 || normalizeCategoryConstraintNames(constraints.categories).length > 0;
};

export const itemMatchesCouponCategory = (item = {}, coupon = {}) => {
  const constraints = coupon.constraints || {};
  const categoryIds = normalizeCategoryConstraintIds(constraints.categoryIds);
  const categoryNames = normalizeCategoryConstraintNames(constraints.categories);
  if (!categoryIds.length && !categoryNames.length) return true;

  const itemCategoryIds = getItemCategoryIds(item);
  const itemCategoryNames = getItemCategoryNames(item);
  return itemCategoryIds.some((id) => categoryIds.includes(id)) || itemCategoryNames.some((name) => categoryNames.includes(name));
};

export const calculateCouponEligibleSubtotalFrontend = ({ coupon, items = [], fallbackSubtotal = 0 }) => {
  const hasConstraints = couponHasCategoryConstraint(coupon);
  if (!hasConstraints) return { hasConstraints: false, eligibleSubtotal: fallbackSubtotal };

  const eligibleSubtotal = items.reduce((sum, item) => {
    const status = String(item?.status || "");
    if (status === "cancelled" || status === "returned") return sum;
    if (!itemMatchesCouponCategory(item, coupon)) return sum;
    return sum + getItemLineTotal(item);
  }, 0);

  return { hasConstraints: true, eligibleSubtotal };
};

export const getItemRestaurantId = (item = {}) => normalizeId(item.restaurantId || item.restaurant?.id || item.restaurant?._id);

export const buildRestaurantCartGroups = (items = []) => {
  const groups = new Map();
  items.forEach((item) => {
    const restaurantId = getItemRestaurantId(item);
    if (!restaurantId) return;
    if (!groups.has(restaurantId)) groups.set(restaurantId, { restaurantId, items: [], subtotal: 0, categoryIds: new Set(), categories: new Set() });
    const group = groups.get(restaurantId);
    group.items.push(item);
    group.subtotal += getItemLineTotal(item);
    getItemCategoryIds(item).forEach((id) => group.categoryIds.add(id));
    getItemCategoryNames(item).forEach((name) => group.categories.add(name));
  });
  return Array.from(groups.values()).map((group) => ({ ...group, categoryIds: Array.from(group.categoryIds), categories: Array.from(group.categories) }));
};

export const isCouponActiveNow = (coupon = {}, nowMs = Date.now()) => {
  if (!coupon?.isActive) return false;
  if (coupon.startAt && new Date(coupon.startAt).getTime() > nowMs) return false;
  if (coupon.endAt && new Date(coupon.endAt).getTime() < nowMs) return false;
  const maxUsage = Number(coupon.maxUsage || 0);
  if (maxUsage > 0 && Number(coupon.used || 0) >= maxUsage) return false;
  return true;
};

export const calculateCouponDiscount = (coupon = {}, subtotal = 0) => {
  const discountType = normalizeDiscountType(coupon.discountType);
  const value = Math.max(0, Number(coupon.discountValue || 0));
  const maxDiscount = Math.max(0, Number(coupon.maxDiscount || 0));
  let discount = 0;
  if (discountType === "PERCENT") discount = Math.round(subtotal * (value / 100));
  else discount = Math.round(value);
  if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  return Math.max(0, Math.min(Math.round(subtotal), discount));
};

export const getCouponIneligibilityReason = ({ coupon, group, orderType, paymentMethod, formatCurrency }) => {
  if (!isCouponActiveNow(coupon)) return "Coupon chưa khả dụng.";
  const subtotal = Number(group?.subtotal || 0);
  const minOrderValue = Math.max(0, Number(coupon.minOrderValue || 0));
  if (subtotal < minOrderValue) return `Cần đơn tối thiểu ${formatCurrency(minOrderValue)}.`;
  const constraints = coupon.constraints || {};
  const orderTypes = normalizeList(constraints.orderTypes);
  if (orderTypes.length && orderType && !orderTypes.includes(orderType)) return "Không đúng hình thức nhận hàng.";
  const paymentMethods = normalizeList(constraints.paymentMethods).map((item) => item.toLowerCase());
  const paymentAliases = normalizePaymentForCoupon(paymentMethod);
  if (paymentMethods.length && paymentAliases.length && !paymentAliases.some((item) => paymentMethods.includes(item))) return "Không đúng phương thức thanh toán.";
  const categoryScope = calculateCouponEligibleSubtotalFrontend({ coupon, items: group.items, fallbackSubtotal: subtotal });
  if (categoryScope.hasConstraints && categoryScope.eligibleSubtotal <= 0) return "Không có món thuộc danh mục áp dụng.";
  return "";
};

export const buildCouponConditionText = (coupon = {}, formatCurrency) => {
  const lines = [];
  if (Number(coupon.minOrderValue || 0) > 0) lines.push(`Đơn tối thiểu ${formatCurrency(coupon.minOrderValue)}`);
  if (Number(coupon.maxDiscount || 0) > 0) lines.push(`giảm tối đa ${formatCurrency(coupon.maxDiscount)}`);
  const constraints = coupon.constraints || {};
  const orderTypes = normalizeList(constraints.orderTypes);
  if (orderTypes.length) lines.push(`áp dụng ${orderTypes.join(" / ")}`);
  const paymentMethods = normalizeList(constraints.paymentMethods);
  if (paymentMethods.length) lines.push(`thanh toán ${paymentMethods.join(" / ")}`);
  return lines.join(" · ") || "Có thể áp dụng theo điều kiện của nhà hàng";
};

export const pickBestCouponForGroup = ({ coupons = [], group, orderType, paymentMethod, formatCurrency }) => coupons
  .map((coupon) => {
    const reason = getCouponIneligibilityReason({ coupon, group, orderType, paymentMethod, formatCurrency });
    const categoryScope = calculateCouponEligibleSubtotalFrontend({ coupon, items: group.items, fallbackSubtotal: group.subtotal });
    const estimatedDiscount = reason ? 0 : calculateCouponDiscount(coupon, categoryScope.eligibleSubtotal);
    return { coupon, estimatedDiscount, reason, eligibleSubtotal: categoryScope.eligibleSubtotal, hasCategoryConstraints: categoryScope.hasConstraints };
  })
  .filter((item) => !item.reason && item.estimatedDiscount > 0)
  .sort((a, b) => b.estimatedDiscount - a.estimatedDiscount || Number(a.coupon.minOrderValue || 0) - Number(b.coupon.minOrderValue || 0) || String(a.coupon.code || "").localeCompare(String(b.coupon.code || "")))[0] || null;
