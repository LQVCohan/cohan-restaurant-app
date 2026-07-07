const cleanRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const sameId = (left, right) => Boolean(left && right && String(left) === String(right));

export const SYSTEM_ROLE_LABELS = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý",
  hr: "Nhân sự",
  accountant: "Kế toán",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

export const BRAND_ROLE_LABELS = {
  owner: "Chủ chuỗi",
  admin: "Quản trị chuỗi",
  manager: "Quản lý chi nhánh",
  staff: "Nhân viên chi nhánh",
};

export const normalizeSystemRole = (user) =>
  cleanRole(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType);

export const normalizeBrandRole = (input) => cleanRole(typeof input === "string" ? input : input?.role);

export const isBrandWideRole = (role) => ["owner", "admin"].includes(normalizeBrandRole(role));
export const isSingleRestaurantRole = (role) => normalizeBrandRole(role) === "manager";

export const normalizeMembershipRestaurantIds = (membership) =>
  [...new Set((membership?.restaurantIds || membership?.restaurants || [])
    .map((item) => String(item?.id || item?._id || item || ""))
    .filter(Boolean))];

export const getMembershipScopeLabel = (membership, restaurants = [], brandName = "") => {
  const role = normalizeBrandRole(membership);
  if (isBrandWideRole(role)) {
    return brandName ? `Tất cả chi nhánh thuộc ${brandName}` : "Tất cả chi nhánh trong chuỗi";
  }
  const ids = normalizeMembershipRestaurantIds(membership);
  const byId = new Map((restaurants || []).map((restaurant) => [String(restaurant?.id || restaurant?._id), restaurant?.name || restaurant?.restaurantName]));
  const names = ids.map((id) => byId.get(id) || id).filter(Boolean);
  if (role === "manager") return names[0] || "Chưa xác định chi nhánh";
  if (role === "staff") return names.length ? names.join(", ") : "Chưa gán chi nhánh";
  return "Chưa tham gia chuỗi";
};

export const getSystemRoleLabel = (user) => {
  const role = normalizeSystemRole(user);
  return SYSTEM_ROLE_LABELS[role] || user?.role?.name || user?.roleName || user?.userType || "Chưa có vai trò";
};

export const getBrandRoleLabel = ({ user, activeBrand, membership, brand } = {}) => {
  const scopedBrand = activeBrand || brand;
  const userId = user?.id || user?._id;
  const ownerId = scopedBrand?.ownerId || scopedBrand?.owner?.id || scopedBrand?.owner?._id;
  const role = sameId(ownerId, userId)
    ? "owner"
    : normalizeBrandRole(
      scopedBrand?.membershipRole || scopedBrand?.role || membership?.role || user?.brandRole,
    );

  return BRAND_ROLE_LABELS[role] || null;
};

export const getCombinedRoleLabel = ({ user, activeBrand, membership, compact = false } = {}) => {
  const brandLabel = getBrandRoleLabel({ user, activeBrand, membership });
  const systemLabel = getSystemRoleLabel(user);
  if (compact) return brandLabel || systemLabel;
  return [brandLabel, systemLabel].filter(Boolean).join(" · ");
};

export const getRoleTooltip = ({ user, activeBrand, membership } = {}) => {
  const brandLabel = getBrandRoleLabel({ user, activeBrand, membership }) || "Chưa tham gia chuỗi";
  const systemLabel = getSystemRoleLabel(user);
  return `Cấp tài khoản: ${systemLabel} | Quyền trong chuỗi: ${brandLabel}`;
};
