import mongoose from "mongoose";
import * as Models from "../../../models/index.js";
const model = (name) => (name in Models ? Models[name] : undefined);
const Brand = model("Brand");
const BrandMembership = model("BrandMembership");
const Restaurant = model("Restaurant");

const emptyFilter = () => ({ _id: { $in: [] } });
const roleName = (user) => String(user?.roleName || user?.role?.slug || user?.role || "").toLowerCase();
const toObjectId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const idString = (value) => String(value?._id || value?.id || value || "");
const operationalRoles = new Set(["manager", "hr", "accountant", "staff", "server", "supervisor", "host", "cashier", "chef", "cook", "kitchen_helper", "cleaner", "shipper", "storekeeper", "bartender"]);
const userRoleNames = (user) => [roleName(user), String(user?.userType || "").toLowerCase(), ...(Array.isArray(user?.roles) ? user.roles.map((r) => String(r).toLowerCase()) : [])].filter(Boolean);
const hasOperationalRole = (user) => userRoleNames(user).some((role) => operationalRoles.has(role));

export const getUserId = (user) => idString(user);
export const isSystemAdmin = (user) => String(user?.userType || "").toUpperCase() === "ADMIN" || roleName(user) === "admin";
export const getUserBrandMemberships = async (user) => {
  const uid = toObjectId(getUserId(user));
  if (!uid || typeof BrandMembership?.find !== "function") return [];
  return BrandMembership.find({ userId: uid, status: "active" }).lean();
};

const legacyRestaurantIdsFromUser = (user) => [user?.restaurantId, user?.restaurantForStaff, ...(user?.restaurantIds || []), ...(user?.restaurants || [])]
  .map(toObjectId)
  .filter(Boolean);
const legacyRestaurantIdStringsFromUser = (user) => [user?.restaurantId, user?.restaurantForStaff, ...(user?.restaurantIds || []), ...(user?.restaurants || [])]
  .map(idString)
  .filter(Boolean);

function membershipScope(memberships) {
  return {
    brandIds: memberships.filter((m) => ["owner", "admin"].includes(m.role)).map((m) => m.brandId),
    restaurantIds: memberships.filter((m) => ["manager", "staff"].includes(m.role)).flatMap((m) => m.restaurantIds || []),
  };
}

export async function getScopedRestaurantFilter(user) {
  if (!user) return emptyFilter();
  if (isSystemAdmin(user)) return {};
  const memberships = await getUserBrandMemberships(user);
  const { brandIds, restaurantIds } = membershipScope(memberships);
  const ors = [
    ...(brandIds.length ? [{ brandId: { $in: brandIds } }] : []),
    ...(restaurantIds.length ? [{ _id: { $in: restaurantIds } }] : []),
  ];
  if (!memberships.length && hasOperationalRole(user)) {
    const legacyIds = legacyRestaurantIdsFromUser(user);
    if (legacyIds.length) ors.push({ _id: { $in: legacyIds } });
    const uid = toObjectId(getUserId(user));
    if (uid && userRoleNames(user).includes("manager")) ors.push({ managerId: uid });
  }
  return ors.length ? { $or: ors } : emptyFilter();
}

async function loadRestaurantForScope(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId) || typeof Restaurant?.findById !== "function") return null;
  const query = Restaurant.findById(restaurantId);
  return typeof query?.select === "function" ? query.select("_id brandId managerId").lean() : query;
}

async function legacyManagerOwnsRestaurant(user, restaurantId) {
  const uid = getUserId(user);
  if (!uid || !userRoleNames(user).includes("manager") || typeof Restaurant?.exists !== "function") return false;
  return !!await Restaurant.exists({ _id: restaurantId, managerId: uid });
}

export async function canAccessRestaurant(user, restaurantId) {
  if (!user || !restaurantId) return false;
  if (isSystemAdmin(user)) return true;
  const memberships = await getUserBrandMemberships(user);
  const restaurant = await loadRestaurantForScope(restaurantId);
  const matching = restaurant ? memberships.filter((m) => String(m.brandId) === String(restaurant.brandId || "")) : [];
  if (matching.some((m) => ["owner", "admin"].includes(m.role))) return true;
  if (matching.some((m) => ["manager", "staff"].includes(m.role) && (m.restaurantIds || []).some((id) => String(id) === String(restaurant._id)))) return true;
  if (restaurant?.brandId && memberships.length) return false;

  // Legacy fallback only for users without active BrandMembership scope.
  if (memberships.length) return false;
  if (!hasOperationalRole(user)) return false;
  const target = String(restaurant?._id || restaurantId);
  if (restaurant && String(restaurant.managerId || "") === getUserId(user)) return true;
  if (legacyRestaurantIdStringsFromUser(user).some((id) => id === target)) return true;
  return legacyManagerOwnsRestaurant(user, restaurantId);
}

export async function canReadBrand(user, brandId) {
  if (!user || !mongoose.isValidObjectId(brandId)) return false;
  if (isSystemAdmin(user)) return true;
  const uid = toObjectId(getUserId(user));
  if (typeof Brand?.exists !== "function") return !!(await getUserBrandMemberships(user)).find((m) => String(m.brandId) === String(brandId));
  return !!await Brand.exists({ _id: toObjectId(brandId), $or: [{ ownerId: uid }, { _id: { $in: (await getUserBrandMemberships(user)).map((m) => m.brandId) } }] });
}

export async function canManageBrand(user, brandId) {
  if (!user || !mongoose.isValidObjectId(brandId)) return false;
  if (isSystemAdmin(user)) return true;
  const uid = toObjectId(getUserId(user));
  const membershipAllowed = !!(await getUserBrandMemberships(user)).find((m) => String(m.brandId) === String(brandId) && ["owner", "admin"].includes(m.role));
  if (membershipAllowed || typeof Brand?.exists !== "function") return membershipAllowed;
  return !!await Brand.exists({ _id: toObjectId(brandId), ownerId: uid, status: { $ne: "inactive" } });
}

export const canManageBrandRestaurants = canManageBrand;

export async function isBrandOwner(user, brandId) {
  if (isSystemAdmin(user)) return true;
  const uid = toObjectId(getUserId(user));
  const membershipOwner = !!(await getUserBrandMemberships(user)).find((m) => String(m.brandId) === String(brandId) && m.role === "owner");
  if (membershipOwner || typeof Brand?.exists !== "function") return membershipOwner;
  return !!await Brand.exists({ _id: toObjectId(brandId), ownerId: uid, status: { $ne: "inactive" } });
}

export const isActiveBrandOperator = async (candidateUserId, brandId) => typeof BrandMembership?.exists === "function" && !!await BrandMembership.exists({ userId: toObjectId(candidateUserId), brandId: toObjectId(brandId), status: "active", role: { $in: ["owner", "admin", "manager"] } });

export async function ensureBrandRestaurants(brandId, restaurantIds = []) {
  const ids = [...new Set((restaurantIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const objectIds = ids.map(toObjectId);
  if (objectIds.some((id) => !id) || !toObjectId(brandId)) throw new Error("Invalid ID");
  const count = await Restaurant.countDocuments({ _id: { $in: objectIds }, brandId: toObjectId(brandId) });
  if (count !== ids.length) throw new Error("restaurantIds must belong to the brand");
  return objectIds;
}
