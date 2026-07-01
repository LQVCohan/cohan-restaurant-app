const cleanRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const sameId = (left, right) => Boolean(left && right && String(left) === String(right));

export const SYSTEM_ROLE_LABELS = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý hệ thống",
  hr: "Nhân sự",
  accountant: "Kế toán",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

export const BRAND_ROLE_LABELS = {
  owner: "Chủ thương hiệu",
  admin: "Quản trị Brand",
  manager: "Quản lý chi nhánh",
  staff: "Nhân viên Brand",
};

export const normalizeSystemRole = (user) =>
  cleanRole(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType);

export const normalizeBrandRole = (input) => cleanRole(typeof input === "string" ? input : input?.role);

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
  const brandLabel = getBrandRoleLabel({ user, activeBrand, membership }) || "Chưa gắn Brand hiện tại";
  const systemLabel = getSystemRoleLabel(user);
  return `Vai trò Brand: ${brandLabel} | Vai trò hệ thống: ${systemLabel}`;
};
